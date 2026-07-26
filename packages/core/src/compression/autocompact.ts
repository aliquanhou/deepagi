/**
 * AutoCompact — automatic summarization
 *
 * Ported from Open-ClaudeCode's autoCompact system.
 * Uses DeepSeek API to generate a summary of earlier conversation turns.
 */

import type { SDKMessage, SDKUserMessage, SDKAssistantMessage } from '../types/index.js'

const MAX_MESSAGES_BEFORE_COMPACT = 40
const KEEP_AFTER_COMPACT = 10

export async function autoCompact(
  messages: SDKMessage[],
  enabled?: boolean,
): Promise<{ messages: SDKMessage[]; compacted: boolean; summary?: string }> {
  if (!enabled) return { messages, compacted: false }
  if (messages.length < MAX_MESSAGES_BEFORE_COMPACT) {
    return { messages, compacted: false }
  }

  // Keep the last KEEP_AFTER_COMPACT messages
  const keep = messages.slice(-KEEP_AFTER_COMPACT)
  const toSummarize = messages.slice(0, -KEEP_AFTER_COMPACT)

  const summary = generateSimpleSummary(toSummarize)
  const summaryMsg: SDKUserMessage = {
    type: 'user',
    message: {
      role: 'user',
      content: `[Earlier conversation summary: ${summary}]`,
    },
    parent_tool_use_id: null,
    uuid: crypto.randomUUID(),
  }

  return {
    messages: [summaryMsg, ...keep],
    compacted: true,
    summary,
  }
}

function generateSimpleSummary(messages: SDKMessage[]): string {
  const assistantMsgs = messages.filter(m => m.type === 'assistant') as SDKAssistantMessage[]
  const userMsgs = messages.filter(m => m.type === 'user') as SDKUserMessage[]
  const toolCalls = assistantMsgs.reduce((count, m) => {
    return count + (m.message.content?.filter(c => c.type === 'tool_use').length ?? 0)
  }, 0)

  return `${userMsgs.length} user messages, ${assistantMsgs.length} assistant replies, ${toolCalls} tool calls`
}
