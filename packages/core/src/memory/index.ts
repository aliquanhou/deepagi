/**
 * DeepAGI Memory System
 *
 * Ported from Open-ClaudeCode's memory/memdir system.
 * Provides persistent memory via MEMORY.md index + individual memory files.
 * Stores memories as Markdown files in .deepagi/memory/.
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve, join, basename, extname } from 'node:path'

const MEMORY_DIR = '.deepagi/memory'
const INDEX_FILE = 'MEMORY.md'

// ============================================================================
// Types
// ============================================================================

export type MemoryEntry = {
  name: string
  description: string
  content: string
  type: 'user' | 'feedback' | 'project' | 'reference'
  tags: string[]
  createdAt: string
  updatedAt: string
}

// ============================================================================
// Directory Management
// ============================================================================

function ensureMemoryDir(cwd?: string): string {
  const dir = cwd ? resolve(cwd, MEMORY_DIR) : resolve(process.cwd(), MEMORY_DIR)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}

function getIndexPath(dir: string): string {
  return resolve(dir, '..', INDEX_FILE)
}

// ============================================================================
// Memory CRUD
// ============================================================================

/**
 * List all memories with their metadata.
 */
export function listMemories(cwd?: string): MemoryEntry[] {
  const dir = ensureMemoryDir(cwd)
  const memories: MemoryEntry[] = []

  if (!existsSync(dir)) return memories

  const files = readdirSync(dir).filter(f => f.endsWith('.md'))
  for (const file of files) {
    const content = readFileSync(join(dir, file), 'utf-8')
    const entry = parseMemoryFile(content, file)
    if (entry) memories.push(entry)
  }

  return memories
}

/**
 * Read a single memory by name.
 */
export function getMemory(name: string, cwd?: string): MemoryEntry | null {
  const dir = ensureMemoryDir(cwd)
  const filePath = join(dir, `${sanitizeName(name)}.md`)
  if (!existsSync(filePath)) return null

  const content = readFileSync(filePath, 'utf-8')
  return parseMemoryFile(content, `${name}.md`)
}

/**
 * Save a memory entry.
 */
export function saveMemory(entry: MemoryEntry, cwd?: string): void {
  const dir = ensureMemoryDir(cwd)
  const filePath = join(dir, `${sanitizeName(entry.name)}.md`)

  const now = new Date().toISOString()
  const existing = existsSync(filePath) ? readFileSync(filePath, 'utf-8') : null
  const createdAt = existing ? extractCreatedAt(existing) ?? now : now

  const content = formatMemoryFile(entry, createdAt)
  writeFileSync(filePath, content, 'utf-8')

  // Update MEMORY.md index
  updateIndex(dir, entry)
}

/**
 * Delete a memory by name.
 */
export function deleteMemory(name: string, cwd?: string): boolean {
  const dir = ensureMemoryDir(cwd)
  const filePath = join(dir, `${sanitizeName(name)}.md`)
  if (!existsSync(filePath)) return false

  try {
    writeFileSync(filePath, '') // Clear content (soft delete)
    return true
  } catch {
    return false
  }
}

/**
 * Find memories matching a search query.
 */
export function searchMemories(query: string, cwd?: string): MemoryEntry[] {
  const q = query.toLowerCase()
  return listMemories(cwd).filter(
    m =>
      m.name.toLowerCase().includes(q) ||
      m.description.toLowerCase().includes(q) ||
      m.content.toLowerCase().includes(q) ||
      m.tags.some(t => t.toLowerCase().includes(q)),
  )
}

// ============================================================================
// Helpers
// ============================================================================

function sanitizeName(name: string): string {
  return name.replace(/[^a-z0-9-]/gi, '_').toLowerCase()
}

function parseMemoryFile(content: string, fileName: string): MemoryEntry | null {
  // Parse frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!frontmatterMatch) return null

  const frontmatter = frontmatterMatch[1]!
  const body = frontmatterMatch[2]!.trim()

  const name = extractField(frontmatter, 'name') ?? basename(fileName, extname(fileName))
  const description = extractField(frontmatter, 'description') ?? ''
  const typeField = extractField(frontmatter, 'type') ?? 'reference'
  const metadataMatch = frontmatter.match(/tags:\s*\[(.*?)\]/)

  return {
    name,
    description,
    content: body,
    type: typeField as MemoryEntry['type'],
    tags: metadataMatch ? metadataMatch[1]!.split(',').map(t => t.trim().replace(/['"]/g, '')) : [],
    createdAt: extractField(frontmatter, 'createdAt') ?? new Date().toISOString(),
    updatedAt: extractField(frontmatter, 'updatedAt') ?? new Date().toISOString(),
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

function extractField(frontmatter: string, key: string): string | null {
  const match = frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))
  return match ? match[1]!.trim() : null
}

function extractCreatedAt(content: string): string | null {
  return extractField(content.split('---')[1] ?? '', 'createdAt')
}

function updateIndex(dir: string, entry: MemoryEntry): void {
  const indexPath = getIndexPath(dir)
  const line = `- [${entry.name}](${entry.name}.md) — ${entry.description}\n`

  let indexContent = ''
  if (existsSync(indexPath)) {
    indexContent = readFileSync(indexPath, 'utf-8')

    // Replace existing line or append
    const regex = new RegExp(`- \\[${escapeRegex(entry.name)}\\]\\([^)]+\\) — .*\\n?`)
    if (regex.test(indexContent)) {
      indexContent = indexContent.replace(regex, line)
    } else {
      indexContent += line
    }
  } else {
    indexContent = `# Memory Index\n\n${line}`
  }

  writeFileSync(indexPath, indexContent, 'utf-8')
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
