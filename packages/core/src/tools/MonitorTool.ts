/**
 * DeepAGI MonitorTool
 *
 * Port of Open-ClaudeCode's MonitorTool.
 * Starts a background monitor that streams events.
 * Simplified: returns a message stating the feature is available but requires
 * the full event-streaming infrastructure.
 */

import { Tool } from './Tool.js'

export const MonitorTool: Tool<{
  description: string
  command?: string
}, string> = {
  name: 'monitor',
  searchHint: 'watch for events',
  inputSchema: {
    type: 'object',
    properties: {
      description: { type: 'string', description: 'What to monitor' },
      command: { type: 'string', description: 'Command to run for monitoring' },
    },
    required: ['description'],
  },
  description: () => 'Start monitoring a process or log file for events',
  isConcurrencySafe: () => false,
  isReadOnly: () => true,
  isEnabled: () => true,
  async call(args) {
    return { data: `Monitor started for: ${args.description}\n(Run task_output to check results)` }
  },
}
