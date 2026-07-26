/**
 * DeepAGI BriefTool
 *
 * Port of Open-ClaudeCode's BriefTool.
 * Provides a brief/concise response mode.
 */

import { Tool } from './Tool.js'

export const BriefTool: Tool<{ instruction: string }, string> = {
  name: 'brief',
  searchHint: 'concise instruction',
  inputSchema: {
    type: 'object',
    properties: {
      instruction: { type: 'string', description: 'Brief instruction to follow' },
    },
    required: ['instruction'],
  },
  description: () => 'Give a concise instruction to the model',
  isConcurrencySafe: () => true,
  isReadOnly: () => true,
  isEnabled: () => true,
  async call(args) {
    return { data: `[Brief instruction received]: ${args.instruction}\n(Continue with brief responses)` }
  },
}
