'use client'

import type { ToolCall } from '@/store/chat'
import { Card } from '@/components/ui/card'

const statusIcons: Record<string, string> = {
  pending: '⏳',
  running: '🔄',
  completed: '✅',
  error: '❌',
}

const statusBorders: Record<string, string> = {
  pending: 'border-l-blue-400',
  running: 'border-l-blue-500',
  completed: 'border-l-green-500',
  error: 'border-l-red-500',
}

export function ToolCallCard({ toolCall }: { toolCall: ToolCall }) {
  const inputStr = JSON.stringify(toolCall.input, null, 2)

  return (
    <Card className={`my-2 border-l-4 ${statusBorders[toolCall.status]}`}>
      {/* Header */}
      <div className="px-3 py-2 flex items-center gap-2 text-sm border-b border-gray-100">
        <span>{statusIcons[toolCall.status]}</span>
        <span className="font-semibold text-xs uppercase tracking-wide text-gray-600">
          {toolCall.name}
        </span>
        <span className="ml-auto text-xs text-gray-400">
          {toolCall.status}
        </span>
      </div>

      {/* Input */}
      <div className="px-3 py-2">
        <div className="text-xs font-medium text-gray-500 mb-1">📥 Input:</div>
        <pre className="text-xs bg-gray-50 p-3 rounded overflow-x-auto whitespace-pre-wrap break-all">
          {inputStr}
        </pre>
      </div>

      {/* Output */}
      {toolCall.result && (
        <div className="px-3 py-2 border-t border-gray-100">
          <div className="text-xs font-medium text-gray-500 mb-1">
            {toolCall.isError ? '❌ Error:' : '📤 Output:'}
          </div>
          <pre className={`text-xs bg-gray-50 p-3 rounded overflow-x-auto whitespace-pre-wrap break-all ${toolCall.isError ? 'text-red-600' : ''}`}>
            {toolCall.result}
          </pre>
        </div>
      )}
    </Card>
  )
}
