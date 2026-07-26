'use client'

import { Sidebar } from '@/components/sidebar/Sidebar'
import { ChatContainer } from '@/components/chat/ChatContainer'

export default function Home() {
  return (
    <main className="flex h-screen">
      <Sidebar />
      <ChatContainer />
    </main>
  )
}
