'use client'

import { useState } from 'react'

type DataTableProps = {
  markdown: string
}

type TableData = {
  headers: string[]
  rows: string[][]
  caption?: string
}

export function DataTable({ markdown }: DataTableProps) {
  const table = parseMarkdownTable(markdown)
  if (!table) return null

  const [sortColumn, setSortColumn] = useState<number | null>(null)
  const [sortAsc, setSortAsc] = useState(true)

  const sortedRows = sortColumn !== null
    ? [...table.rows].sort((a, b) => {
        const valA = a[sortColumn] ?? ''
        const valB = b[sortColumn] ?? ''
        const cmp = valA.localeCompare(valB, undefined, { numeric: true })
        return sortAsc ? cmp : -cmp
      })
    : table.rows

  const handleSort = (colIdx: number) => {
    if (sortColumn === colIdx) {
      setSortAsc(!sortAsc)
    } else {
      setSortColumn(colIdx)
      setSortAsc(true)
    }
  }

  return (
    <div className="my-3 overflow-x-auto rounded-lg border border-border">
      {table.caption && (
        <div className="px-4 py-1.5 text-xs text-muted-foreground bg-muted/50 border-b border-border">
          {table.caption}
        </div>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50">
            {table.headers.map((h, i) => (
              <th
                key={i}
                className="px-4 py-2 text-left font-medium text-xs cursor-pointer hover:bg-muted select-none"
                onClick={() => handleSort(i)}
              >
                {h} {sortColumn === i ? (sortAsc ? '▲' : '▼') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, ri) => (
            <tr key={ri} className="border-t border-border hover:bg-muted/30">
              {row.map((cell, ci) => (
                <td key={ci} className="px-4 py-1.5 text-xs">
                  {formatCell(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

type MarkdownTable = {
  headers: string[]
  rows: string[][]
  caption?: string
}

function parseMarkdownTable(md: string): MarkdownTable | null {
  const lines = md.trim().split('\n')
  if (lines.length < 2) return null

  // Find the separator line
  const sepIdx = lines.findIndex(l => /^\|?[\s-:|]+\|?$/.test(l.trim()))
  if (sepIdx < 1) return null

  const headers = parseRow(lines[sepIdx - 1]!)
  if (!headers || headers.length === 0) return null

  const rows: string[][] = []
  for (let i = sepIdx + 1; i < lines.length; i++) {
    const row = parseRow(lines[i]!)
    if (row) rows.push(row)
  }

  return { headers, rows }
}

function parseRow(line: string): string[] | null {
  const trimmed = line.trim()
  if (!trimmed.startsWith('|') && !trimmed.endsWith('|')) return null
  return trimmed
    .split('|')
    .filter(c => c.trim())
    .map(c => c.trim().replace(/^\[([^\]]+)\]\([^)]+\)$/, '$1'))
}

function formatCell(cell: string): React.ReactNode {
  // Bold
  if (/^\*\*(.+)\*\*$/.test(cell.trim())) {
    return <strong>{cell.trim().slice(2, -2)}</strong>
  }
  // Number
  if (/^[\d,.%$¥€]+$/.test(cell.trim())) {
    return <span className="font-mono text-right">{cell.trim()}</span>
  }
  // Status badges
  if (/^✅|^❌|^🟢|^🔴|^🟡/.test(cell.trim())) {
    return <span className="text-xs">{cell.trim()}</span>
  }
  return cell.trim()
}
