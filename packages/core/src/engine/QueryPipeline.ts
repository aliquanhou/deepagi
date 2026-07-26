/**
 * DeepAGI QueryPipeline
 *
 * Ported from Open-ClaudeCode's query.ts state machine.
 * while(true) + state = next loop with:
 * - 5-layer compression (Snip → Micro → Collapse → Auto → Reactive)
 * - API streaming via DeepSeekGateway
 * - Error recovery
 * - Tool_use detection / agent delegation
 */

import type { SDKMessage, SDKAssistantMessage, SDKStreamEvent, ToolDef } from '../types/index.js'
import { DeepSeekGateway } from '../gateway/deepseek/DeepSeekGateway.js'
import { snipCompact } from '../compression/snip.js'
import { microcompact } from '../compression/microcompact.js'
import { contextCollapse } from '../compression/collapse.js'
import { autoCompact } from '../compression/autocompact.js'
import { reactiveCompact } from '../compression/reactiveCompact.js'

// ============================================================================
// Types
// ============================================================================

export type Continue = { reason: string; [key: string]: unknown }
export type Terminal = { reason: string; error?: unknown }

export type State = {
  messages: SDKMessage[]
  turnCount: number
  transition: Continue | undefined
  maxOutputTokensRecoveryCount: number
  hasAttemptedReactiveCompact: boolean
  snipApplied: boolean
  autoCompactApplied: boolean
}

export type PipelineConfig = {
  gateway: DeepSeekGateway
  tools: ToolDef[]
  systemPrompt: string
  maxTurns?: number
  signal: AbortSignal
  model?: string
  // Compression config
  maxMessagesBeforeCompact?: number
  snipKeepLast?: number
  autoCompactEnabled?: boolean
  collapseEnabled?: boolean
}

const MAX_OUTPUT_TOKENS_RECOVERY_LIMIT = 3

// ============================================================================
// QueryPipeline
// ============================================================================

export class QueryPipeline {
  private config: PipelineConfig

  constructor(config: PipelineConfig) {
    this.config = {
      maxMessagesBeforeCompact: 40,
      snipKeepLast: 15,
      autoCompactEnabled: true,
      collapseEnabled: true,
      ...config,
    }
  }

  /**
   * Run the query loop with compression + error recovery.
   */
  async *run(params: {
    messages: SDKMessage[]
    turnCount: number
  }): AsyncGenerator<SDKAssistantMessage | SDKStreamEvent, Terminal> {
    let state: State = {
      messages: [...params.messages],
      turnCount: params.turnCount,
      transition: undefined,
      maxOutputTokensRecoveryCount: 0,
      hasAttemptedReactiveCompact: false,
      snipApplied: false,
      autoCompactApplied: false,
    }

    while (true) {
      const { messages, turnCount } = state

      // =====================================================================
      // Stage 1: Compression pipeline (5 layers)
      // =====================================================================
      let compressedMessages = messages

      // Layer 1: Snip — truncate if too long
      if (!state.snipApplied) {
        const snipResult = snipCompact(compressedMessages, this.config.snipKeepLast)
        if (snipResult.tokensFreed > 0) {
          compressedMessages = snipResult.messages
          state = { ...state, snipApplied: true }
        }
      }

      // Layer 2: Microcompact — trim verbose tool results
      const microResult = microcompact(compressedMessages)
      compressedMessages = microResult.messages

      // Layer 3: Context Collapse — fold distant segments
      if (this.config.collapseEnabled) {
        const collapseResult = contextCollapse(compressedMessages, true)
        compressedMessages = collapseResult.messages
      }

      // Layer 4: AutoCompact — summarize oldest messages
      if (this.config.autoCompactEnabled && !state.autoCompactApplied) {
        const autoResult = await autoCompact(compressedMessages, true)
        if (autoResult.compacted) {
          compressedMessages = autoResult.messages
          state = { ...state, autoCompactApplied: true }
        }
      }

      // =====================================================================
      // Stage 2: API call via DeepSeek
      // =====================================================================
      const assistantMessages: SDKAssistantMessage[] = []
      let hasToolUse = false
      let lastStopReason: string | null = null
      let apiError: string | null = null

      try {
        for await (const message of this.config.gateway.stream({
          messages: compressedMessages,
          tools: this.config.tools,
          systemPrompt: this.config.systemPrompt,
          signal: this.config.signal,
          model: this.config.model,
        })) {
          if (message.type === 'assistant') {
            assistantMessages.push(message)
            const toolBlocks = (message.message.content ?? []).filter(
              (c: Record<string, unknown>) => c.type === 'tool_use',
            )
            if (toolBlocks.length > 0) hasToolUse = true
            if (message.message.stop_reason) lastStopReason = message.message.stop_reason
            yield message
          } else {
            yield message
          }
        }
      } catch (error: unknown) {
        apiError = error instanceof Error ? error.message : String(error)
      }

      // =====================================================================
      // Stage 3: Error recovery
      // =====================================================================
      if (apiError) {
        // Layer 5: ReactiveCompact — attempt recovery for prompt_too_long
        if (!state.hasAttemptedReactiveCompact) {
          const reactiveResult = await reactiveCompact(compressedMessages, apiError)
          if (reactiveResult.compacted) {
            state = {
              ...state,
              messages: reactiveResult.messages,
              hasAttemptedReactiveCompact: true,
              transition: { reason: 'reactive_compact_retry' },
            }
            continue
          }
        }

        // Yield error and terminate
        yield {
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: `API Error: ${apiError}` }],
            stop_reason: 'error',
          },
          parent_tool_use_id: null,
          uuid: crypto.randomUUID(),
          session_id: crypto.randomUUID(),
        }
        return { reason: 'model_error', error: apiError }
      }

      // =====================================================================
      // Stage 4: Terminal? No tool_use → done
      // =====================================================================
      if (!hasToolUse) {
        return { reason: 'completed' }
      }

      // =====================================================================
      // Stage 5: max_output_tokens recovery
      // =====================================================================
      const lastAssistant = assistantMessages.at(-1)
      if (lastAssistant?.error === 'max_output_tokens') {
        if (state.maxOutputTokensRecoveryCount < MAX_OUTPUT_TOKENS_RECOVERY_LIMIT) {
          state = {
            ...state,
            messages: [
              ...compressedMessages,
              ...assistantMessages,
              {
                type: 'user',
                message: { role: 'user', content: 'Continue from where you left off.' },
                parent_tool_use_id: null,
                uuid: crypto.randomUUID(),
              },
            ],
            transition: { reason: 'max_output_tokens_recovery', attempt: state.maxOutputTokensRecoveryCount + 1 },
            maxOutputTokensRecoveryCount: state.maxOutputTokensRecoveryCount + 1,
          }
          continue
        }
      }

      // =====================================================================
      // Stage 6: Max turns check
      // =====================================================================
      const nextTurnCount = turnCount + 1
      if (this.config.maxTurns && nextTurnCount > this.config.maxTurns) {
        yield {
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: `Reached maximum turns (${this.config.maxTurns})` }],
            stop_reason: 'max_turns',
          },
          parent_tool_use_id: null,
          uuid: crypto.randomUUID(),
          session_id: crypto.randomUUID(),
        }
        return { reason: 'max_turns' }
      }

      // =====================================================================
      // Stage 7: Signal tool_use — caller (AgentEngine) handles execution
      // =====================================================================
      return { reason: 'tool_use' }
    }
  }
}
