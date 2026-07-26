/**
 * DeepAGI AgentEngine
 *
 * 5-phase submitMessage lifecycle with:
 * - Tool call caching (same tool+args → cached result)
 * - Report caching (same prompt → cached report)
 * - Memory retrieval & auto-update
 * - QueryPipeline state machine + tool execution
 */

import type {
  SDKMessage, SDKUserMessage, SDKAssistantMessage, EngineConfig, ToolDef, Usage, ContentBlock,
} from '../types/index.js'
import { DeepSeekGateway } from '../gateway/deepseek/DeepSeekGateway.js'
import { QueryPipeline } from './QueryPipeline.js'
import { getAllTools } from '../tools/registry.js'
import type { Tool, Tools } from '../tools/registry.js'
import type { ToolUseContext } from '../tools/ToolUseContext.js'
import { storeMemory, createTurnMemory, initMemoryStore } from '../memory/index.js'

export class AgentEngine {
  private config: EngineConfig
  private mutableMessages: SDKMessage[]
  private abortController: AbortController
  private gateway: DeepSeekGateway
  private totalUsage: Usage = { inputTokens: 0, outputTokens: 0 }
  private tools: Tools
  private toolDefs: ToolDef[]
  private sessionId: string
  private memoryEnabled: boolean
  private turnCount = 0
  /** Cache: "toolName:argsJSON" → tool result messages */
  private toolCallCache = new Map<string, SDKMessage[]>()
  /** Cache: normalized prompt → final text result */
  private reportCache = new Map<string, string>()

  constructor(config: EngineConfig) {
    this.config = config
    this.mutableMessages = []
    this.abortController = new AbortController()
    this.gateway = new DeepSeekGateway({
      apiKey: config.deepseekApiKey, baseUrl: config.deepseekBaseUrl, model: config.model,
    })
    this.tools = getAllTools()
    this.toolDefs = config.tools.length > 0
      ? config.tools
      : this.tools.map(t => ({ name: t.name, description: t.description(), inputSchema: t.inputSchema }))
    this.sessionId = crypto.randomUUID()
    this.memoryEnabled = initMemoryStore()
  }

  async *submitMessage(prompt: string, options?: { uuid?: string; isMeta?: boolean }): AsyncGenerator<SDKMessage> {
    const startTime = Date.now()
    this.turnCount++
    let lastStopReason: string | null = null

    // Report cache check: normalize prompt for matching
    const cacheKey = prompt.toLowerCase().replace(/\s+/g, ' ').trim()
    const cached = this.reportCache.get(cacheKey)
    if (cached) {
      yield {
        type: 'result', subtype: 'success', is_error: false, result: cached,
        stop_reason: 'end_turn', duration_ms: 0, num_turns: 0,
        total_cost_usd: 0, usage: this.totalUsage,
        session_id: crypto.randomUUID(), uuid: crypto.randomUUID(),
      } as SDKMessage
      return
    }

    // Phase 1-2: User input
    this.mutableMessages.push({
      type: 'user', message: { role: 'user', content: prompt },
      parent_tool_use_id: null, uuid: options?.uuid ?? crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    })

    // Phase 3: System prompt
    const systemPrompt = this.config.systemPrompt ?? this.getDefaultSystemPrompt()
    let finalAssistantText = ''

    // Phase 4: Query loop
    while (true) {
      const pipeline = new QueryPipeline({
        gateway: this.gateway, tools: this.toolDefs, systemPrompt,
        maxTurns: this.config.maxTurns, signal: this.abortController.signal,
        model: this.config.model, memoryEnabled: this.memoryEnabled,
      })

      for await (const message of pipeline.run({ messages: this.mutableMessages, turnCount: this.turnCount })) {
        if (message.type === 'assistant') {
          this.mutableMessages.push(message)
          lastStopReason = message.message.stop_reason ?? null
          const textBlocks = (message.message.content ?? []).filter(
            (c): c is ContentBlock & { type: 'text' } => c.type === 'text',
          )
          finalAssistantText += textBlocks.map(t => t.text).join('')
          yield message
        } else {
          yield message
        }
      }

      const lastAssistant = this.findLastAssistant()
      if (!lastAssistant) break

      const toolUses = (lastAssistant.message.content ?? []).filter(
        (c): c is ContentBlock & { type: 'tool_use' } => c.type === 'tool_use',
      )
      if (toolUses.length === 0) break

      // Execute tools with caching
      this.turnCount++
      const toolResults = await this.executeToolBatchWithCache(toolUses, lastAssistant)
      for (const tr of toolResults) {
        this.mutableMessages.push(tr)
      }

      if (this.config.maxTurns && this.turnCount > this.config.maxTurns) {
        yield { type: 'result', subtype: 'error_max_turns', is_error: true,
          errors: [`Reached maximum turns (${this.config.maxTurns})`],
          duration_ms: Date.now() - startTime, num_turns: this.turnCount,
          stop_reason: lastStopReason, total_cost_usd: 0, usage: this.totalUsage,
          session_id: crypto.randomUUID(), uuid: crypto.randomUUID() } as SDKMessage
        return
      }
    }

    // Cache the final report
    if (finalAssistantText.trim()) {
      this.reportCache.set(cacheKey, finalAssistantText.trim())
    }

    // Auto-store memory
    if (this.memoryEnabled && finalAssistantText.trim()) {
      try { storeMemory(createTurnMemory(this.sessionId, prompt, finalAssistantText)) } catch {}
    }

    // Phase 5: Result
    const lastMsg = this.findLastAssistant()
    let textResult = ''
    if (lastMsg) {
      const lastContent = lastMsg.message.content?.at(-1)
      if (lastContent?.type === 'text') textResult = lastContent.text
    }
    yield { type: 'result', subtype: 'success', is_error: false, result: textResult,
      stop_reason: lastStopReason, duration_ms: Date.now() - startTime, num_turns: this.turnCount,
      total_cost_usd: 0, usage: this.totalUsage,
      session_id: crypto.randomUUID(), uuid: crypto.randomUUID() } as SDKMessage
  }

