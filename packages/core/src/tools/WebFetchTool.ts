import { Tool } from './Tool.js'

export const WebFetchTool: Tool<{ url: string }, string> = {
  name: 'web_fetch',
  searchHint: 'fetch web page content',
  inputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL to fetch' },
    },
    required: ['url'],
  },

  description() {
    return 'Fetch content from a URL'
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
      const response = await fetch(args.url, {
        signal: AbortSignal.timeout(15000),
        headers: {
          'User-Agent': 'DeepAGI/1.0',
          'Accept': 'text/html,text/plain,*/*',
        },
      })
      const text = await response.text()
      // Truncate to prevent huge outputs
      const maxLen = 100000
      return {
        data: text.length > maxLen
          ? text.slice(0, maxLen) + `\n... (truncated, ${text.length - maxLen} more bytes)`
          : text,
      }
    } catch (error: any) {
      return { data: `Error fetching URL: ${error.message}` }
    }
  },
}
