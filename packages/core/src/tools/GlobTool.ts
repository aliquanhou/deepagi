import { Tool } from './Tool.js'
import { readdirSync, statSync } from 'node:fs'
import { resolve, relative, sep } from 'node:path'

/**
 * Minimal glob implementation using Node.js fs.
 * Ported from Open-ClaudeCode's GlobTool.
 * Avoids dependency on `glob` package or experimental node:fs.globSync.
 */
function globSync(pattern: string, cwd: string): string[] {
  // Simple patterns only: **/*.ext or *.ext
  const results: string[] = []
  const hasRecursive = pattern.startsWith('**/')
  const ext = pattern.replace('**/', '')

  function walk(dir: string, relativePath: string): void {
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      return
    }

    for (const entry of entries) {
      const fullPath = resolve(dir, entry)
      const relPath = relativePath ? `${relativePath}/${entry}` : entry

      try {
        const stat = statSync(fullPath)
        if (stat.isDirectory()) {
          if (hasRecursive) {
            walk(fullPath, relPath)
          }
        } else if (hasRecursive) {
          // **/*.ts — check extension
          if (ext === '' || entry.endsWith(ext.replace('*', ''))) {
            results.push(relPath)
          }
        }
      } catch {
        // Skip inaccessible entries
      }
    }
  }

  walk(cwd, '')
  return results
}

export const GlobTool: Tool<{ pattern: string; path?: string }, string[]> = {
  name: 'glob',
  searchHint: 'find files by pattern',
  inputSchema: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Glob pattern (e.g., **/*.ts)' },
      path: { type: 'string', description: 'Directory to search in (defaults to cwd)' },
    },
    required: ['pattern'],
  },

  description() {
    return 'Find files matching a glob pattern'
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
      const basePath = args.path ? resolve(process.cwd(), args.path) : process.cwd()
      const files = globSync(args.pattern, basePath)
      return { data: files }
    } catch {
      return { data: [] }
    }
  },
}
