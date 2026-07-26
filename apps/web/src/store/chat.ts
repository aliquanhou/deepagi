/**
 * DeepAGI Chat Store
 *
 * Zustand store with localStorage persistence.
 * Conversations survive page refresh via zustand/middleware persist.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { generateId } from '@/lib/utils'

// ============================================================================
// Types
// ============================================================================

export type ToolCall = {
  id: string
  name: string
  input: Record<string, unknown>
  result?: string
  isError?: boolean
  status: 'pending' | 'running' | 'completed' | 'error'
}

export type Message = {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  toolCalls?: ToolCall[]
}

export type Conversation = {
  id: string
  title: string
  messages: Message[]
  createdAt: string
  updatedAt: string
}

// ============================================================================
// Store State
// ============================================================================

export type ChatState = {
  conversations: Conversation[]
  activeConversationId: string | null
  isStreaming: boolean
  error: string | null
  totalTokens: number
  totalCostUSD: number

  // Actions
  createConversation: () => string
  deleteConversation: (id: string) => void
  setActiveConversation: (id: string) => void
  addMessage: (message: Message) => void
  updateLastAssistantContent: (content: string) => void
  addToolCall: (toolCall: ToolCall) => void
  updateToolCall: (id: string, updates: Partial<ToolCall>) => void
  setStreaming: (streaming: boolean) => void
  setError: (error: string | null) => void
  clearError: () => void
  setUsage: (tokens: number, cost: number) => void
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      conversations: [],
      activeConversationId: null,
      isStreaming: false,
      error: null,
      totalTokens: 0,
      totalCostUSD: 0,

      createConversation: () => {
        const id = generateId()
        const conv: Conversation = {
          id,
          title: 'New conversation',
          messages: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        set(state => ({
          conversations: [conv, ...state.conversations],
          activeConversationId: id,
        }))
        return id
      },

      deleteConversation: (id) => {
        set(state => ({
          conversations: state.conversations.filter(c => c.id !== id),
          activeConversationId:
            state.activeConversationId === id
              ? state.conversations.find(c => c.id !== id)?.id ?? null
              : state.activeConversationId,
        }))
      },

      setActiveConversation: (id) => {
        set({ activeConversationId: id })
      },

      addMessage: (message) => {
        set(state => ({
          conversations: state.conversations.map(c => {
            if (c.id !== state.activeConversationId) return c
            return {
              ...c,
              messages: [...c.messages, message],
              updatedAt: new Date().toISOString(),
              title: c.messages.length === 0 && message.role === 'user'
                ? message.content.slice(0, 60) + (message.content.length > 60 ? '...' : '')
                : c.title,
            }
          }),
        }))
      },

      updateLastAssistantContent: (content) => {
        set(state => ({
          conversations: state.conversations.map(c => {
            if (c.id !== state.activeConversationId) return c
            const messages = [...c.messages]
            const lastIdx = messages.length - 1
            if (lastIdx >= 0 && messages[lastIdx]!.role === 'assistant') {
              messages[lastIdx] = { ...messages[lastIdx]!, content }
            }
            return { ...c, messages }
          }),
        }))
      },

      addToolCall: (toolCall) => {
        set(state => ({
          conversations: state.conversations.map(c => {
            if (c.id !== state.activeConversationId) return c
            const messages = [...c.messages]
            const lastIdx = messages.length - 1
            if (lastIdx >= 0 && messages[lastIdx]!.role === 'assistant') {
              const msg = messages[lastIdx]!
              messages[lastIdx] = {
                ...msg,
                toolCalls: [...(msg.toolCalls ?? []), toolCall],
              }
            }
            return { ...c, messages }
          }),
        }))
      },

      updateToolCall: (id, updates) => {
        set(state => ({
          conversations: state.conversations.map(c => {
            if (c.id !== state.activeConversationId) return c
            return {
              ...c,
              messages: c.messages.map(m => ({
                ...m,
                toolCalls: m.toolCalls?.map(tc =>
                  tc.id === id ? { ...tc, ...updates } : tc,
                ),
              })),
            }
          }),
        }))
      },

      setStreaming: (isStreaming) => set({ isStreaming }),
      setError: (error) => set({ error }),
      clearError: () => set({ error: null }),
      setUsage: (tokens, cost) => set({ totalTokens: tokens, totalCostUSD: cost }),
    }),
    {
      name: 'deepagi-chat-storage',
      partialize: (state) => ({
        conversations: state.conversations,
        activeConversationId: state.activeConversationId,
      }),
    },
  ),
)

// Selectors
export const selectActiveConversation = (state: ChatState) =>
  state.conversations.find(c => c.id === state.activeConversationId)

export const selectActiveMessages = (state: ChatState): Message[] =>
  state.conversations.find(c => c.id === state.activeConversationId)?.messages ?? []
