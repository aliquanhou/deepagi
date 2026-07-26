/**
 * DeepAGI AgentEngine
 *
 * 5-phase submitMessage lifecycle.
 * System prompt adapted from Claude Code's verified structure.
 * Pure hybrid: DeepSeek API + Claude-style prompts + agnostic tooling.
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

    this.mutableMessages.push({
      type: 'user', message: { role: 'user', content: prompt },
      parent_tool_use_id: null, uuid: options?.uuid ?? crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    })

    const systemPrompt = this.config.systemPrompt ?? this.getDefaultSystemPrompt()
    let finalAssistantText = ''

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
        } else yield message
      }

      const lastAssistant = this.findLastAssistant()
      if (!lastAssistant) break
      const toolUses = (lastAssistant.message.content ?? []).filter(
        (c): c is ContentBlock & { type: 'tool_use' } => c.type === 'tool_use',
      )
      if (toolUses.length === 0) break

      this.turnCount++
      const toolResults = await this.executeToolBatch(toolUses, lastAssistant)
      for (const tr of toolResults) this.mutableMessages.push(tr)

      if (this.config.maxTurns && this.turnCount > this.config.maxTurns) {
        yield { type: 'result', subtype: 'error_max_turns', is_error: true,
          errors: [`Reached maximum turns (${this.config.maxTurns})`],
          duration_ms: Date.now() - startTime, num_turns: this.turnCount,
          stop_reason: lastStopReason, total_cost_usd: 0, usage: this.totalUsage,
          session_id: crypto.randomUUID(), uuid: crypto.randomUUID() } as SDKMessage
        return
      }
    }

    if (this.memoryEnabled && finalAssistantText.trim()) {
      try { storeMemory(createTurnMemory(this.sessionId, prompt, finalAssistantText)) } catch {}
    }

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

  private async executeToolBatch(
    toolUses: Array<ContentBlock & { type: 'tool_use' }>,
    _parentMessage: SDKAssistantMessage,
  ): Promise<SDKMessage[]> {
    const results: SDKMessage[] = []
    for (const block of toolUses) {
      const tool = this.tools.find(t => t.name === block.name)
      if (!tool) { results.push(this.makeToolResult(block.id, `Unknown tool: ${block.name}`, true)); continue }

      const context: ToolUseContext = {
        options: { tools: this.tools, mainLoopModel: this.gateway.model, verbose: this.config.verbose ?? false },
        abortController: this.abortController, messages: this.mutableMessages,
        inProgressToolUseIDs: new Set(), setInProgressToolUseIDs: () => {},
      }
      try {
        if (tool.validateInput) {
          const v = await tool.validateInput(block.input, context)
          if (!v.result) { results.push(this.makeToolResult(block.id, v.message, true)); continue }
        }
        const result = await tool.call(block.input, context)
        const content = typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2)
        results.push(this.makeToolResult(block.id, content))
      } catch (error: unknown) {
        results.push(this.makeToolResult(block.id, error instanceof Error ? error.message : String(error), true))
      }
    }
    return results
  }

  private makeToolResult(toolUseId: string, content: string, isError = false): SDKUserMessage {
    return { type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: toolUseId, content, is_error: isError }] }, parent_tool_use_id: toolUseId, uuid: crypto.randomUUID() }
  }

  private findLastAssistant(): SDKAssistantMessage | undefined {
    for (let i = this.mutableMessages.length - 1; i >= 0; i--) {
      if (this.mutableMessages[i]!.type === 'assistant') return this.mutableMessages[i] as SDKAssistantMessage
    }
  }

  interrupt(): void { this.abortController.abort() }
  getMessages(): readonly SDKMessage[] { return this.mutableMessages }

  private getDefaultSystemPrompt(): string {
    return `You are DeepAGI, an interactive agent that helps users with software engineering tasks. Use the instructions below and the tools available to you to assist the user.

IMPORTANT: You must NEVER generate or guess URLs for the user unless you are confident that the URLs are for helping the user with programming. You may use URLs provided by the user in their messages or local files.

# System
- All text you output outside of tool use is displayed to the user. You can use Github-flavored markdown for formatting.
- Tools are run in a permission mode. If a tool call is denied, adjust your approach.
- The system will automatically compress prior messages as it approaches context limits.

# Doing tasks
- The user will primarily ask you to perform software engineering tasks: fixing bugs, adding features, refactoring, explaining code, and more.
- You are highly capable. Defer to user judgment about whether a task is too large.
- Do not propose changes to code you haven't read first. If a user asks about or wants you to modify a file, read it first.
- Don't add features, refactor, or make improvements beyond what was asked.
- If an approach fails, diagnose why before switching tactics. Prioritize writing safe, secure, and correct code.
- Avoid creating helpers or abstractions for one-time operations. Three similar lines of code is better than a premature abstraction.

# Using your tools
- To read files use read instead of cat, head, tail, or sed
- To edit files use edit instead of sed or awk
- To create files use write instead of cat with heredoc or echo redirection
- To search for files use glob instead of find or ls
- To search file contents use grep instead of grep or rg
- Prefer dedicated tools over bash for file operations.

# Executing actions with care
- Before deleting or overwriting, check what you're replacing. If what you find contradicts how it was described, surface that instead of proceeding.
- Destructive operations warrant user confirmation: removing files, overwriting uncommitted changes, and other irreversible actions.

# Tone and style
- Do not use emojis unless the user explicitly requests it.
- Your responses should be short and concise.
- When referencing specific functions or pieces of code include pattern file_path:line_number.

# Output efficiency
- Go straight to the point. Try the simplest approach first. Be extra concise.
- Lead with the answer or action, not the reasoning. Skip filler words and unnecessary transitions.`
  }
}
