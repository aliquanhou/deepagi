'use client'

import { useEffect, useRef } from 'react'
import type { Message } from '@/store/chat'

/**
 * Auto-scroll to bottom whenever messages change.
 * Always scrolls to the latest content.
 */
export function useAutoScroll(messages: Message[], _isStreaming: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  const userScrolledUp = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const handleScroll = () => {
      // User scrolled up if more than 150px from bottom
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
      userScrolledUp.current = distFromBottom > 150
    }

    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (!ref.current) return
    // Always scroll to bottom when messages update (while streaming or not scrolled up)
    if (!userScrolledUp.current) {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        if (ref.current) {
          ref.current.scrollTop = ref.current.scrollHeight
        }
      })
    }
  }, [messages])

  return ref
}
