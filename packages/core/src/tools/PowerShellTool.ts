/**
 * DeepAGI PowerShellTool
 *
 * Port of Open-ClaudeCode's PowerShellTool.
 * Executes PowerShell commands on Windows.
 */

import { Tool } from './Tool.js'
import { execSync } from 'node:child_process'
import { platform } from 'node:os'

export const PowerShellTool: Tool<{ command: string }, string> = {
  name: 'powershell',
  searchHint: 'execute PowerShell',
  inputSchema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'PowerShell command to execute' },
    },
    required: ['command'],
  },
  description: () => 'Execute PowerShell commands (Windows only)',
  isConcurrencySafe: () => false,
  isReadOnly: () => false,
  isEnabled: () => platform() === 'win32',
  async call(args) {
    if (platform() !== 'win32') {
      return { data: 'PowerShell tool is only available on Windows' }
    }
    try {
      const output = execSync(`powershell -Command "${args.command.replace(/"/g, '\\"')}"`, {
        encoding: 'utf-8',
        timeout: 30000,
        maxBuffer: 10 * 1024 * 1024,
      })
      return { data: output || '(no output)' }
    } catch (error: any) {
      if (error.stdout) {
        return { data: error.stdout + (error.stderr ? `\nSTDERR:\n${error.stderr}` : '') }
      }
      return { data: `Error: ${error.message}` }
    }
  },
}
