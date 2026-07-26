import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'DeepAGI',
  description: 'The best open-source agent powered by DeepSeek',
  other: {
    'google': 'notranslate',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark" translate="no">
      <body className={`${inter.className} h-screen overflow-hidden`}>
        {children}
      </body>
    </html>
  )
}