  /** Execute tools with caching: same tool+args returns cached result */
  private async executeToolBatchWithCache(
    toolUses: Array<ContentBlock & { type: 'tool_use' }>,
    _parentMessage: SDKAssistantMessage,
  ): Promise<SDKMessage[]> {
    const results: SDKMessage[] = []

    for (const block of toolUses) {
      const cacheKey = `${block.name}:${JSON.stringify(block.input)}`
      const cached = this.toolCallCache.get(cacheKey)
      if (cached) {
        results.push(...cached)
        continue
      }

      const tool = this.tools.find(t => t.name === block.name)
      if (!tool) {
        results.push(this.makeToolResult(block.id, `Unknown tool: ${block.name}`, true))
        continue
      }

      const context: ToolUseContext = {
        options: { tools: this.tools, mainLoopModel: this.gateway.model, verbose: this.config.verbose ?? false },
        abortController: this.abortController, messages: this.mutableMessages,
        inProgressToolUseIDs: new Set(), setInProgressToolUseIDs: () => {},
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
        const content = typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2)
        const toolMsg = this.makeToolResult(block.id, content)
        // Cache the result
        this.toolCallCache.set(cacheKey, [toolMsg])
        results.push(toolMsg)
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        results.push(this.makeToolResult(block.id, msg, true))
      }
    }
    return results
  }

  private makeToolResult(toolUseId: string, content: string, isError = false): SDKUserMessage {
    return {
      type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: toolUseId, content, is_error: isError }] },
      parent_tool_use_id: toolUseId, uuid: crypto.randomUUID(),
    }
  }

  private findLastAssistant(): SDKAssistantMessage | undefined {
    for (let i = this.mutableMessages.length - 1; i >= 0; i--) {
      if (this.mutableMessages[i]!.type === 'assistant') return this.mutableMessages[i] as SDKAssistantMessage
    }
    return undefined
  }

  interrupt(): void { this.abortController.abort() }
  getMessages(): readonly SDKMessage[] { return this.mutableMessages }

  private getDefaultSystemPrompt(): string {
    return `You are DeepAGI, an interactive agent that helps users with software engineering tasks. Use the instructions below and the tools available to you to assist the user.

IMPORTANT: You must NEVER generate or guess URLs for the user.

# System
- All text you output outside of tool use is displayed to the user. You can use Github-flavored markdown for formatting.
- Tools are run in a permission mode. If a tool call is denied, do not re-attempt the exact same call.
- The system will automatically compress prior messages as it approaches context limits.

# Efficiency (DeepSeek-specific)
- When gathering information about multiple tools, combine all checks into a SINGLE bash command joined with &&.
- Example: "git --version && node --version && npm --version && python --version"
- Choose ONE shell (bash on Linux/Mac, powershell on Windows) — do NOT run the same check in both shells.
- Avoid redundant checks. If you already checked a tool's version, don't check it again.

# Doing tasks
- The user will primarily ask you to perform software engineering tasks.
- You are highly capable. Defer to user judgment about whether a task is too large.
- In general, do not propose changes to code you haven't read first.
- Don't add features or make improvements beyond what was asked.
- If an approach fails, diagnose why before switching tactics. Prioritize writing safe, secure, and correct code.

# Using your tools
- To read files use read instead of cat, head, tail, or sed
- To edit files use edit instead of sed or awk
- To create files use write instead of cat with heredoc
- To search for files use glob instead of find or ls
- To search file contents use grep instead of grep or rg

# Executing actions with care
- Before deleting or overwriting, check what you're replacing.
- Destructive operations warrant user confirmation: removing files, overwriting uncommitted changes.
- For hard-to-reverse operations, confirm first.

# Tone and style
- Do not use emojis unless the user explicitly requests it.
- Your responses should be short and concise.
- When referencing specific functions or pieces of code include pattern file_path:line_number.

# Output efficiency
- Go straight to the point. Try the simplest approach first. Be extra concise.
- Lead with the answer or action, not the reasoning. Skip filler words and unnecessary transitions.
- If you can say it in one sentence, don't use three.`
  }
}
