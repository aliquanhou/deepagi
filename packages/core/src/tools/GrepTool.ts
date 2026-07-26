import { Tool } from './Tool.js'
import { execSync } from 'node:child_process'
import { resolve } from 'node:path'

export const GrepTool: Tool<{ pattern: string; path?: string; glob?: string }, string> = {
  name: 'grep',
  searchHint: 'search file contents',
  inputSchema: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Search pattern (regex)' },
      path: { type: 'string', description: 'Directory to search' },
      glob: { type: 'string', description: 'File pattern filter (e.g., *.ts)' },
    },
    required: ['pattern'],
  },

  description() {
    return 'Search file contents using regular expressions'
  },

  isConcurrencySafe() {
    return true
  },

  isReadOnly() {
    return true
  },

  isEnabled() {
    return true
  },

  async call(args) {
    try {
      const searchPath = args.path ? resolve(process.cwd(), args.path) : '.'
      let cmd = `rg --line-number --heading "${args.pattern}" "${searchPath}"`
      if (args.glob) {
        cmd += ` --glob "${args.glob}"`
      }
      const output = execSync(cmd, { encoding: 'utf-8', timeout: 15000 })
      return { data: output || '(no matches)' }
    } catch (error: any) {
      if (error.status === 1) {
        return { data: '(no matches)' }
      }
      return { data: `Error: ${error.message}` }
    }
  },
}
