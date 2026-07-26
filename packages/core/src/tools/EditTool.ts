import { Tool } from './Tool.js'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Performs exact string replacement in a file.
 * Ported from Open-ClaudeCode's FileEditTool.
 */
export const EditTool: Tool<
  { file_path: string; old_string: string; new_string: string },
  { applied: boolean; diff?: string }
> = {
  name: 'edit',
  aliases: ['file_edit'],
  searchHint: 'edit file contents',
  inputSchema: {
    type: 'object',
    properties: {
      file_path: { type: 'string', description: 'Absolute path to the file to edit' },
      old_string: { type: 'string', description: 'Text to replace (must match exactly)' },
      new_string: { type: 'string', description: 'Replacement text' },
    },
    required: ['file_path', 'old_string', 'new_string'],
  },

  description() {
    return 'Perform exact string replacements in a file'
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

  async call(args) {
    const filePath = resolve(process.cwd(), args.file_path)
    try {
      const content = readFileSync(filePath, 'utf-8')
      const count = content.split(args.old_string).length - 1

      if (count === 0) {
        return {
          data: { applied: false },
        }
      }

      const newContent = content.replaceAll(args.old_string, args.new_string)
      writeFileSync(filePath, newContent, 'utf-8')

      return {
        data: { applied: true, diff: `Replaced ${count} occurrence(s)` },
      }
    } catch (error: any) {
      return { data: { applied: false } }
    }
  },
}
