/**
 * DeepAGI Tool Orchestrator
 *
 * Partitions tools by concurrency-safety.
 * Engine-level: detects consecutive bash calls and merges them with &&.
 */

import { findToolByName, type Tool, type ToolResult } from './Tool.js'
import type { ToolUseContext } from './ToolUseContext.js'
import type { SDKMessage, SDKAssistantMessage, SDKUserMessage, ContentBlock } from '../types/index.js'

// ============================================================================
// Types
// ============================================================================

export type ToolUseBlock = { id: string; name: string; input: Record<string, unknown> }

export type MessageUpdate = { message?: SDKMessage; newContext: ToolUseContext }

type MessageUpdateLazy = {
  message?: SDKMessage
  contextModifier?: { toolUseID: string; modifyContext: (ctx: ToolUseContext) => ToolUseContext }
}

type Batch = { isConcurrencySafe: boolean; blocks: ToolUseBlock[] }

const MAX_CONCURRENCY = 10

// ============================================================================
// Main Entry Point
// ============================================================================

export async function* runTools(
  toolUseBlocks: ToolUseBlock[],
  assistantMessages: SDKAssistantMessage[],
  toolUseContext: ToolUseContext,
): AsyncGenerator<MessageUpdate, void> {
  let currentContext = toolUseContext

  for (const { isConcurrencySafe, blocks } of partitionToolCalls(toolUseBlocks, currentContext)) {
    if (isConcurrencySafe) {
      const qcm: Record<string, Array<(ctx: ToolUseContext) => ToolUseContext>> = {}
      for await (const update of runToolsConcurrently(blocks, assistantMessages, currentContext)) {
        if (update.contextModifier) {
          const { toolUseID, modifyContext } = update.contextModifier
          if (!qcm[toolUseID]) qcm[toolUseID] = []
          qcm[toolUseID].push(modifyContext)
        }
        yield { message: update.message, newContext: currentContext }
      }
      for (const block of blocks) {
        for (const modifier of qcm[block.id] ?? []) currentContext = modifier(currentContext)
      }
      yield { newContext: currentContext }
    } else {
      for await (const update of runToolsSerially(blocks, assistantMessages, currentContext)) {
        if (update.newContext) currentContext = update.newContext
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
    const safe = tool ? safeCheck(tool, toolUse.input) : false
    if (safe && acc[acc.length - 1]?.isConcurrencySafe) {
      acc[acc.length - 1]!.blocks.push(toolUse)
    } else {
      acc.push({ isConcurrencySafe: safe, blocks: [toolUse] })
    }
    return acc
  }, [])
}

function safeCheck(tool: Tool, input: unknown): boolean {
  try { return tool.isConcurrencySafe(input as Record<string, unknown>) }
  catch { return false }
}

// ============================================================================
// Serial — with bash command merging
// ============================================================================

async function* runToolsSerially(
  toolUseBlocks: ToolUseBlock[],
  assistantMessages: SDKAssistantMessage[],
  toolUseContext: ToolUseContext,
): AsyncGenerator<MessageUpdate, void> {
  let currentContext = toolUseContext

  // Merge consecutive bash commands
  const merged = mergeConsecutiveBashCommands(toolUseBlocks)
  const mergeMap = buildMergeMap(toolUseBlocks, merged)

  for (const block of merged) {
    const isMerged = block.name === '__bash_merged__'
    const displayBlocks = isMerged ? (block as any).originalBlocks : [block]

    // Mark all as in-progress
    for (const db of displayBlocks) {
      currentContext.setInProgressToolUseIDs(prev => new Set(prev).add(db.id))
    }

    for await (const update of executeTool(block, assistantMessages, currentContext)) {
      if (update.contextModifier) {
        currentContext = update.contextModifier.modifyContext(currentContext)
      }
      yield { message: update.message, newContext: currentContext }
    }

    for (const db of displayBlocks) {
      currentContext.setInProgressToolUseIDs(prev => {
        const n = new Set(prev); n.delete(db.id); return n
      })
    }
  }
}

/**
 * Merge consecutive bash commands into a single combined command.
 * E.g. ["which python", "which node"] → "which python && which node"
 */
function mergeConsecutiveBashCommands(blocks: ToolUseBlock[]): ToolUseBlock[] {
  const result: ToolUseBlock[] = []
  let i = 0
  while (i < blocks.length) {
    if (blocks[i]!.name === 'bash' && i + 1 < blocks.length && blocks[i + 1]!.name === 'bash') {
      // Start a merge batch
      const batch: ToolUseBlock[] = []
      while (i < blocks.length && blocks[i]!.name === 'bash') {
        batch.push(blocks[i]!)
        i++
      }
      // Combine commands with &&
      const combined = batch
        .map(b => (b.input.command as string) || '')
        .filter(Boolean)
        .join(' && ')
      result.push({
        id: batch[0]!.id,
        name: '__bash_merged__',
        input: { command: combined, description: `Merged ${batch.length} commands` },
        originalBlocks: batch,
      } as any)
    } else {
      result.push(blocks[i]!)
      i++
    }
  }
  return result
}

function buildMergeMap(original: ToolUseBlock[], merged: ToolUseBlock[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const m of merged) {
    if ((m as any).originalBlocks) {
      for (const ob of (m as any).originalBlocks as ToolUseBlock[]) {
        map.set(ob.id, m.id)
      }
    }
  }
  return map
}

// ============================================================================
// Parallel
// ============================================================================

async function* runToolsConcurrently(
  toolUseBlocks: ToolUseBlock[],
  assistantMessages: SDKAssistantMessage[],
  toolUseContext: ToolUseContext,
): AsyncGenerator<MessageUpdateLazy, void> {
  const tasks = toolUseBlocks.map(toolUse => {
    return async function* (): AsyncGenerator<MessageUpdateLazy, void> {
      toolUseContext.setInProgressToolUseIDs(prev => new Set(prev).add(toolUse.id))
      yield* executeTool(toolUse, assistantMessages, toolUseContext)
      toolUseContext.setInProgressToolUseIDs(prev => {
        const n = new Set(prev); n.delete(toolUse.id); return n
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
  _assistantMessages: SDKAssistantMessage[],
  toolUseContext: ToolUseContext,
): AsyncGenerator<MessageUpdateLazy, void> {
  const toolName = toolUse.name === '__bash_merged__' ? 'bash' : toolUse.name
  const tool = findToolByName(toolUseContext.options.tools, toolName)
  if (!tool) {
    yield { message: makeToolError(toolUse.id, `Unknown tool: ${toolName}`) }
    return
  }

  if (tool.validateInput) {
    const v = await tool.validateInput(toolUse.input, toolUseContext)
    if (!v.result) { yield { message: makeToolError(toolUse.id, v.message) }; return }
  }

  try {
    const result = await tool.call(toolUse.input, toolUseContext)
    yield {
      message: makeToolResult(toolUse.id, result),
      contextModifier: result.contextModifier
        ? { toolUseID: toolUse.id, modifyContext: result.contextModifier }
        : undefined,
    }
  } catch (error: unknown) {
    yield { message: makeToolError(toolUse.id, error instanceof Error ? error.message : String(error)) }
  }
}

// ============================================================================
// Helpers
// ============================================================================

function makeToolResult(toolUseId: string, result: ToolResult<unknown>): SDKUserMessage {
  const content = typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2)
  return { type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: toolUseId, content }] }, parent_tool_use_id: toolUseId, uuid: crypto.randomUUID() }
}

function makeToolError(toolUseId: string, error: string): SDKUserMessage {
  return { type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: toolUseId, content: error, is_error: true }] }, parent_tool_use_id: toolUseId, uuid: crypto.randomUUID() }
}

// ============================================================================
// Concurrency Helper
// ============================================================================

async function* runAll(
  generators: Array<() => AsyncGenerator<MessageUpdateLazy, void>>,
  concurrency: number,
): AsyncGenerator<MessageUpdateLazy, void> {
  const buffer: MessageUpdateLazy[] = []
  let done = false

  async function runner(gen: () => AsyncGenerator<MessageUpdateLazy, void>): Promise<void> {
    for await (const val of gen()) {
      buffer.push(val)
    }
  }

  const running = new Set<Promise<void>>()
  let i = 0
  for (; i < Math.min(concurrency, generators.length); i++) running.add(runner(generators[i]!))
  for (; i < generators.length; i++) {
    await Promise.race(running)
    for (const p of running) {
      if (await Promise.race([p.then(() => true), Promise.resolve(false)])) { running.delete(p); break }
    }
    running.add(runner(generators[i]!))
  }
  await Promise.all(running)
  done = true

  while (buffer.length > 0) yield buffer.shift()!
}

export { runAll, makeToolResult, makeToolError }
