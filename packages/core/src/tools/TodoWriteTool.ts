/**
 * DeepAGI TodoWriteTool
 *
 * Port of Open-ClaudeCode's TodoWriteTool.
 * Appends an item to a local todo list.
 */

import { Tool } from './Tool.js'
import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const TODO_FILE = '.deepagi-todo.md'

export const TodoWriteTool: Tool<{ todo: string; priority?: 'high' | 'medium' | 'low' }, boolean> = {
  name: 'todo_write',
  searchHint: 'write todo items',
  inputSchema: {
    type: 'object',
    properties: {
      todo: { type: 'string', description: 'The todo item text' },
      priority: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Priority level' },
    },
    required: ['todo'],
  },
  description: () => 'Append a todo item to the project todo list',
  isConcurrencySafe: () => false,
  isReadOnly: () => false,
  isEnabled: () => true,
  async call(args) {
    const filePath = resolve(process.cwd(), TODO_FILE)
    const icon = args.priority === 'high' ? '🔴' : args.priority === 'medium' ? '🟡' : '🟢'
    const prefix = args.priority ? `[${args.priority}] ` : ''
    const line = `- [ ] ${icon} ${prefix}${args.todo}\n`

    if (!existsSync(filePath)) {
      appendFileSync(filePath, `# TODO\n\n${line}`, 'utf-8')
    } else {
      appendFileSync(filePath, line, 'utf-8')
    }
    return { data: true }
  },
}
