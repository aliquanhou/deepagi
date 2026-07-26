import { Tool } from './Tool.js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { accessSync, constants } from 'node:fs'

export const ReadTool: Tool<{ file_path: string; offset?: number; limit?: number }, string> = {
  name: 'read',
  aliases: ['read_file'],
  searchHint: 'read file contents',
  inputSchema: {
    type: 'object',
    properties: {
      file_path: { type: 'string', description: 'Absolute path to the file to read' },
      offset: { type: 'number', description: 'Line number to start from (0-indexed)' },
      limit: { type: 'number', description: 'Number of lines to read' },
    },
    required: ['file_path'],
  },

  description() {
    return 'Read the contents of a file from the filesystem'
  },

  isConcurrencySafe() {
    return true // Reads are safe to parallelize
  },

  isReadOnly() {
    return true
  },

  isEnabled() {
    return true
  },

  async call(args) {
    const filePath = resolve(process.cwd(), args.file_path)
    try {
      accessSync(filePath, constants.R_OK)
    } catch {
      return { data: `Error: Cannot read file ${args.file_path} — no read permission or file does not exist` }
    }

    try {
      const content = readFileSync(filePath, 'utf-8')
      const lines = content.split('\n')
      const offset = args.offset ?? 0
      const limit = args.limit ?? lines.length

      const selected = lines.slice(offset, offset + limit)
      const lineNumWidth = String(offset + selected.length).length
      const numbered = selected.map((line, i) => {
        const lineNum = String(offset + i + 1).padStart(lineNumWidth, ' ')
        return `${lineNum}\t${line}`
      })

      return { data: numbered.join('\n') }
    } catch (error: any) {
      return { data: `Error reading file: ${error.message}` }
    }
  },
}
