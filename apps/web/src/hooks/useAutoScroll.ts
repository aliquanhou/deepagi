'use client'

import { useEffect, useRef } from 'react'
import type { Message } from '@/store/chat'

export function useAutoScroll(deps: Message[], isStreaming: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  const shouldAutoScroll = useRef(true)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const handleScroll = () => {
      const threshold = 100
      shouldAutoScroll.current =
        el.scrollHeight - el.scrollTop - el.clientHeight < threshold
    }

    el.addEventListener('scroll', handleScroll)
    return () => el.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (shouldAutoScroll.current && ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight
    }
  }, [deps])

  return ref
}
