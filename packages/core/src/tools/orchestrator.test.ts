/**
 * Tool Orchestrator tests
 */

import { describe, it, expect } from 'vitest'
import { partitionToolCalls, runTools, makeToolResult, makeToolError } from './orchestrator.js'
import type { ToolUseBlock } from './orchestrator.js'
import type { Tool } from './Tool.js'
import type { ToolUseContext } from './ToolUseContext.js'
import type { SDKAssistantMessage } from '../types/index.js'

// Simple test tools
const ReadTool: Tool = {
  name: 'read',
  inputSchema: { type: 'object', properties: { file_path: { type: 'string' } }, required: ['file_path'] },
  description: () => 'Read a file',
  isConcurrencySafe: () => true,
  isReadOnly: () => true,
  isEnabled: () => true,
  async call(args: any) { return { data: 'file content' } },
}

const WriteTool: Tool = {
  name: 'write',
  inputSchema: { type: 'object', properties: { file_path: { type: 'string' }, content: { type: 'string' } }, required: ['file_path', 'content'] },
  description: () => 'Write a file',
  isConcurrencySafe: () => false,
  isReadOnly: () => false,
  isEnabled: () => true,
  async call(args: any) { return { data: 'written' } },
}

const BashTool: Tool = {
  name: 'bash',
  inputSchema: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] },
  description: () => 'Run a command',
  isConcurrencySafe: () => false,
  isReadOnly: () => false,
  isEnabled: () => true,
  async call(args: any) { return { data: 'command output' } },
}

describe('makeToolResult', () => {
  it('should create a tool result user message', () => {
    const msg = makeToolResult('tool-1', { data: 'hello' })
    expect(msg.type).toBe('user')
    expect(msg.parent_tool_use_id).toBe('tool-1')
  })
})

describe('makeToolError', () => {
  it('should create a tool error message', () => {
    const msg = makeToolError('tool-1', 'something went wrong')
    expect(msg.type).toBe('user')
    expect(msg.message.content).toEqual([
      { type: 'tool_result', tool_use_id: 'tool-1', content: 'something went wrong', is_error: true },
    ])
  })
})
