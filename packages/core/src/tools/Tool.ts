/**
 * DeepAGI Tool Interface
 *
 * Ported from Open-ClaudeCode's Tool.ts.
 * Simplified: removed Anthropic-specific fields (mcpInfo, mcpMeta, LSP hooks).
 */

import type { ToolInputSchema } from '../types/index.js'
import type { ToolUseContext } from './ToolUseContext.js'

// ============================================================================
// Tool Call Progress
// ============================================================================

export type ToolProgressData = {
  type: string
  [key: string]: unknown
}

export type ToolProgress<P extends ToolProgressData> = {
  toolUseID: string
  data: P
}

export type ToolCallProgress<P extends ToolProgressData = ToolProgressData> = (
  progress: ToolProgress<P>,
) => void

// ============================================================================
// Tool Result
// ============================================================================

export type ToolResult<T> = {
  data: T
  newMessages?: import('../types/index.js').SDKMessage[]
  contextModifier?: (context: ToolUseContext) => ToolUseContext
}

// ============================================================================
// Validation
// ============================================================================

export type ValidationResult =
  | { result: true }
  | { result: false; message: string; errorCode: number }

// ============================================================================
// Tool Interface
// ============================================================================

export interface Tool<Input = Record<string, unknown>, Output = unknown> {
  /** Primary tool name */
  readonly name: string

  /** Optional aliases for backwards compatibility */
  aliases?: string[]

  /** One-line search hint for keyword matching */
  searchHint?: string

  /**
   * Execute the tool with given arguments.
   * Must return a ToolResult containing the output data.
   */
  call(
    args: Input,
    context: ToolUseContext,
    onProgress?: ToolCallProgress,
  ): Promise<ToolResult<Output>>

  /** Human-readable description of what this tool does */
  description(): string

  /** JSON Schema for the tool's input */
  readonly inputSchema: ToolInputSchema

  /** Whether this tool can run concurrently with other tools */
  isConcurrencySafe(input: Input): boolean

  /** Whether this tool only reads (no side effects) */
  isReadOnly(input: Input): boolean

  /** Whether this tool is currently enabled */
  isEnabled(): boolean

  /** What happens when the user interrupts during this tool */
  interruptBehavior?(): 'cancel' | 'block'

  /** Validate tool input before execution */
  validateInput?(input: Input, context: ToolUseContext): Promise<ValidationResult>
}

// ============================================================================
// Type Helpers
// ============================================================================

export type Tools = Tool[]

export function findToolByName(tools: Tools, name: string): Tool | undefined {
  return tools.find(t => t.name === name || t.aliases?.includes(name))
}

export function toolMatchesName(tool: { name: string; aliases?: string[] }, name: string): boolean {
  return tool.name === name || (tool.aliases?.includes(name) ?? false)
}
