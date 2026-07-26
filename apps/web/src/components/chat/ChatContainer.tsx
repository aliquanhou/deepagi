'use client'

import { MessageList } from './MessageList'
import { MessageInput } from './MessageInput'
import { useChat } from '@/hooks/useChat'
import { useChatStore } from '@/store/chat'

function formatTokens(n: number): string {
  if (n < 1000) return `${n}`
  return `${(n / 1000).toFixed(1)}K`
}

export function ChatContainer() {
  const { sendMessage, stopStreaming, isStreaming, error } = useChat()
  const createConv = useChatStore(s => s.createConversation)
  const activeId = useChatStore(s => s.activeConversationId)
  const totalTokens = useChatStore(s => s.totalTokens)
  const totalCostUSD = useChatStore(s => s.totalCostUSD)

  if (!activeId && typeof window !== 'undefined') {
    createConv()
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Error banner */}
      {error && (
        <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-2 text-xs text-destructive">
          ⚠ {error}
        </div>
      )}

      {/* Messages */}
      <MessageList />

      {/* Token / Cost bar */}
      <div className="border-t px-4 py-1.5 flex items-center gap-4 text-[10px]" style={{backgroundColor:'#f8fafc',color:'#94a3b8',borderColor:'#e2e8f0'}}>
        <span>Tokens: <strong style={{color:'#64748b'}}>{formatTokens(totalTokens)}</strong></span>
        <span>Cost: <strong style={{color:'#64748b'}}>${totalCostUSD.toFixed(4)}</strong></span>
        <span className="ml-auto">🧠 DeepAGI</span>
      </div>

      {/* Input */}
      <MessageInput
        onSend={sendMessage}
        onStop={stopStreaming}
        isStreaming={isStreaming}
      />
    </div>
  )
}
