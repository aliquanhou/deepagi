'use client'

import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'

type Props = {
  onSend: (content: string) => void
  onStop: () => void
  isStreaming: boolean
}

export function MessageInput({ onSend, onStop, isStreaming }: Props) {
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = Math.min(el.scrollHeight, 200) + 'px'
    }
  }, [input])

  // Focus on mount
  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const handleSend = () => {
    const trimmed = input.trim()
    if (!trimmed || isStreaming) return
    onSend(trimmed)
    setInput('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="border-t border-border bg-card px-4 py-4">
      <div className="max-w-3xl mx-auto flex gap-2 items-end">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask DeepAGI anything... (Shift+Enter for new line)"
          className="min-h-[44px] max-h-[200px]"
          rows={1}
          disabled={isStreaming}
        />
        {isStreaming ? (
          <Button
            variant="destructive"
            size="icon"
            onClick={onStop}
            className="shrink-0 h-[44px] w-[44px]"
            title="Stop generating"
          >
            ⏹
          </Button>
        ) : (
          <Button
            onClick={handleSend}
            size="icon"
            disabled={!input.trim()}
            className="shrink-0 h-[44px] w-[44px]"
            title="Send message"
          >
            ➤
          </Button>
        )}
      </div>
    </div>
  )
}
