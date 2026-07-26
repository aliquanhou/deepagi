import { Tool } from './Tool.js'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

export const WriteTool: Tool<{ file_path: string; content: string; append?: boolean }, { written: boolean }> = {
  name: 'write',
  aliases: ['write_file', 'create'],
  searchHint: 'create or write files',
  inputSchema: {
    type: 'object',
    properties: {
      file_path: { type: 'string', description: 'Absolute path to the file to write' },
      content: { type: 'string', description: 'Content to write to the file' },
      append: { type: 'boolean', description: 'Append to file instead of overwriting' },
    },
    required: ['file_path', 'content'],
  },

  description() {
    return 'Create or overwrite a file with new content'
  },

  isConcurrencySafe() {
    return false // Writes must be serialized
  },

  isReadOnly() {
    return false
  },

  isEnabled() {
    return true
  },

  interruptBehavior() {
    return 'cancel'
  },

  async call(args) {
    const filePath = resolve(process.cwd(), args.file_path)
    try {
      mkdirSync(dirname(filePath), { recursive: true })
      const flag = args.append ? 'a' : 'w'
      writeFileSync(filePath, args.content, { encoding: 'utf-8', flag })
      return { data: { written: true } }
    } catch (error: any) {
      return { data: { written: false }, newMessages: [] }
    }
  },
}
