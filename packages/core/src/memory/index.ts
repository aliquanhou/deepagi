/**
 * DeepAGI Memory System
 *
 * Three-layer memory:
 * 1. In-process: crossSessionMemories array (same process, across requests)
 * 2. File-based: .deepagi/memory/ with MEMORY.md index (persistent across restarts)
 * 3. SQLite: optional, for better query performance
 *
 * File-based storage always works — no external dependencies required.
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve, join, basename, extname } from 'node:path'

const MEMORY_DIR = '.deepagi/memory'
const INDEX_FILE = 'MEMORY.md'

// ============================================================================
// Types
// ============================================================================

export type MemoryEntry = {
  id?: string
  name: string
  description: string
  content: string
  type: 'user' | 'feedback' | 'project' | 'reference' | 'fact' | 'summary'
  tags: string[]
  createdAt: string
  updatedAt: string
  sourceSessionId?: string
}

// ============================================================================
// In-process + file-backed store
// ============================================================================

const memories: MemoryEntry[] = []
let storeDir = ''

/**
 * Initialize the memory store. Always creates the file directory.
 */
export function initMemoryStore(cwd?: string): boolean {
  const base = cwd ?? process.cwd()
  storeDir = resolve(base, MEMORY_DIR)
  try {
    mkdirSync(storeDir, { recursive: true })
    if (existsSync(storeDir)) {
      for (const file of readdirSync(storeDir).filter(f => f.endsWith('.md'))) {
        const content = readFileSync(join(storeDir, file), 'utf-8')
        const entry = parseMemoryFile(content, file)
        if (entry) memories.push(entry)
      }
    }
    return true
  } catch {
    storeDir = ''
    return false
  }
}

/**
 * Store a memory entry. Persists to both in-process array and file.
 */
export function storeMemory(entry: MemoryEntry): MemoryEntry {
  const now = new Date().toISOString()
  const record: MemoryEntry = {
    ...entry,
    id: crypto.randomUUID(),
    createdAt: entry.createdAt || now,
    updatedAt: now,
  }
  memories.push(record)
  if (storeDir) {
    try {
      const fp = join(storeDir, `${sanitizeName(record.name)}.md`)
      const existing = existsSync(fp) ? readFileSync(fp, 'utf-8') : null
      writeFileSync(fp, formatMemoryFile(record, existing ? extractCreatedAt(existing) ?? now : now), 'utf-8')
      updateIndex(storeDir, record)
    } catch { /* non-critical */ }
  }
  return record
}

/**
 * Search memories by keyword matching.
 * Splits query into individual words for better natural language matching.
 */
export function searchMemories(query: string, limit = 10): MemoryEntry[] {
  const keywords = query.toLowerCase().split(/\s+/).filter((w: string) => w.length > 1)
  if (keywords.length === 0) return []

  return memories
    .filter((m: MemoryEntry) => {
      const haystack = (m.content + ' ' + m.name + ' ' + m.description + ' ' + m.tags.join(' ')).toLowerCase()
      return keywords.some((kw: string) => haystack.includes(kw))
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, limit)
}

/**
 * Format memories as a system prompt fragment for injection.
 */
export function formatMemoriesForPrompt(memories: MemoryEntry[]): string {
  if (memories.length === 0) return ''
  const lines = memories.map((m, i) =>
    `[Memory ${i + 1}] ${m.type.toUpperCase()}: ${m.description}\n${m.content.slice(0, 500)}`
  )
  return `\nRelevant memories from previous sessions:\n${lines.join('\n---\n')}\n`
}

/**
 * Auto-generate a summary memory from a conversation turn.
 */
export function createTurnMemory(
  sessionId: string | undefined,
  userMessage: string,
  assistantResponse: string,
): MemoryEntry {
  const words = (userMessage + ' ' + assistantResponse).toLowerCase()
  const tags: string[] = []
  if (words.includes('project')) tags.push('project')
  if (words.includes('config') || words.includes('setting')) tags.push('config')
  if (words.includes('react') || words.includes('vue') || words.includes('angular')) tags.push('framework')
  if (words.includes('install') || words.includes('dep') || words.includes('npm')) tags.push('dependencies')
  if (tags.length === 0) tags.push('general')

  return {
    name: `turn-${Date.now().toString(36)}`,
    description: userMessage.slice(0, 80),
    content: `User: ${userMessage.slice(0, 200)}\nAssistant: ${assistantResponse.slice(0, 500)}`,
    type: 'summary',
    tags,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sourceSessionId: sessionId,
  }
}

// ============================================================================
// Legacy CRUD
// ============================================================================

export function listMemories(): MemoryEntry[] { return [...memories] }
export function getMemory(name: string): MemoryEntry | undefined { return memories.find(m => m.name === sanitizeName(name)) }
export function saveMemory(entry: MemoryEntry): void { storeMemory(entry) }

export function deleteMemory(name: string): boolean {
  const sn = sanitizeName(name)
  const idx = memories.findIndex(m => sanitizeName(m.name) === sn)
  if (idx === -1) return false
  memories.splice(idx, 1)
  if (storeDir) { try { writeFileSync(join(storeDir, `${sn}.md`), '', 'utf-8') } catch {} }
  return true
}

// ============================================================================
// Helpers
// ============================================================================

function sanitizeName(name: string): string {
  return name.replace(/[^a-z0-9-]/gi, '_').toLowerCase()
}

function parseMemoryFile(content: string, fileName: string): MemoryEntry | null {
  const fm = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!fm) return null
  const front = fm[1]!
  return {
    name: extractField(front, 'name') ?? basename(fileName, extname(fileName)),
    description: extractField(front, 'description') ?? '',
    content: fm[2]!.trim(),
    type: (extractField(front, 'type') ?? 'reference') as MemoryEntry['type'],
    tags: (() => {
      const m = front.match(/tags:\s*\[(.*?)\]/)
      return m ? m[1]!.split(',').map(t => t.trim().replace(/['"]/g, '')) : []
    })(),
    createdAt: extractField(front, 'createdAt') ?? new Date().toISOString(),
    updatedAt: extractField(front, 'updatedAt') ?? new Date().toISOString(),
  }
}

function formatMemoryFile(entry: MemoryEntry, createdAt: string): string {
  return `---
name: ${sanitizeName(entry.name)}
description: ${entry.description}
metadata:
  type: ${entry.type}
createdAt: ${createdAt}
updatedAt: ${new Date().toISOString()}
tags: [${entry.tags.join(', ')}]
---

${entry.content}
`
}

function extractField(fm: string, key: string): string | null {
  const m = fm.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))
  return m ? m[1]!.trim() : null
}

function extractCreatedAt(c: string): string | null {
  return extractField(c.split('---')[1] ?? '', 'createdAt')
}

function updateIndex(dir: string, entry: MemoryEntry): void {
  const indexPath = resolve(dir, '..', INDEX_FILE)
  const line = `- [${entry.name}](${entry.name}.md) — ${entry.description}\n`
  try {
    let content = ''
    if (existsSync(indexPath)) {
      content = readFileSync(indexPath, 'utf-8')
      const re = new RegExp(`- \\[${escapeRegex(entry.name)}\\]\\([^)]+\\) — .*\\n?`)
      content = re.test(content) ? content.replace(re, line) : content + line
    } else {
      content = `# Memory Index\n\n${line}`
    }
    writeFileSync(indexPath, content, 'utf-8')
  } catch {}
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
