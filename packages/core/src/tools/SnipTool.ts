/**
 * DeepAGI SnipTool
 *
 * Port of Open-ClaudeCode's SnipTool (HISTORY_SNIP feature).
 * Truncates conversation history to free context window space.
 */

import { Tool } from './Tool.js'
import type { ToolUseContext } from './ToolUseContext.js'
import type { SDKMessage } from '../types/index.js'

export const SnipTool: Tool<{ keepLast?: number }, { messagesKept: number }> = {
  name: 'snip',
  aliases: ['force_snip'],
  searchHint: 'truncate conversation history',
  inputSchema: {
    type: 'object',
    properties: {
      keepLast: { type: 'number', description: 'Number of recent messages to keep (default: 10)' },
    },
  },
  description: () => 'Truncate conversation history to free context window. Keeps the most recent messages.',
  isConcurrencySafe: () => false,
  isReadOnly: () => false,
  isEnabled: () => true,
  async call(args, context: ToolUseContext) {
    const keepLast = args.keepLast ?? 10
    const messages = context.messages
    const kept = messages.slice(-keepLast)
    // Replace context's messages with truncated version
    context.messages.length = 0
    context.messages.push(...kept)
    return { data: { messagesKept: kept.length } }
  },
}
