/**
 * DeepAGI ToolUseContext
 *
 * Ported from Open-ClaudeCode's Tool.ts ToolUseContext type.
 * Simplified: removed Ink/React UI callbacks, Anthropic-specific fields.
 */

import type { SDKMessage } from '../types/index.js'

export type ToolPermissionMode = 'default' | 'accept' | 'bypass' | 'plan'

export type ToolUseContext = {
  options: {
    tools: import('./Tool.js').Tool[]
    mainLoopModel: string
    verbose: boolean
  }

  abortController: AbortController
  messages: SDKMessage[]

  /** Set of tool_use IDs currently in progress */
  inProgressToolUseIDs: Set<string>

  /** Update the in-progress tool use IDs */
  setInProgressToolUseIDs: (fn: (prev: Set<string>) => Set<string>) => void

  /** Permission mode */
  permissionMode?: ToolPermissionMode

  /** Metadata */
  agentId?: string
  queryTracking?: { chainId: string; depth: number }
}
