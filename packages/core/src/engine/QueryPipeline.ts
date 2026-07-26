/**
 * DeepAGI QueryPipeline
 *
 * Ported from Open-ClaudeCode's query.ts state machine.
 * Adds memory retrieval & injection for cross-session knowledge.
 */

import type { SDKMessage, SDKAssistantMessage, SDKStreamEvent, ToolDef } from '../types/index.js'
import { DeepSeekGateway } from '../gateway/deepseek/DeepSeekGateway.js'
import { snipCompact } from '../compression/snip.js'
import { microcompact } from '../compression/microcompact.js'
import { contextCollapse } from '../compression/collapse.js'
import { autoCompact } from '../compression/autocompact.js'
import { reactiveCompact } from '../compression/reactiveCompact.js'
import { searchMemories, formatMemoriesForPrompt } from '../memory/index.js'

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
  maxMessagesBeforeCompact?: number
  snipKeepLast?: number
  autoCompactEnabled?: boolean
  collapseEnabled?: boolean
  /** Enable memory retrieval from cross-session store */
  memoryEnabled?: boolean
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
      memoryEnabled: true,
      ...config,
    }
  }

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

    // Memory retrieval phase: search cross-session memories once per pipeline run
    let memoryContext = ''
    if (this.config.memoryEnabled) {
      const userMessages = params.messages
        .filter(m => m.type === 'user')
        .map(m => typeof m.message.content === 'string' ? m.message.content : '')
        .join(' ')

      if (userMessages.trim()) {
        const memories = searchMemories(userMessages, 5)
        memoryContext = formatMemoriesForPrompt(memories)
      }
    }

    // Build system prompt with memory context
    const baseSystemPrompt = this.config.systemPrompt
    const fullSystemPrompt = memoryContext
      ? baseSystemPrompt + `\n\n${memoryContext}`
      : baseSystemPrompt

    while (true) {
      const { messages, turnCount } = state
      let compressedMessages = messages

      // Compression pipeline
      if (!state.snipApplied) {
        const snipResult = snipCompact(compressedMessages, this.config.snipKeepLast)
        if (snipResult.tokensFreed > 0) {
          compressedMessages = snipResult.messages
          state = { ...state, snipApplied: true }
        }
      }

      const microResult = microcompact(compressedMessages)
      compressedMessages = microResult.messages

      if (this.config.collapseEnabled) {
        const collapseResult = contextCollapse(compressedMessages, true)
        compressedMessages = collapseResult.messages
      }

      if (this.config.autoCompactEnabled && !state.autoCompactApplied) {
        const autoResult = await autoCompact(compressedMessages, true)
        if (autoResult.compacted) {
          compressedMessages = autoResult.messages
          state = { ...state, autoCompactApplied: true }
        }
      }

      // API call
      const assistantMessages: SDKAssistantMessage[] = []
      let hasToolUse = false
      let lastStopReason: string | null = null
      let apiError: string | null = null

      try {
        for await (const message of this.config.gateway.stream({
          messages: compressedMessages,
          tools: this.config.tools,
          systemPrompt: fullSystemPrompt,
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

      // Error recovery
      if (apiError) {
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
        yield {
          type: 'assistant',
          message: { role: 'assistant', content: [{ type: 'text', text: `API Error: ${apiError}` }], stop_reason: 'error' },
          parent_tool_use_id: null, uuid: crypto.randomUUID(), session_id: crypto.randomUUID(),
        }
        return { reason: 'model_error', error: apiError }
      }

      if (!hasToolUse) return { reason: 'completed' }

      // Max output tokens recovery
      const lastAssistant = assistantMessages.at(-1)
      if (lastAssistant?.error === 'max_output_tokens') {
        if (state.maxOutputTokensRecoveryCount < MAX_OUTPUT_TOKENS_RECOVERY_LIMIT) {
          state = {
            ...state,
            messages: [
              ...compressedMessages, ...assistantMessages,
              { type: 'user', message: { role: 'user', content: 'Continue from where you left off.' }, parent_tool_use_id: null, uuid: crypto.randomUUID() },
            ],
            transition: { reason: 'max_output_tokens_recovery', attempt: state.maxOutputTokensRecoveryCount + 1 },
            maxOutputTokensRecoveryCount: state.maxOutputTokensRecoveryCount + 1,
          }
          continue
        }
      }

      // Max turns check
      const nextTurnCount = turnCount + 1
      if (this.config.maxTurns && nextTurnCount > this.config.maxTurns) {
        yield {
          type: 'assistant',
          message: { role: 'assistant', content: [{ type: 'text', text: `Reached maximum turns (${this.config.maxTurns})` }], stop_reason: 'max_turns' },
          parent_tool_use_id: null, uuid: crypto.randomUUID(), session_id: crypto.randomUUID(),
        }
        return { reason: 'max_turns' }
      }

      return { reason: 'tool_use' }
    }
  }
}
