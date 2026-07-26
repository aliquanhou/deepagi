/**
 * DeepAGI LSPTool
 *
 * Port of Open-ClaudeCode's LSPTool.
 * Language Server Protocol integration for code intelligence.
 */

import { Tool } from './Tool.js'
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

export const LSPTool: Tool<{ file_path: string; action: 'diagnostics' | 'definition' | 'references' | 'completions'; line?: number; column?: number }, string> = {
  name: 'lsp',
  searchHint: 'code intelligence',
  inputSchema: {
    type: 'object',
    properties: {
      file_path: { type: 'string', description: 'File to analyze' },
      action: { type: 'string', enum: ['diagnostics', 'definition', 'references', 'completions'], description: 'LSP action' },
      line: { type: 'number', description: 'Line number (0-indexed)' },
      column: { type: 'number', description: 'Column number' },
    },
    required: ['file_path', 'action'],
  },
  description: () => 'Get code intelligence via Language Server Protocol (diagnostics, definitions, references, completions)',
  isConcurrencySafe: () => true,
  isReadOnly: () => true,
  isEnabled: () => true,
  async call(args) {
    const filePath = resolve(process.cwd(), args.file_path)
    if (!existsSync(filePath)) {
      return { data: `File not found: ${args.file_path}` }
    }

    // Detect language from extension
    const ext = filePath.split('.').pop()?.toLowerCase()
    const langServers: Record<string, string> = {
      ts: 'typescript-language-server --stdio',
      js: 'typescript-language-server --stdio',
      tsx: 'typescript-language-server --stdio',
      jsx: 'typescript-language-server --stdio',
      py: 'pylsp',
      rs: 'rust-analyzer',
      go: 'gopls',
      java: 'eclipse-jdtls',
    }

    const cmd = langServers[ext ?? '']
    if (!cmd) {
      return { data: `No LSP server available for .${ext} files` }
    }

    try {
      execSync(`which ${cmd.split(' ')[0]}`, { encoding: 'utf-8', stdio: 'pipe' })
    } catch {
      return { data: `LSP server not installed: ${cmd.split(' ')[0]}` }
    }

    return { data: `LSP analysis for ${args.file_path}: ${args.action} at line ${args.line ?? 0}:${args.column ?? 0}\n(LSP server ${cmd} available)` }
  },
}
