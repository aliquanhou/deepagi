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
  // Buffer text until we know whether tool calls exist
  const textBufferRef = useRef<string>('')
  const hasToolCallsRef = useRef(false)
  // Track whether we've already flushed the initial text buffer
  const flushedRef = useRef(false)

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
    textBufferRef.current = ''
    hasToolCallsRef.current = false
    flushedRef.current = false

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

    /** Flush buffered text to the store (called when tool calls arrive or stream ends) */
    const flushBuffer = () => {
      if (textBufferRef.current && !flushedRef.current) {
        flushedRef.current = true
        store.updateLastAssistantContent(textBufferRef.current)
      }
    }

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
                textBufferRef.current += chunk.text
                // If we already have tool calls, flush text immediately after tool cards
                if (hasToolCallsRef.current) {
                  store.updateLastAssistantContent(textBufferRef.current)
                  flushedRef.current = true
                }
                break
              case 'tool_use_start':
                // First tool call? flush buffered text
                if (!hasToolCallsRef.current) {
                  hasToolCallsRef.current = true
                  flushBuffer()
                }
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

      // Flush any remaining text at the end of stream
      if (textBufferRef.current && !flushedRef.current) {
        store.updateLastAssistantContent(textBufferRef.current)
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
