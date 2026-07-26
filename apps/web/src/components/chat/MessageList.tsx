'use client'

import { useEffect, useRef, forwardRef } from 'react'
import { MessageBubble } from './MessageBubble'
import { useChatStore, selectActiveMessages } from '@/store/chat'
import { useAutoScroll } from '@/hooks/useAutoScroll'

export function MessageList() {
  const messages = useChatStore(selectActiveMessages)
  const isStreaming = useChatStore(s => s.isStreaming)
  const scrollRef = useAutoScroll(messages, isStreaming)

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md">
          <div className="text-4xl">🧠</div>
          <h2 className="text-xl font-semibold">Welcome to DeepAGI</h2>
          <p className="text-sm text-muted-foreground">
            Your open-source AI agent powered by DeepSeek.
            Ask me anything — I can help with code, files, research, and more.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
      <div className="max-w-3xl mx-auto space-y-4">
        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
      </div>
    </div>
  )
}
