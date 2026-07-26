/**
 * DeepAGI NotebookEditTool
 *
 * Port of Open-ClaudeCode's NotebookEditTool.
 * Edit Jupyter notebook cells.
 */

import { Tool } from './Tool.js'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

export const NotebookEditTool: Tool<{
  notebook_path: string
  cell_id?: string
  new_source: string
  cell_type?: 'code' | 'markdown'
  edit_mode?: 'replace' | 'insert' | 'delete'
}, boolean> = {
  name: 'notebook_edit',
  searchHint: 'edit Jupyter notebooks',
  inputSchema: {
    type: 'object',
    properties: {
      notebook_path: { type: 'string', description: 'Path to .ipynb file' },
      cell_id: { type: 'string', description: 'Cell ID to edit' },
      new_source: { type: 'string', description: 'New source for the cell' },
      cell_type: { type: 'string', enum: ['code', 'markdown'], description: 'Type of cell (for insert)' },
      edit_mode: { type: 'string', enum: ['replace', 'insert', 'delete'], description: 'Edit operation' },
    },
    required: ['notebook_path', 'new_source'],
  },
  description: () => 'Edit Jupyter notebook cells',
  isConcurrencySafe: () => false,
  isReadOnly: () => false,
  isEnabled: () => true,
  async call(args) {
    const filePath = resolve(process.cwd(), args.notebook_path)
    if (!existsSync(filePath)) {
      return { data: false }
    }
    try {
      const content = readFileSync(filePath, 'utf-8')
      const notebook = JSON.parse(content)
      const cells = notebook.cells ?? []
      const idx = args.cell_id
        ? cells.findIndex((c: any) => c.id === args.cell_id)
        : cells.length - 1

      if (idx < 0) return { data: false }

      const mode = args.edit_mode ?? 'replace'
      if (mode === 'delete' && idx >= 0) {
        notebook.cells.splice(idx, 1)
      } else if (mode === 'insert') {
        notebook.cells.splice(idx + 1, 0, {
          id: crypto.randomUUID().slice(0, 12),
          cell_type: args.cell_type ?? 'code',
          source: args.new_source.split('\n'),
        })
      } else if (mode === 'replace' && idx >= 0) {
        notebook.cells[idx] = {
          ...notebook.cells[idx],
          source: args.new_source.split('\n'),
        }
      }

      writeFileSync(filePath, JSON.stringify(notebook, null, 2), 'utf-8')
      return { data: true }
    } catch {
      return { data: false }
    }
  },
}
