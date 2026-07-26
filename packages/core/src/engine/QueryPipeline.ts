/**
 * DeepAGI QueryPipeline
 *
 * Ported from Open-ClaudeCode's query.ts state machine.
 * while(true) + state = next loop with API streaming, error recovery, and tool_use detection.
 */

import type { SDKMessage, SDKAssistantMessage, SDKStreamEvent, ToolDef } from '../types/index.js'
import { DeepSeekGateway } from '../gateway/deepseek/DeepSeekGateway.js'

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
}

export type PipelineConfig = {
  gateway: DeepSeekGateway
  tools: ToolDef[]
  systemPrompt: string
  maxTurns?: number
  signal: AbortSignal
  model?: string
}

const MAX_OUTPUT_TOKENS_RECOVERY_LIMIT = 3

// ============================================================================
// QueryPipeline
// ============================================================================

export class QueryPipeline {
  private config: PipelineConfig

  constructor(config: PipelineConfig) {
    this.config = config
  }

  /**
   * Run the query loop.
   * while(true) + state = next — ported from query.ts queryLoop().
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
    }

    while (true) {
      const { messages, turnCount } = state

      // Step 1: API call via DeepSeek
      const assistantMessages: SDKAssistantMessage[] = []
      let hasToolUse = false
      let lastStopReason: string | null = null
      let apiError: string | null = null

      try {
        for await (const message of this.config.gateway.stream({
          messages,
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
            if (toolBlocks.length > 0) {
              hasToolUse = true
            }
            if (message.message.stop_reason) {
              lastStopReason = message.message.stop_reason
            }
            yield message
          } else {
            yield message
          }
        }
      } catch (error: unknown) {
        apiError = error instanceof Error ? error.message : String(error)
      }

      // Step 2: Handle API error
      if (apiError) {
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

      // Step 3: Terminal? No tool_use → done
      if (!hasToolUse) {
        return { reason: 'completed' }
      }

      // Step 4: max_output_tokens recovery
      const lastAssistant = assistantMessages.at(-1)
      if (lastAssistant?.error === 'max_output_tokens') {
        if (state.maxOutputTokensRecoveryCount < MAX_OUTPUT_TOKENS_RECOVERY_LIMIT) {
          state = {
            messages: [
              ...messages,
              ...assistantMessages,
              {
                type: 'user',
                message: {
                  role: 'user',
                  content: 'Continue from where you left off. Break remaining work into smaller pieces.',
                },
                parent_tool_use_id: null,
                uuid: crypto.randomUUID(),
              },
            ],
            turnCount,
            transition: { reason: 'max_output_tokens_recovery', attempt: state.maxOutputTokensRecoveryCount + 1 },
            maxOutputTokensRecoveryCount: state.maxOutputTokensRecoveryCount + 1,
          }
          continue
        }
      }

      // Step 5: Max turns check
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

      // Step 6: Signal tool_use — caller (AgentEngine) handles execution
      return { reason: 'tool_use' }
    }
  }
}
