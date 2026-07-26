'use client'

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
          <h2 className="text-xl font-semibold" style={{color:'#0f172a'}}>Welcome to DeepAGI</h2>
          <p className="text-sm" style={{color:'#64748b'}}>
            Your open-source AI agent. Ask me anything — I can help with code, files, research, and more.
          </p>
          <div className="pt-4 text-xs" style={{color:'#94a3b8'}}>
            🧠 DeepAGI · 首席架构师 于秋鸿博士
          </div>
        </div>
      </div>
    )
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
      <div className="max-w-3xl mx-auto">
        {messages.map((msg, i) => (
          <div key={msg.id} className={i > 0 ? 'mt-3' : ''}>
            <MessageBubble message={msg} />
          </div>
        ))}
      </div>
    </div>
  )
}
