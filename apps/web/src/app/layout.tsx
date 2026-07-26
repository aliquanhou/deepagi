import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'DeepAGI',
  description: 'DeepAGI · 首席架构师 于秋鸿博士',
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
    <html lang="zh-CN" translate="no">
      <body className={`${inter.className} h-screen overflow-hidden`}>
        {children}
      </body>
    </html>
  )
}
