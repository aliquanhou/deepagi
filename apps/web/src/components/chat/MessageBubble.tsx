'use client'

import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { ToolCallCard } from './ToolCallCard'
import { SmartContent } from './SmartContent'
import type { Message } from '@/store/chat'

export function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div className={cn(
        'max-w-[85%] space-y-1',
        isUser && 'order-1',
      )}>
        {/* Role label with icon */}
        <div className={cn(
          'flex items-center gap-1.5 text-xs font-medium px-1',
          isUser ? 'text-right justify-end text-primary' : 'text-left justify-start text-muted-foreground',
        )}>
          <span>{isUser ? '👤' : '🧠'}</span>
          <span>{isUser ? 'You' : 'DeepAGI'}</span>
        </div>

        {/* Message content */}
        <Card className={cn(
          'px-4 py-3',
          isUser
            ? 'bg-primary text-primary-foreground border-primary/50 rounded-2xl rounded-tr-sm'
            : 'bg-card border-border/50 rounded-2xl rounded-tl-sm',
        )}>
          {/* Empty/thinking state */}
          {!message.content && isAssistant && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="animate-pulse">●</span>
              <span className="animate-pulse animation-delay-200">●</span>
              <span className="animate-pulse animation-delay-400">●</span>
            </div>
          )}

          {/* Smart rendered content */}
          {message.content && (
            <div className={cn(
              'prose prose-sm max-w-none',
              isUser ? 'prose-invert' : 'prose-gray dark:prose-invert',
            )}>
              <SmartContent content={message.content} />
            </div>
          )}

          {/* Tool calls */}
          {message.toolCalls && message.toolCalls.length > 0 && (
            <div className="mt-3 space-y-1.5 border-t border-border/50 pt-3">
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
