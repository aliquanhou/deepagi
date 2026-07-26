import { Tool } from './Tool.js'

export const WebSearchTool: Tool<{ query: string }, string> = {
  name: 'web_search',
  searchHint: 'search the internet',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
    },
    required: ['query'],
  },

  description() {
    return 'Search the web for information'
  },

  isConcurrencySafe() {
    return true
  },

  isReadOnly() {
    return true
  },

  isEnabled() {
    return true
  },

  async call(args) {
    try {
      // Use a free search API (or configurable search provider)
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(args.query)}&format=json&no_html=1`
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) })
      const data: any = await response.json()

      // Extract abstract and related topics
      const parts: string[] = []
      if (data.AbstractText) parts.push(data.AbstractText)
      if (data.AbstractSource) parts.push(`Source: ${data.AbstractSource}`)

      return {
        data: parts.length > 0 ? parts.join('\n') : `(no results for "${args.query}")`,
      }
    } catch (error: any) {
      return { data: `Search error: ${error.message}` }
    }
  },
}
