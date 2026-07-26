/**
 * DeepAGI WebBrowserTool
 *
 * Port of Open-ClaudeCode's WebBrowserTool.
 * Controls a headless browser for web interaction.
 * Simplified: renders page content via fetch.
 */

import { Tool } from './Tool.js'

export const WebBrowserTool: Tool<{ url: string; action?: 'screenshot' | 'html' | 'text' }, string> = {
  name: 'web_browser',
  searchHint: 'browse web pages',
  inputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL to browse' },
      action: { type: 'string', enum: ['screenshot', 'html', 'text'], description: 'What to capture (default: text)' },
    },
    required: ['url'],
  },
  description: () => 'Open a URL in a headless browser and capture the content',
  isConcurrencySafe: () => true,
  isReadOnly: () => true,
  isEnabled: () => true,
  async call(args) {
    try {
      const response = await fetch(args.url, {
        signal: AbortSignal.timeout(15000),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DeepAGI/1.0)' },
      })
      const text = await response.text()
      const stripped = text
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 10000)
      return { data: stripped || '(empty page)' }
    } catch (error: any) {
      return { data: `Error: ${error.message}` }
    }
  },
}
