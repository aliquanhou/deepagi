/**
 * DeepAGI Tool Orchestrator
 *
 * Ported from Open-ClaudeCode's toolOrchestration.ts.
 * Partitions tools by concurrency-safety, parallel for read-only, serial for writes.
 * No engine-level enforcement — model-agnostic.
 */

import { findToolByName, type Tool, type ToolResult } from './Tool.js'
import type { ToolUseContext } from './ToolUseContext.js'
import type { SDKMessage, SDKAssistantMessage, SDKUserMessage } from '../types/index.js'

export type ToolUseBlock = { id: string; name: string; input: Record<string, unknown> }
export type MessageUpdate = { message?: SDKMessage; newContext: ToolUseContext }

type MessageUpdateLazy = {
  message?: SDKMessage
  contextModifier?: { toolUseID: string; modifyContext: (ctx: ToolUseContext) => ToolUseContext }
}

type Batch = { isConcurrencySafe: boolean; blocks: ToolUseBlock[] }
const MAX_CONCURRENCY = 10

// ============================================================================
// Main
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
          (qcm[update.contextModifier.toolUseID] ??= []).push(update.contextModifier.modifyContext)
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
      if (update.contextModifier) currentContext = update.contextModifier.modifyContext(currentContext)
      yield { message: update.message, newContext: currentContext }
    }
    toolUseContext.setInProgressToolUseIDs(prev => { const n = new Set(prev); n.delete(toolUse.id); return n })
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
  const tasks = toolUseBlocks.map(tu => async function* () {
    toolUseContext.setInProgressToolUseIDs(prev => new Set(prev).add(tu.id))
    yield* executeTool(tu, assistantMessages, toolUseContext)
    toolUseContext.setInProgressToolUseIDs(prev => { const n = new Set(prev); n.delete(tu.id); return n })
  })
  yield* runAll(tasks, MAX_CONCURRENCY)
}

// ============================================================================
// Execute
// ============================================================================

async function* executeTool(
  toolUse: ToolUseBlock,
  _assistantMessages: SDKAssistantMessage[],
  toolUseContext: ToolUseContext,
): AsyncGenerator<MessageUpdateLazy, void> {
  const tool = findToolByName(toolUseContext.options.tools, toolUse.name)
  if (!tool) { yield { message: makeToolError(toolUse.id, `Unknown tool: ${toolUse.name}`) }; return }
  if (tool.validateInput) {
    const v = await tool.validateInput(toolUse.input, toolUseContext)
    if (!v.result) { yield { message: makeToolError(toolUse.id, v.message) }; return }
  }
  try {
    const result = await tool.call(toolUse.input, toolUseContext)
    yield {
      message: makeToolResult(toolUse.id, result),
      contextModifier: result.contextModifier ? { toolUseID: toolUse.id, modifyContext: result.contextModifier } : undefined,
    }
  } catch (error: unknown) {
    yield { message: makeToolError(toolUse.id, error instanceof Error ? error.message : String(error)) }
  }
}

function makeToolResult(toolUseId: string, result: ToolResult<unknown>): SDKUserMessage {
  const content = typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2)
  return { type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: toolUseId, content }] }, parent_tool_use_id: toolUseId, uuid: crypto.randomUUID() }
}

function makeToolError(toolUseId: string, error: string): SDKUserMessage {
  return { type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: toolUseId, content: error, is_error: true }] }, parent_tool_use_id: toolUseId, uuid: crypto.randomUUID() }
}

// ============================================================================
// Concurrency
// ============================================================================

async function* runAll(
  generators: Array<() => AsyncGenerator<MessageUpdateLazy, void>>,
  concurrency: number,
): AsyncGenerator<MessageUpdateLazy, void> {
  const buffer: MessageUpdateLazy[] = []
  const running = new Set<Promise<void>>()
  let i = 0
  const runner = async (gen: () => AsyncGenerator<MessageUpdateLazy, void>) => { for await (const v of gen()) buffer.push(v) }
  for (; i < Math.min(concurrency, generators.length); i++) running.add(runner(generators[i]!))
  for (; i < generators.length; i++) {
    await Promise.race(running)
    for (const p of running) { if (await Promise.race([p.then(() => true), Promise.resolve(false)])) { running.delete(p); break } }
    running.add(runner(generators[i]!))
  }
  await Promise.all(running)
  while (buffer.length > 0) yield buffer.shift()!
}

export { runAll, makeToolResult, makeToolError }
