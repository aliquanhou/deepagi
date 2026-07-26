'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { ToolCall } from '@/store/chat'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

const statusIcons: Record<string, string> = {
  pending: '⏳',
  running: '🔄',
  completed: '✅',
  error: '❌',
}

const statusColors: Record<string, string> = {
  pending: 'text-muted-foreground',
  running: 'text-blue-500',
  completed: 'text-green-500',
  error: 'text-red-500',
}

export function ToolCallCard({ toolCall }: { toolCall: ToolCall }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Card className="my-2 border-l-4 border-l-blue-500/50">
      <CardHeader className="py-2 px-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-sm font-medium w-full text-left"
        >
          <span className={statusColors[toolCall.status]}>
            {statusIcons[toolCall.status]}
          </span>
          <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
            {toolCall.name}
          </span>
          <span className="text-xs text-muted-foreground flex-1">
            {toolCall.status}
          </span>
          <span className="text-muted-foreground text-xs">
            {expanded ? '▲' : '▼'}
          </span>
        </button>
      </CardHeader>
      {expanded && (
        <CardContent className="py-2 px-3 space-y-2 text-xs">
          <div>
            <span className="text-muted-foreground font-medium">Input:</span>
            <pre className="mt-1 bg-muted p-2 rounded overflow-x-auto">
              {JSON.stringify(toolCall.input, null, 2)}
            </pre>
          </div>
          {toolCall.result && (
            <div>
              <span className="text-muted-foreground font-medium">Result:</span>
              <pre className={cn(
                'mt-1 bg-muted p-2 rounded overflow-x-auto max-h-40 overflow-y-auto',
                toolCall.isError && 'text-red-500',
              )}>
                {toolCall.result}
              </pre>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
