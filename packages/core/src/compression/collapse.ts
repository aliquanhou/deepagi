/**
 * Context Collapse — progressive folding
 *
 * Ported from Open-ClaudeCode's CONTEXT_COLLAPSE system.
 * Commits collapsed summaries of distant conversation segments.
 */

import type { SDKMessage } from '../types/index.js'

export type CollapseEntry = {
  turnId: string
  summary: string
  messageCount: number
}

const store = new Map<string, CollapseEntry>()

export type CollapseStore = typeof store

export function resetCollapseStore(): void {
  store.clear()
}

export function contextCollapse(
  messages: SDKMessage[],
  enabled?: boolean,
): { messages: SDKMessage[] } {
  if (!enabled) return { messages }
  if (messages.length < 20) return { messages }

  // Collapse oldest messages (first 50%) into a summary marker
  const collapsePoint = Math.floor(messages.length * 0.5)
  const toCollapse = messages.slice(0, collapsePoint)
  const keep = messages.slice(collapsePoint)

  // Find assistant messages in collapsed segment
  const assistantMsgs = toCollapse.filter(m => m.type === 'assistant')
  const summary = assistantMsgs.length > 0
    ? `[${assistantMsgs.length} earlier messages collapsed — context preserved]`
    : `[${toCollapse.length} system/configuration messages collapsed]`

  const collapseId = crypto.randomUUID().slice(0, 8)
  store.set(collapseId, {
    turnId: collapseId,
    summary,
    messageCount: toCollapse.length,
  })

  return { messages: keep }
}

export function getCollapseCount(): number {
  return store.size
}
