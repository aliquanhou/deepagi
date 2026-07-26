/**
 * Microcompact — lazy inline compression
 *
 * Ported from Open-ClaudeCode's microcompact system.
 * Merges consecutive short messages and trims verbose tool results.
 * No API calls — operates entirely on message heuristics.
 */

import type { SDKMessage, SDKUserMessage } from '../types/index.js'

const MAX_TOOL_RESULT_CHARS = 3000

export function microcompact(messages: SDKMessage[]): { messages: SDKMessage[] } {
  if (messages.length === 0) return { messages }

  const result: SDKMessage[] = []

  for (const msg of messages) {
    if (msg.type === 'user') {
      const userMsg = msg as SDKUserMessage
      const content = userMsg.message.content

      // Truncate long tool results
      if (Array.isArray(content)) {
        const truncated = content.map(c => {
          if (c.type === 'tool_result' && typeof c.content === 'string' && c.content.length > MAX_TOOL_RESULT_CHARS) {
            return {
              ...c,
              content: c.content.slice(0, MAX_TOOL_RESULT_CHARS) +
                `\n...(truncated, ${c.content.length - MAX_TOOL_RESULT_CHARS} more chars)`,
            }
          }
          return c
        })
        result.push({ ...userMsg, message: { ...userMsg.message, content: truncated } })
        continue
      }
    }
    result.push(msg)
  }

  return { messages: result }
}
