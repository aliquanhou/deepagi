/**
 * DeepAGI Tool Orchestrator
 *
 * Ported from Open-ClaudeCode's toolOrchestration.ts.
 * Partitions tools by concurrency-safety, parallel for read-only, serial for writes.
 */

import { findToolByName, type Tool, type ToolResult } from './Tool.js'
import type { ToolUseContext } from './ToolUseContext.js'
import type { SDKMessage, SDKAssistantMessage, SDKUserMessage, ContentBlock, ToolUseContent, ToolResultContent } from '../types/index.js'

// ============================================================================
// Types
// ============================================================================

export type ToolUseBlock = {
  id: string
  name: string
  input: Record<string, unknown>
}

export type MessageUpdate = {
  message?: SDKMessage
  newContext: ToolUseContext
}

type MessageUpdateLazy = {
  message?: SDKMessage
  contextModifier?: {
    toolUseID: string
    modifyContext: (ctx: ToolUseContext) => ToolUseContext
  }
}

type Batch = {
  isConcurrencySafe: boolean
  blocks: ToolUseBlock[]
}

const MAX_CONCURRENCY = 10

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Run tools extracted from an assistant message.
 */
export async function* runTools(
  toolUseBlocks: ToolUseBlock[],
  assistantMessages: SDKAssistantMessage[],
  toolUseContext: ToolUseContext,
): AsyncGenerator<MessageUpdate, void> {
  let currentContext = toolUseContext

  for (const { isConcurrencySafe, blocks } of partitionToolCalls(toolUseBlocks, currentContext)) {
    if (isConcurrencySafe) {
      const queuedContextModifiers: Record<string, Array<(ctx: ToolUseContext) => ToolUseContext>> = {}

      for await (const update of runToolsConcurrently(blocks, assistantMessages, currentContext)) {
        if (update.contextModifier) {
          const { toolUseID, modifyContext } = update.contextModifier
          if (!queuedContextModifiers[toolUseID]) {
            queuedContextModifiers[toolUseID] = []
          }
          queuedContextModifiers[toolUseID].push(modifyContext)
        }
        yield { message: update.message, newContext: currentContext }
      }

      for (const block of blocks) {
        const modifiers = queuedContextModifiers[block.id]
        if (!modifiers) continue
        for (const modifier of modifiers) {
          currentContext = modifier(currentContext)
        }
      }
      yield { newContext: currentContext }
    } else {
      for await (const update of runToolsSerially(blocks, assistantMessages, currentContext)) {
        if (update.newContext) {
          currentContext = update.newContext
        }
        yield { message: update.message, newContext: currentContext }
      }
    }
  }
}

// ============================================================================
// Partition
// ============================================================================

function partitionToolCalls(toolUseBlocks: ToolUseBlock[], context: ToolUseContext): Batch[] {
  return toolUseBlocks.reduce((acc: Batch[], toolUse) => {
    const tool = findToolByName(context.options.tools, toolUse.name)
    const isConcurrencySafe = tool
      ? safeConcurrencyCheck(tool, toolUse.input)
      : false

    if (isConcurrencySafe && acc[acc.length - 1]?.isConcurrencySafe) {
      acc[acc.length - 1]!.blocks.push(toolUse)
    } else {
      acc.push({ isConcurrencySafe, blocks: [toolUse] })
    }
    return acc
  }, [])
}

function safeConcurrencyCheck(tool: Tool, input: unknown): boolean {
  try {
    return tool.isConcurrencySafe(input as Record<string, unknown>)
  } catch {
    return false
  }
}

// ============================================================================
// Serial
// ============================================================================

async function* runToolsSerially(
  toolUseBlocks: ToolUseBlock[],
  assistantMessages: SDKAssistantMessage[],
  toolUseContext: ToolUseContext,
): AsyncGenerator<MessageUpdate, void> {
  let currentContext = toolUseContext

  for (const toolUse of toolUseBlocks) {
    toolUseContext.setInProgressToolUseIDs(prev => new Set(prev).add(toolUse.id))

    for await (const update of executeTool(toolUse, assistantMessages, currentContext)) {
      if (update.contextModifier) {
        currentContext = update.contextModifier.modifyContext(currentContext)
      }
      yield { message: update.message, newContext: currentContext }
    }

    toolUseContext.setInProgressToolUseIDs(prev => {
      const next = new Set(prev)
      next.delete(toolUse.id)
      return next
    })
  }
}

