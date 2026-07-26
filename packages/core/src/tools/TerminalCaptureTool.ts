/**
 * DeepAGI TerminalCaptureTool
 *
 * Port of Open-ClaudeCode's TerminalCaptureTool.
 * Captures terminal output from background processes.
 */

import { Tool } from './Tool.js'

type Capture = { id: string; label: string; output: string; pid?: number }
const captures = new Map<string, Capture>()

export const TerminalCaptureTool: Tool<{ action: 'start' | 'read' | 'stop'; label?: string; captureId?: string }, string> = {
  name: 'terminal_capture',
  searchHint: 'capture terminal output',
  inputSchema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['start', 'read', 'stop'], description: 'Capture action' },
      label: { type: 'string', description: 'Label for the capture session' },
      captureId: { type: 'string', description: 'ID of capture to read/stop' },
    },
    required: ['action'],
  },
  description: () => 'Capture terminal output from background processes',
  isConcurrencySafe: () => false,
  isReadOnly: () => false,
  isEnabled: () => true,
  async call(args) {
    switch (args.action) {
      case 'start': {
        const id = crypto.randomUUID().slice(0, 8)
        captures.set(id, { id, label: args.label ?? 'unnamed', output: '' })
        return { data: JSON.stringify({ captureId: id }) }
      }
      case 'read': {
        if (!args.captureId) return { data: 'captureId required' }
        const cap = captures.get(args.captureId)
        return { data: cap?.output ?? '(capture not found)' }
      }
      case 'stop': {
        if (!args.captureId) return { data: 'captureId required' }
        captures.delete(args.captureId)
        return { data: 'Capture stopped' }
      }
    }
  },
}
