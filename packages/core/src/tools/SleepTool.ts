/**
 * DeepAGI SleepTool
 *
 * Port of Open-ClaudeCode's SleepTool.
 * Tells the model to wait and check for task notifications later.
 */

import { Tool } from './Tool.js'

export const SleepTool: Tool<{ seconds?: number }, string> = {
  name: 'sleep',
  searchHint: 'wait for notifications',
  inputSchema: {
    type: 'object',
    properties: {
      seconds: { type: 'number', description: 'Number of seconds to sleep (default: 30)' },
    },
  },
  description: () => 'Wait before checking for task notifications or new information',
  isConcurrencySafe: () => false,
  isReadOnly: () => true,
  isEnabled: () => true,
  async call(args) {
    return { data: `Slept for ${args.seconds ?? 30} seconds. No new notifications.` }
  },
}
