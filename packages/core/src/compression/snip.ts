/**
 * Snip Compact — tail truncation
 *
 * Ported from Open-ClaudeCode's HISTORY_SNIP system.
 * Keeps the most recent N messages and discards the rest.
 * Simplest compression strategy — no API calls, pure logic.
 */

import type { SDKMessage } from '../types/index.js'

const DEFAULT_KEEP_LAST = 15

export function snipCompact(
  messages: SDKMessage[],
  keepLast?: number,
): { messages: SDKMessage[]; tokensFreed: number } {
  const keep = keepLast ?? DEFAULT_KEEP_LAST

  if (messages.length <= keep) {
    return { messages, tokensFreed: 0 }
  }

  const kept = messages.slice(-keep)
  const tokensFreed = messages.length - keep

  return { messages: kept, tokensFreed }
}
