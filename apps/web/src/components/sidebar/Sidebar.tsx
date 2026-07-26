'use client'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useChatStore, selectActiveConversation } from '@/store/chat'
import { formatTimestamp } from '@/lib/utils'

export function Sidebar() {
  const conversations = useChatStore(s => s.conversations)
  const activeId = useChatStore(s => s.activeConversationId)
  const setActive = useChatStore(s => s.setActiveConversation)
  const createConv = useChatStore(s => s.createConversation)
  const deleteConv = useChatStore(s => s.deleteConversation)

  return (
    <div className="w-[260px] border-r bg-white flex flex-col h-full" style={{borderColor:'#e2e8f0'}}>
      {/* Header */}
      <div className="p-4 border-b" style={{borderColor:'#e2e8f0'}}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">🧠</span>
          <span className="font-bold text-sm">DeepAGI</span>
        </div>
        <Button
          onClick={createConv}
          variant="secondary"
          className="w-full text-xs"
          size="sm"
        >
          + New conversation
        </Button>
      </div>

      {/* Conversation list */}
      <ScrollArea className="flex-1 p-2">
        {conversations.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-8">
            No conversations yet
          </div>
        ) : (
          <div className="space-y-1">
            {conversations.map(conv => (
              <div key={conv.id} className="group relative">
                <button
                  onClick={() => setActive(conv.id)}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-md text-xs transition-colors',
                    conv.id === activeId
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-accent/50',
                  )}
                >
                  <div className="font-medium truncate">
                    {conv.title}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {formatTimestamp(conv.updatedAt)}
                    {' · '}
                    {conv.messages.length} messages
                  </div>
                </button>
                <button
                  onClick={() => deleteConv(conv.id)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100
                             text-muted-foreground hover:text-destructive text-xs p-1 rounded
                             transition-opacity"
                  title="Delete conversation"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      <div className="p-3 border-t border-border text-[11px] text-center" style={{color:'#64748b'}}>
        <div>DeepAGI · Open source</div>
        <div className="mt-0.5" style={{color:'#94a3b8'}}>首席架构师 于秋鸿博士</div>
      </div>
    </div>
  )
}
