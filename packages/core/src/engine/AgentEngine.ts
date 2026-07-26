/**
 * DeepAGI AgentEngine
 *
 * Ported from Open-ClaudeCode's QueryEngine.ts.
 * 5-phase submitMessage lifecycle with QueryPipeline + tool execution.
 */

import type {
  SDKMessage,
  SDKUserMessage,
  SDKAssistantMessage,
  EngineConfig,
  ToolDef,
  Usage,
  ContentBlock,
} from '../types/index.js'
import { DeepSeekGateway } from '../gateway/deepseek/DeepSeekGateway.js'
import { QueryPipeline } from './QueryPipeline.js'
import { getAllTools } from '../tools/registry.js'
import type { Tool, Tools } from '../tools/registry.js'
import type { ToolUseContext } from '../tools/ToolUseContext.js'

// ============================================================================
// AgentEngine
// ============================================================================

export class AgentEngine {
  private config: EngineConfig
  private mutableMessages: SDKMessage[]
  private abortController: AbortController
  private gateway: DeepSeekGateway
  private totalUsage: Usage = { inputTokens: 0, outputTokens: 0 }
  private tools: Tools
  private toolDefs: ToolDef[]

  constructor(config: EngineConfig) {
    this.config = config
    this.mutableMessages = []
    this.abortController = new AbortController()
    this.gateway = new DeepSeekGateway({
      apiKey: config.deepseekApiKey,
      baseUrl: config.deepseekBaseUrl,
      model: config.model,
    })
    this.tools = getAllTools()
    this.toolDefs = config.tools.length > 0
      ? config.tools
      : this.tools.map(t => ({
          name: t.name,
          description: t.description(),
          inputSchema: t.inputSchema,
        }))
  }

  /**
   * Submit a message and get streaming response.
   * 5-phase lifecycle from QueryEngine.submitMessage().
   */
  async *submitMessage(
    prompt: string,
    options?: { uuid?: string; isMeta?: boolean },
  ): AsyncGenerator<SDKMessage> {
    const startTime = Date.now()
    let turnCount = 1

    // Phase 1-2: User input → push to messages
    const userMessage: SDKUserMessage = {
      type: 'user',
      message: { role: 'user', content: prompt },
      parent_tool_use_id: null,
      uuid: options?.uuid ?? crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    }
    this.mutableMessages.push(userMessage)

    // Phase 3: Build system prompt
    const systemPrompt = this.config.systemPrompt ?? this.getDefaultSystemPrompt()
    let lastStopReason: string | null = null

    // Phase 4: Query loop
    while (true) {
      const pipeline = new QueryPipeline({
        gateway: this.gateway,
        tools: this.toolDefs,
        systemPrompt,
        maxTurns: this.config.maxTurns,
        signal: this.abortController.signal,
        model: this.config.model,
      })

      for await (const message of pipeline.run({
        messages: this.mutableMessages,
        turnCount,
      })) {
        if (message.type === 'assistant') {
          this.mutableMessages.push(message)
          lastStopReason = message.message.stop_reason ?? null
          yield message
        } else {
          yield message
        }
      }

      // Check tool_use blocks in the last assistant message
      const lastAssistant = this.findLastAssistant()

      if (!lastAssistant) break

      const toolUses = (lastAssistant.message.content ?? []).filter(
        (c): c is ContentBlock & { type: 'tool_use' } => c.type === 'tool_use',
      )

      // No tools → done
      if (toolUses.length === 0) break

      // Execute tools
      turnCount++
      const toolResults = await this.executeToolBatch(toolUses, lastAssistant)
      for (const tr of toolResults) {
        this.mutableMessages.push(tr)
      }

      // Check max turns
      if (this.config.maxTurns && turnCount > this.config.maxTurns) {
        yield {
          type: 'result',
          subtype: 'error_max_turns',
          is_error: true,
          errors: [`Reached maximum turns (${this.config.maxTurns})`],
          duration_ms: Date.now() - startTime,
          num_turns: turnCount,
          stop_reason: lastStopReason,
          total_cost_usd: 0,
          usage: this.totalUsage,
          session_id: crypto.randomUUID(),
          uuid: crypto.randomUUID(),
        } as SDKMessage
        return
      }

      // Continue while(true) for next iteration
    }

    // Phase 5: Result
    const lastMsg = this.findLastAssistant()
    let textResult = ''
    if (lastMsg) {
      const lastContent = lastMsg.message.content?.at(-1)
      if (lastContent?.type === 'text') {
        textResult = lastContent.text
      }
    }

    yield {
      type: 'result',
      subtype: 'success',
      is_error: false,
      result: textResult,
      stop_reason: lastStopReason,
      duration_ms: Date.now() - startTime,
      num_turns: turnCount,
      total_cost_usd: 0,
      usage: this.totalUsage,
      session_id: crypto.randomUUID(),
      uuid: crypto.randomUUID(),
    } as SDKMessage
  }

  /**
   * Execute tool calls from an assistant message.
   */
  private async executeToolBatch(
    toolUses: Array<ContentBlock & { type: 'tool_use' }>,
    _parentMessage: SDKAssistantMessage,
  ): Promise<SDKMessage[]> {
    const results: SDKMessage[] = []

    for (const block of toolUses) {
      const tool = this.tools.find(t => t.name === block.name)
      if (!tool) {
        results.push(this.makeToolResult(block.id, `Unknown tool: ${block.name}`, true))
        continue
      }

      const context: ToolUseContext = {
        options: {
          tools: this.tools,
          mainLoopModel: this.gateway.model,
          verbose: this.config.verbose ?? false,
        },
        abortController: this.abortController,
        messages: this.mutableMessages,
        inProgressToolUseIDs: new Set(),
        setInProgressToolUseIDs: () => {},
      }

      try {
        if (tool.validateInput) {
          const validation = await tool.validateInput(block.input, context)
          if (!validation.result) {
            results.push(this.makeToolResult(block.id, validation.message, true))
            continue
          }
        }

        const result = await tool.call(block.input, context)
        const content = typeof result.data === 'string'
          ? result.data
          : JSON.stringify(result.data, null, 2)

        results.push(this.makeToolResult(block.id, content))
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        results.push(this.makeToolResult(block.id, msg, true))
      }
    }

    return results
  }

  private makeToolResult(toolUseId: string, content: string, isError = false): SDKUserMessage {
    return {
      type: 'user',
      message: {
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: toolUseId,
          content,
          is_error: isError,
        }],
      },
      parent_tool_use_id: toolUseId,
      uuid: crypto.randomUUID(),
    }
  }

  private findLastAssistant(): SDKAssistantMessage | undefined {
    for (let i = this.mutableMessages.length - 1; i >= 0; i--) {
      if (this.mutableMessages[i]!.type === 'assistant') {
        return this.mutableMessages[i] as SDKAssistantMessage
      }
    }
    return undefined
  }

  interrupt(): void {
    this.abortController.abort()
  }

  getMessages(): readonly SDKMessage[] {
    return this.mutableMessages
  }

  private getDefaultSystemPrompt(): string {
    return `You are DeepAGI, an AI assistant powered by DeepSeek.
You have access to tools that let you:
- Execute shell commands (bash)
- Read, write, and edit files
- Search file contents (grep) and filenames (glob)
- Fetch web pages
- Search the web
- Ask the user questions

When using tools:
1. Think through the problem step by step
2. Choose the right tool for each step
3. Use tool results to inform your next actions
4. Provide clear explanations of what you're doing`
  }
}
