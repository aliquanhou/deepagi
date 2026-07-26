/**
 * DeepAGI SendMessageTool
 *
 * Port of Open-ClaudeCode's SendMessageTool.
 * Sends messages between agents in multi-agent setups.
 */

import { Tool } from './Tool.js'

type InboxMessage = {
  from: string
  to: string
  content: string
  timestamp: number
}

const inbox = new Map<string, InboxMessage[]>()

export const SendMessageTool: Tool<{ to: string; message: string }, boolean> = {
  name: 'send_message',
  searchHint: 'send message to agent',
  inputSchema: {
    type: 'object',
    properties: {
      to: { type: 'string', description: 'Recipient agent name or team name' },
      message: { type: 'string', description: 'Message content' },
    },
    required: ['to', 'message'],
  },
  description: () => 'Send a message to another agent or teammate',
  isConcurrencySafe: () => false,
  isReadOnly: () => false,
  isEnabled: () => true,
  async call(args, context) {
    const from = context.agentId ?? 'main'
    if (!inbox.has(args.to)) {
      inbox.set(args.to, [])
    }
    inbox.get(args.to)!.push({
      from,
      to: args.to,
      content: args.message,
      timestamp: Date.now(),
    })
    return { data: true }
  },
}

export function readInbox(agentId: string): InboxMessage[] {
  return inbox.get(agentId) ?? []
}

export function clearInbox(agentId: string): void {
  inbox.delete(agentId)
}
