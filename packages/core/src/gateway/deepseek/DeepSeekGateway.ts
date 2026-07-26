/**
 * DeepSeek LLM Gateway
 *
 * Ported from Open-ClaudeCode's claude.ts.
 * Equivalence rewrite: OpenAI-compatible Chat Completions API.
 *
 * Key rules:
 * - tool role messages MUST immediately follow the assistant with matching tool_calls
 * - Orphaned tool_results (no matching tool_calls in history) are dropped
 * - Assistant content must be null when tool_calls are present
 */

import type {
  SDKMessage,
  SDKAssistantMessage,
  SDKStreamEvent,
  ContentBlock,
  ToolDef,
} from '../../types/index.js'

// ============================================================================
// Types
// ============================================================================

export type DeepSeekConfig = {
  apiKey: string
  baseUrl?: string
  model?: string
}

export type GatewayOptions = {
  messages: SDKMessage[]
  tools: ToolDef[]
  systemPrompt?: string
  signal: AbortSignal
  model?: string
  maxTokens?: number
  temperature?: number
}

type OpenAIMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: { name: string; arguments: string }
  }>
  tool_call_id?: string
}

// ============================================================================
// Gateway
// ============================================================================

export class DeepSeekGateway {
  private config: DeepSeekConfig

  constructor(config: DeepSeekConfig) {
    this.config = {
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-v4-flash',
      ...config,
    }
    if (!this.config.baseUrl) this.config.baseUrl = 'https://api.deepseek.com'
    if (!this.config.model) this.config.model = 'deepseek-v4-flash'
  }

  get model(): string {
    return this.config.model!
  }

