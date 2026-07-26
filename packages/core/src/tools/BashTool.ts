import { Tool } from './Tool.js'
import { ToolUseContext } from './ToolUseContext.js'
import { execSync } from 'node:child_process'
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

export const BashTool: Tool<{ command: string; description?: string }, string> = {
  name: 'bash',
  searchHint: 'execute shell commands',
  inputSchema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Shell command to execute' },
      description: { type: 'string', description: 'What this command does' },
    },
    required: ['command'],
  },

  description() {
    return 'Execute a shell command'
  },

  isConcurrencySafe() {
    return false // Shell is stateful — no concurrency
  },

  isReadOnly(input) {
    // Commands like cat, ls, echo, head, tail are read-only
    const readOnlyPrefixes = ['cat ', 'ls ', 'echo ', 'head ', 'tail ', 'pwd ', 'which ', 'type ']
    return readOnlyPrefixes.some(p => input.command.trim().startsWith(p))
  },

  isEnabled() {
    return true
  },

  async call(args, context) {
    try {
      const output = execSync(args.command, {
        encoding: 'utf-8',
        timeout: 30000,
        cwd: process.cwd(),
        maxBuffer: 10 * 1024 * 1024, // 10MB
      })
      return { data: output }
    } catch (error: any) {
      if (error.stdout) {
        return { data: error.stdout + (error.stderr ? `\nSTDERR:\n${error.stderr}` : '') }
      }
      return { data: `Error: ${error.message}` }
    }
  },
}
