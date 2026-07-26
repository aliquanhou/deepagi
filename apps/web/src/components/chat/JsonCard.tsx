'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'

type JsonCardProps = {
  data: string
}

export function JsonCard({ data }: JsonCardProps) {
  const [expanded, setExpanded] = useState(false)

  let parsed: any
  let valid = false
  let preview = ''

  try {
    parsed = JSON.parse(data)
    valid = true
    preview = Array.isArray(parsed) ? `Array[${parsed.length}]` : `Object{${Object.keys(parsed).length}}`
  } catch {
    preview = data.slice(0, 100)
  }

  return (
    <Card className="my-2 border-l-4 border-l-amber-500/50">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-4 py-2 flex items-center gap-2 text-sm"
      >
        <span>{valid ? '📦' : '📄'}</span>
        <span className="font-mono text-xs text-muted-foreground">{preview}</span>
        <span className="ml-auto text-xs text-muted-foreground">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && valid && (
        <div className="px-4 pb-3">
          <pre className="text-xs bg-muted p-3 rounded overflow-x-auto max-h-96 overflow-y-auto">
            {JSON.stringify(parsed, null, 2)}
          </pre>
        </div>
      )}
    </Card>
  )
}
