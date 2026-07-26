'use client'

import dynamic from 'next/dynamic'
import { MessageList } from './MessageList'
import { MessageInput } from './MessageInput'
import { useChat } from '@/hooks/useChat'
import { useChatStore } from '@/store/chat'

export function ChatContainer() {
  const { sendMessage, stopStreaming, isStreaming, error } = useChat()
  const createConv = useChatStore(s => s.createConversation)
  const activeId = useChatStore(s => s.activeConversationId)

  // Auto-create first conversation
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

      {/* Input */}
      <MessageInput
        onSend={sendMessage}
        onStop={stopStreaming}
        isStreaming={isStreaming}
      />
    </div>
  )
}
