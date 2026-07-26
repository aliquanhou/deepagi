/**
 * DeepAGI MCP Tools (stubs)
 *
 * Port of Open-ClaudeCode's ListMcpResourcesTool, ReadMcpResourceTool, ToolSearchTool.
 * MCP server connection management will be added in a future phase.
 * For now, these serve as API-compatible stubs.
 */

import { Tool } from './Tool.js'

// ============================================================================
// ListMcpResourcesTool
// ============================================================================

export const ListMcpResourcesTool: Tool<{ serverName?: string }, unknown[]> = {
  name: 'list_mcp_resources',
  searchHint: 'list MCP resources',
  inputSchema: {
    type: 'object',
    properties: {
      serverName: { type: 'string', description: 'Optional: filter by server name' },
    },
  },
  description: () => 'List available MCP server resources',
  isConcurrencySafe: () => true,
  isReadOnly: () => true,
  isEnabled: () => true,
  async call() {
    return { data: [] }
  },
}

// ============================================================================
// ReadMcpResourceTool
// ============================================================================

export const ReadMcpResourceTool: Tool<{ serverName: string; uri: string }, string | null> = {
  name: 'read_mcp_resource',
  searchHint: 'read MCP resource',
  inputSchema: {
    type: 'object',
    properties: {
      serverName: { type: 'string', description: 'MCP server name' },
      uri: { type: 'string', description: 'Resource URI' },
    },
    required: ['serverName', 'uri'],
  },
  description: () => 'Read content from an MCP server resource',
  isConcurrencySafe: () => true,
  isReadOnly: () => true,
  isEnabled: () => true,
  async call() {
    return { data: null }
  },
}

// ============================================================================
// ToolSearchTool
// ============================================================================

export const ToolSearchTool: Tool<{ query: string }, string[]> = {
  name: 'tool_search',
  searchHint: 'search available tools',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query for finding the right tool' },
    },
    required: ['query'],
  },
  description: () => 'Search through available tools to find the right one',
  isConcurrencySafe: () => true,
  isReadOnly: () => true,
  isEnabled: () => true,
  async call(args) {
    // Return matching tool names from a built-in list
    const allTools = [
      'bash', 'read', 'write', 'edit', 'glob', 'grep', 'web_fetch', 'web_search',
      'ask_user', 'task_create', 'task_get', 'task_update', 'task_list', 'task_stop',
      'task_output', 'todo_write', 'enter_plan_mode', 'exit_plan_mode',
      'list_mcp_resources', 'read_mcp_resource',
    ]
    const q = args.query.toLowerCase()
    const matches = allTools.filter(t => t.includes(q))
    return { data: matches }
  },
}
