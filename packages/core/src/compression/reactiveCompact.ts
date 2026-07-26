/**
 * ReactiveCompact — error-triggered recovery compression
 *
 * Ported from Open-ClaudeCode's reactive compact system.
 * Only fires when the API returns prompt_too_long (413) or media size errors.
 * More aggressive than AutoCompact: keeps only the last 5 messages.
 */

import type { SDKMessage } from '../types/index.js'

const KEEP_AFTER_REACTIVE = 5

export async function reactiveCompact(
  messages: SDKMessage[],
  error: string,
): Promise<{ messages: SDKMessage[]; compacted: boolean }> {
  // Only trigger on prompt_too_long or media errors
  const isTriggerError =
    error.includes('prompt_too_long') ||
    error.includes('too long') ||
    error.includes('413') ||
    error.includes('token_limit') ||
    error.includes('media')

  if (!isTriggerError) {
    return { messages, compacted: false }
  }

  if (messages.length <= KEEP_AFTER_REACTIVE) {
    return { messages, compacted: false }
  }

  // Keep only the most recent messages (very aggressive)
  const keep = messages.slice(-KEEP_AFTER_REACTIVE)

  return { messages: keep, compacted: true }
}
