'use client'

import { CodeBlock } from './CodeBlock'
import { DataTable } from './DataTable'
import { JsonCard } from './JsonCard'

// ============================================================================
// Content Type Detection
// ============================================================================

export type ContentType = 'text' | 'code' | 'table' | 'json' | 'mixed'

export type ContentSegment = {
  type: ContentType
  content: string
  language?: string
}

/**
 * Parse a text block into typed segments for smart rendering.
 */
export function parseContent(text: string): ContentSegment[] {
  if (!text) return [{ type: 'text', content: '' }]

  const segments: ContentSegment[] = []

  // Split by code blocks
  const parts = text.split(/(```(\w*)\n?[\s\S]*?```)/g)
  let i = 0
  while (i < parts.length) {
    const part = parts[i]!
    if (part.startsWith('```')) {
      // Code block
      const match = part.match(/^```(\w*)\n?([\s\S]*?)```$/)
      if (match) {
        segments.push({ type: 'code', content: match[2]!, language: match[1] || undefined })
      }
    } else {
      // Non-code — check for tables and JSON
      const textSegments = splitTextContent(part)
      segments.push(...textSegments)
    }
    i++
  }

  return segments.length > 0 ? segments : [{ type: 'text', content: text }]
}

function splitTextContent(text: string): ContentSegment[] {
  if (!text.trim()) return []

  const segments: ContentSegment[] = []
  const lines = text.split('\n')

  // Check for JSON content
  const jsonMatch = text.match(/^(\{[\s\S]*\}|\[[\s\S]*\])$/)
  if (jsonMatch) {
    try {
      JSON.parse(jsonMatch[1]!)
      segments.push({ type: 'json', content: jsonMatch[1]! })
      return segments
    } catch {
      // Not valid JSON, continue
    }
  }

  // Check for tables
  let tableBuffer: string[] = []
  let inTable = false

  for (const line of lines) {
    const isTableLine = line.trim().startsWith('|') && line.trim().endsWith('|')

    if (isTableLine) {
      tableBuffer.push(line)
      inTable = true
    } else {
      if (inTable && tableBuffer.length >= 2) {
        segments.push({ type: 'table', content: tableBuffer.join('\n') })
        tableBuffer = []
        inTable = false
      }
      if (tableBuffer.length === 1) {
        // Orphaned table line — treat as text
        segments.push({ type: 'text', content: tableBuffer[0]! + '\n' })
        tableBuffer = []
        inTable = false
      }
      if (line.trim()) {
        segments.push({ type: 'text', content: line + '\n' })
      }
    }
  }

  // Flush remaining table
  if (inTable && tableBuffer.length >= 2) {
    segments.push({ type: 'table', content: tableBuffer.join('\n') })
  }

  return segments
}

// ============================================================================
// Smart Renderer
// ============================================================================

type SmartContentProps = {
  content: string
}

export function SmartContent({ content }: SmartContentProps) {
  const segments = parseContent(content)

  return (
    <>
      {segments.map((seg, i) => {
        switch (seg.type) {
          case 'code':
            return <CodeBlock key={i} code={seg.content} language={seg.language} />
          case 'table':
            return <DataTable key={i} markdown={seg.content} />
          case 'json':
            return <JsonCard key={i} data={seg.content} />
          case 'text':
          default:
            return <TextContent key={i} text={seg.content} />
        }
      })}
    </>
  )
}

// ============================================================================
// Text Content (inline formatting)
// ============================================================================

function TextContent({ text }: { text: string }) {
  // Process inline formatting
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)

  return (
    <span className="whitespace-pre-wrap text-sm leading-relaxed">
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code
              key={i}
              className="bg-muted px-1 py-0.5 rounded text-xs font-mono"
            >
              {part.slice(1, -1)}
            </code>
          )
        }
        return part
      })}
    </span>
  )
}
