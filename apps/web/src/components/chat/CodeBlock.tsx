'use client'

import { useState } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

type CodeBlockProps = {
  code: string
  language?: string
}

export function CodeBlock({ code, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const detectedLang = language || detectLanguage(code)

  return (
    <div className="relative group my-3 rounded-lg overflow-hidden border border-border">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-muted/80 text-xs text-muted-foreground">
        <span>{detectedLang || 'code'}</span>
        <button
          onClick={handleCopy}
          className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-foreground"
        >
          {copied ? '✅ Copied!' : '📋 Copy'}
        </button>
      </div>

      {/* Code */}
      <SyntaxHighlighter
        language={detectedLang || 'text'}
        style={oneDark}
        customStyle={{
          margin: 0,
          borderRadius: 0,
          fontSize: '0.8rem',
          lineHeight: '1.5',
        }}
        showLineNumbers
      >
        {code.trimEnd()}
      </SyntaxHighlighter>
    </div>
  )
}

function detectLanguage(code: string): string | null {
  // Heuristic detection
  if (/^import\s|^export\s|^const\s|^function\s|^interface\s|^type\s/.test(code.trim())) return 'typescript'
  if (/^#!/.test(code.trim()) || /^\$\s/.test(code.trim())) return 'bash'
  if (/^<[a-z]+[\s>]/.test(code.trim()) || /^<\/?[a-z]+/.test(code.trim())) return 'html'
  if (/^{[\s\S]*}$/.test(code.trim()) && /"[^"]+"\s*:/.test(code)) return 'json'
  if (/^SELECT\s|^FROM\s|^WHERE\s/i.test(code.trim())) return 'sql'
  if (/^import\s+\w+\s+from/.test(code.trim())) return 'javascript'
  if (/^#\s|^def\s|^class\s.*:$/.test(code.trim())) return 'python'
  if (/^fn\s|^pub\s|^let\s|^impl\s/.test(code.trim())) return 'rust'
  if (/^package\s|^func\s|^import\s\(/.test(code.trim())) return 'go'
  return null
}
