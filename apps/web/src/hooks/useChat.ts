/**
 * useChat Hook
 *
 * Manages chat state, sends messages via SSE, and streams responses.
 */

'use client'

import { useCallback, useRef } from 'react'
import { useChatStore } from '@/store/chat'
import { generateId } from '@/lib/utils'

export type StreamChunk =
  | { type: 'text_delta'; text: string }
  | { type: 'tool_use_start'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; id: string; result: string; isError?: boolean }
  | { type: 'done' }
  | { type: 'error'; message: string }

export function useChat() {
  const store = useChatStore()
  const abortRef = useRef<AbortController | null>(null)
  const accumulatedRef = useRef<string>('')

  const sendMessage = useCallback(async (content: string) => {
    let convId = store.activeConversationId
    if (!convId) {
      convId = store.createConversation()
    }

    // Add user message
    store.addMessage({
      id: generateId(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    })

    // Create assistant message placeholder
    const assistantId = generateId()
    store.addMessage({
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
    })
    store.setStreaming(true)
    store.setError(null)
    accumulatedRef.current = ''

    // Get conversation history
    const state = useChatStore.getState()
    const conv = state.conversations.find(c => c.id === convId)
    const msgs = conv?.messages ?? []

    const history = msgs
      .filter(m => m.id !== assistantId)
      .slice(-30)
      .map(m => ({
        role: m.role,
        content: m.content,
        toolCalls: m.toolCalls?.map(tc => ({
          name: tc.name,
          input: tc.input,
          result: tc.result,
        })),
      }))

    const abortController = new AbortController()
    abortRef.current = abortController

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content, history }),
        signal: abortController.signal,
      })

      if (!response.ok) {
        const errText = await response.text().catch(() => 'Unknown error')
        throw new Error(`HTTP ${response.status}: ${errText}`)
      }

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data: ')) continue

          const data = trimmed.slice(6)
          if (data === '[DONE]') continue

          try {
            const chunk: StreamChunk = JSON.parse(data)

            switch (chunk.type) {
              case 'text_delta':
                accumulatedRef.current += chunk.text
                store.updateLastAssistantContent(accumulatedRef.current)
                break
              case 'tool_use_start':
                store.addToolCall({
                  id: chunk.id,
                  name: chunk.name,
                  input: chunk.input,
                  status: 'running',
                })
                break
              case 'tool_result':
                store.updateToolCall(chunk.id, {
                  result: chunk.result,
                  isError: chunk.isError,
                  status: chunk.isError ? 'error' : 'completed',
                })
                break
              case 'error':
                store.setError(chunk.message)
                break
            }
          } catch {
            // Skip malformed JSON lines
          }
        }
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        store.setError(error.message ?? 'Request failed')
      }
    } finally {
      store.setStreaming(false)
      abortRef.current = null
    }
  }, [store])

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort()
    store.setStreaming(false)
  }, [store])

  return { sendMessage, stopStreaming, isStreaming: store.isStreaming, error: store.error }
}
