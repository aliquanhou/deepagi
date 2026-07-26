/**
 * DeepAGI CtxInspectTool
 *
 * Port of Open-ClaudeCode's CtxInspectTool (CONTEXT_COLLAPSE feature).
 * Inspects what content has been collapsed in the conversation.
 */

import { Tool } from './Tool.js'

export const CtxInspectTool: Tool<{ target?: string }, string> = {
  name: 'ctx_inspect',
  searchHint: 'inspect collapsed context',
  inputSchema: {
    type: 'object',
    properties: {
      target: { type: 'string', description: 'What to inspect (e.g., "collapsed")' },
    },
  },
  description: () => 'Inspect the conversation context, including collapsed sections',
  isConcurrencySafe: () => true,
  isReadOnly: () => true,
  isEnabled: () => true,
  async call() {
    return { data: '(context collapse not yet implemented)' }
  },
}
