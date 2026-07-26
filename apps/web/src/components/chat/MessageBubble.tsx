'use client'

import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { ToolCallCard } from './ToolCallCard'
import type { Message } from '@/store/chat'

export function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div className={cn(
        'max-w-[80%] space-y-1',
        isUser && 'order-1',
      )}>
        {/* Role label */}
        <div className={cn(
          'text-xs font-medium px-1',
          isUser ? 'text-right text-primary' : 'text-left text-muted-foreground',
        )}>
          {isUser ? 'You' : 'DeepAGI'}
        </div>

        {/* Message content */}
        <Card className={cn(
          'px-4 py-3',
          isUser
            ? 'bg-primary text-primary-foreground border-primary'
            : 'bg-card',
        )}>
          <div className="whitespace-pre-wrap text-sm leading-relaxed">
            {message.content || (isAssistant ? (
              <span className="text-muted-foreground italic animate-pulse">
                Thinking...
              </span>
            ) : '')}
          </div>

          {/* Tool calls */}
          {message.toolCalls && message.toolCalls.length > 0 && (
            <div className="mt-2 space-y-1">
              {message.toolCalls.map(tc => (
                <ToolCallCard key={tc.id} toolCall={tc} />
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