  /**
   * Stream a chat completion from DeepSeek.
   */
  async *stream(
    options: GatewayOptions,
  ): AsyncGenerator<SDKAssistantMessage | SDKStreamEvent> {
    const converted = this.convertMessagesSafe(options.messages, options.systemPrompt)
    const openAITools = this.convertTools(options.tools)
    const sessionId = crypto.randomUUID()

    const body: Record<string, unknown> = {
      model: options.model ?? this.config.model,
      messages: converted.messages,
      stream: true,
      stream_options: { include_usage: true },
    }

    if (openAITools.length > 0) {
      body.tools = openAITools
      body.parallel_tool_calls = false
    }
    if (options.maxTokens) body.max_tokens = options.maxTokens
    if (options.temperature !== undefined) body.temperature = options.temperature

    const response = await fetch(`${this.config.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify(body),
      signal: options.signal,
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'unknown error')
      // Log dropped tool results for debugging
      if (converted.droppedToolIds.length > 0) {
        throw new Error(
          `DeepSeek API error ${response.status}: ${errorText}\n` +
          `Dropped ${converted.droppedToolIds.length} orphaned tool_results (no matching tool_calls in history).`
        )
      }
      throw new Error(`DeepSeek API error ${response.status}: ${errorText}`)
    }

    // Parse SSE stream
    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    const pendingToolCalls = new Map<number, { id: string; name: string; arguments: string }>()
    let currentText = ''
    let stopReason: string | null = null
    let textBlockStarted = false
    let contentBlocks: ContentBlock[] = []
    let firstToolUseId: string | null = null

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed.startsWith(':')) continue

          if (trimmed.startsWith('data: ')) {
            const data = trimmed.slice(6)
            if (data === '[DONE]') continue

            try {
              const chunk = JSON.parse(data) as any

              if (!chunk.choices || chunk.choices.length === 0) {
                if (chunk.usage) {
                  yield {
                    type: 'stream_event',
                    event: {
                      type: 'message_delta',
                      delta: { stop_reason: stopReason ?? undefined },
                      usage: { output_tokens: chunk.usage.completion_tokens },
                    },
                    session_id: sessionId,
                    uuid: crypto.randomUUID(),
                  }
                }
                continue
              }

              const delta = chunk.choices[0]!.delta
              const finishReason = chunk.choices[0]!.finish_reason

              if (finishReason) {
                stopReason = finishReason === 'tool_calls' ? 'tool_use' : finishReason
              }

              if (delta.content) {
                if (!textBlockStarted) {
                  textBlockStarted = true
                  yield {
                    type: 'stream_event',
                    event: {
                      type: 'content_block_start',
                      index: 0,
                      content_block: { type: 'text', text: '' },
                    },
                    session_id: sessionId,
                    uuid: crypto.randomUUID(),
                  }
                }
                currentText += delta.content
                yield {
                  type: 'stream_event',
                  event: {
                    type: 'content_block_delta',
                    index: 0,
                    delta: { type: 'text_delta', text: delta.content },
                  },
                  session_id: sessionId,
                  uuid: crypto.randomUUID(),
                }
              }

              if (delta.tool_calls) {
                for (const tc of delta.tool_calls) {
                  if (tc.id) {
                    pendingToolCalls.set(tc.index, { id: tc.id, name: '', arguments: '' })
                    yield {
                      type: 'stream_event',
                      event: {
                        type: 'content_block_start',
                        index: pendingToolCalls.size,
                        content_block: { type: 'tool_use', id: tc.id, name: '', input: {} },
                      },
                      session_id: sessionId,
                      uuid: crypto.randomUUID(),
                    }
                  }

                  const pending = pendingToolCalls.get(tc.index)
                  if (pending && tc.function) {
                    if (tc.function.name) pending.name += tc.function.name
                    if (tc.function.arguments) {
                      pending.arguments += tc.function.arguments
                      yield {
                        type: 'stream_event',
                        event: {
                          type: 'content_block_delta',
                          index: tc.index,
                          delta: { type: 'input_json_delta', partial_json: tc.function.arguments },
                        },
                        session_id: sessionId,
                        uuid: crypto.randomUUID(),
                      }
                    }
                  }
                }
              }

              if (currentText && (delta.tool_calls || finishReason)) {
                yield {
                  type: 'stream_event',
                  event: { type: 'content_block_stop', index: 0 },
                  session_id: sessionId,
                  uuid: crypto.randomUUID(),
                }
                textBlockStarted = false
              }
            } catch {
              continue
            }
          }
        }
      }

      // Build final content blocks
      if (currentText) {
        contentBlocks.push({ type: 'text', text: currentText })
      }

      for (const [, tc] of pendingToolCalls) {
        if (!firstToolUseId) firstToolUseId = tc.id
        let parsedInput: Record<string, unknown> = {}
        try {
          parsedInput = tc.arguments ? JSON.parse(tc.arguments) : {}
        } catch {
          parsedInput = { _raw: tc.arguments }
        }
        contentBlocks.push({ type: 'tool_use', id: tc.id, name: tc.name, input: parsedInput })
        yield {
          type: 'stream_event',
          event: { type: 'content_block_stop', index: contentBlocks.length },
          session_id: sessionId,
          uuid: crypto.randomUUID(),
        }
      }

      yield {
        type: 'stream_event',
        event: { type: 'message_stop' },
        session_id: sessionId,
        uuid: crypto.randomUUID(),
      }

      yield {
        type: 'assistant',
        message: {
          role: 'assistant',
          content: contentBlocks,
          stop_reason: stopReason,
        },
        parent_tool_use_id: firstToolUseId,
        uuid: crypto.randomUUID(),
        session_id: sessionId,
      }
    } finally {
      reader.releaseLock()
    }
  }

  // ============================================================================
  // Safe Message Conversion — validates tool pairing
  // ============================================================================

  private convertMessagesSafe(
    messages: SDKMessage[],
    systemPrompt?: string,
  ): { messages: OpenAIMessage[]; droppedToolIds: string[] } {
    const result: OpenAIMessage[] = []
    const droppedToolIds: string[] = []

    if (systemPrompt) {
      result.push({ role: 'system', content: systemPrompt })
    }

    // Build set of all tool_call IDs from assistant messages
    const allToolCallIds = new Set<string>()
    for (const msg of messages) {
      if (msg.type === 'assistant') {
        for (const block of msg.message.content ?? []) {
          if (block.type === 'tool_use') {
            allToolCallIds.add(block.id)
          }
        }
      }
    }

    for (const msg of messages) {
      if (msg.type === 'assistant') {
        const textParts: string[] = []
        const toolCalls: OpenAIMessage['tool_calls'] = []

        for (const block of msg.message.content ?? []) {
          switch (block.type) {
            case 'text':
              textParts.push(block.text)
              break
            case 'tool_use':
              toolCalls.push({
                id: block.id,
                type: 'function',
                function: {
                  name: block.name,
                  arguments: JSON.stringify(block.input),
                },
              })
              break
          }
        }

        // OpenAI rule: content must be null when tool_calls are present
        const assistantMsg: OpenAIMessage = {
          role: 'assistant',
          content: toolCalls.length > 0 ? null : (textParts.join('\n') || null),
        }
        if (toolCalls.length > 0) {
          assistantMsg.tool_calls = toolCalls
        }
        result.push(assistantMsg)

      } else if (msg.type === 'user') {
        const contentBlocks = Array.isArray(msg.message.content) ? msg.message.content : []
        const toolResults = contentBlocks.filter(
          (b): b is ContentBlock & { type: 'tool_result' } => b.type === 'tool_result',
        )
        const textBlocks = contentBlocks.filter(
          (b): b is ContentBlock & { type: 'text' } => b.type === 'text',
        )

        if (toolResults.length > 0) {
          for (const tr of toolResults) {
            // DROP orphaned tool_results (no matching tool_call in history)
            if (!allToolCallIds.has(tr.tool_use_id)) {
              droppedToolIds.push(tr.tool_use_id)
              continue
            }
            result.push({
              role: 'tool',
              content: tr.is_error
                ? `Error: ${tr.content}`
                : (typeof tr.content === 'string' ? tr.content : JSON.stringify(tr.content)),
              tool_call_id: tr.tool_use_id,
            })
          }
        } else if (textBlocks.length > 0) {
          result.push({ role: 'user', content: textBlocks.map(t => t.text).join('\n') })
        } else {
          result.push({
            role: 'user',
            content: typeof msg.message.content === 'string'
              ? msg.message.content
              : JSON.stringify(msg.message.content),
          })
        }
      }
    }

    return { messages: result, droppedToolIds }
  }

  private convertMessages(messages: SDKMessage[], systemPrompt?: string): OpenAIMessage[] {
    return this.convertMessagesSafe(messages, systemPrompt).messages
  }

  private convertTools(tools: ToolDef[]): Array<{
    type: 'function'
    function: { name: string; description: string; parameters: ToolDef['inputSchema']; strict?: boolean }
  }> {
    return tools.map((t: ToolDef) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema,
        strict: t.strict,
      },
    }))
  }
}