// ============================================================================
// Parallel
// ============================================================================

async function* runToolsConcurrently(
  toolUseBlocks: ToolUseBlock[],
  assistantMessages: SDKAssistantMessage[],
  toolUseContext: ToolUseContext,
): AsyncGenerator<MessageUpdateLazy, void> {
  const tasks = toolUseBlocks.map((toolUse) => {
    return async function* (): AsyncGenerator<MessageUpdateLazy, void> {
      toolUseContext.setInProgressToolUseIDs(prev => new Set(prev).add(toolUse.id))
      yield* executeTool(toolUse, assistantMessages, toolUseContext)
      toolUseContext.setInProgressToolUseIDs(prev => {
        const next = new Set(prev)
        next.delete(toolUse.id)
        return next
      })
    }
  })

  yield* runAll(tasks, MAX_CONCURRENCY)
}

// ============================================================================
// Single Tool Execution
// ============================================================================

async function* executeTool(
  toolUse: ToolUseBlock,
  assistantMessages: SDKAssistantMessage[],
  toolUseContext: ToolUseContext,
): AsyncGenerator<MessageUpdateLazy, void> {
  const tool = findToolByName(toolUseContext.options.tools, toolUse.name)
  if (!tool) {
    yield { message: makeToolError(toolUse.id, `Unknown tool: ${toolUse.name}`) }
    return
  }

  if (tool.validateInput) {
    const validation = await tool.validateInput(toolUse.input, toolUseContext)
    if (!validation.result) {
      yield { message: makeToolError(toolUse.id, validation.message) }
      return
    }
  }

  try {
    const result = await tool.call(toolUse.input as Record<string, unknown>, toolUseContext)
    yield {
      message: makeToolResult(toolUse.id, result),
      contextModifier: result.contextModifier
        ? { toolUseID: toolUse.id, modifyContext: result.contextModifier }
        : undefined,
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    yield { message: makeToolError(toolUse.id, msg) }
  }
}

// ============================================================================
// Helpers
// ============================================================================

function makeToolResult(toolUseId: string, result: ToolResult<unknown>): SDKUserMessage {
  const content = typeof result.data === 'string'
    ? result.data
    : JSON.stringify(result.data, null, 2)

  return {
    type: 'user',
    message: {
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: toolUseId, content }],
    },
    parent_tool_use_id: toolUseId,
    uuid: crypto.randomUUID(),
  }
}

function makeToolError(toolUseId: string, error: string): SDKUserMessage {
  return {
    type: 'user',
    message: {
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: toolUseId, content: error, is_error: true }],
    },
    parent_tool_use_id: toolUseId,
    uuid: crypto.randomUUID(),
  }
}

// ============================================================================
// Concurrency Helper
// ============================================================================

async function* runAll(
  generators: Array<() => AsyncGenerator<MessageUpdateLazy, void>>,
  concurrency: number,
): AsyncGenerator<MessageUpdateLazy, void> {
  const buffer: MessageUpdateLazy[] = []
  let bufferResolve: (() => void) | null = null
  let done = false

  async function push(val: MessageUpdateLazy): Promise<void> {
    buffer.push(val)
    bufferResolve?.()
  }

  async function runner(gen: () => AsyncGenerator<MessageUpdateLazy, void>): Promise<void> {
    for await (const val of gen()) {
      await push(val)
    }
  }

  const running = new Set<Promise<void>>()

  // Start initial batch
  let i = 0
  for (; i < Math.min(concurrency, generators.length); i++) {
    running.add(runner(generators[i]!))
  }

  // Process rest as slots free up
  for (; i < generators.length; i++) {
    await Promise.race(running)
    // Remove completed promises
    for (const p of running) {
      if (await Promise.race([p.then(() => true), Promise.resolve(false)])) {
        running.delete(p)
        break
      }
    }
    running.add(runner(generators[i]!))
  }

  await Promise.all(running)
  done = true

  // Drain buffer
  while (buffer.length > 0) {
    yield buffer.shift()!
  }
}

export { runAll, makeToolResult, makeToolError }
