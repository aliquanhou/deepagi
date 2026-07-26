/**
 * DeepAGI Core Types
 *
 * Ported from Open-ClaudeCode's agentSdkTypes.ts + coreSchemas.ts.
 * Simplified: removed Anthropic SDK coupling, React/Ink dependencies.
 */

// ============================================================================
// Content Block Types
// ============================================================================

export type TextContent = {
  type: 'text'
  text: string
}

export type ToolUseContent = {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

export type ToolResultContent = {
  type: 'tool_result'
  tool_use_id: string
  content: string | ContentBlock[]
  is_error?: boolean
}

export type ThinkingContent = {
  type: 'thinking'
  thinking: string
}

export type RedactedThinkingContent = {
  type: 'redacted_thinking'
  data: string
}

export type ContentBlock =
  | TextContent
  | ToolUseContent
  | ToolResultContent
  | ThinkingContent
  | RedactedThinkingContent

// ============================================================================
// Base Message Types
// ============================================================================

export type MessageRole = 'user' | 'assistant' | 'system'

export type BaseMessage = {
  role: MessageRole
  content: string | ContentBlock[]
}

export type UserMessage = BaseMessage & {
  role: 'user'
}

export type AssistantMessage = BaseMessage & {
  role: 'assistant'
}

export type SystemMessage = BaseMessage & {
  role: 'system'
}

// ============================================================================
// Usage & Cost
// ============================================================================

export type Usage = {
  inputTokens: number
  outputTokens: number
  cacheReadInputTokens?: number
  cacheCreationInputTokens?: number
  totalCostUSD?: number
}

export type ModelUsage = {
  inputTokens: number
  outputTokens: number
  cacheReadInputTokens: number
  cacheCreationInputTokens: number
  costUSD: number
}

// ============================================================================
// Tool Definitions
// ============================================================================

export type ToolInputSchema = {
  type: 'object'
  properties?: Record<string, unknown>
  required?: string[]
  [key: string]: unknown
}

export type ToolDef = {
  name: string
  description: string
  inputSchema: ToolInputSchema
  strict?: boolean
}

// ============================================================================
// SDK Message Types (protocol between engine → consumer)
// ============================================================================

export type SDKAssistantMessage = {
  type: 'assistant'
  message: {
    role: 'assistant'
    content: ContentBlock[]
    stop_reason?: string | null
    usage?: Usage
  }
  parent_tool_use_id: string | null
  error?: string
  uuid: string
  session_id: string
}

export type SDKUserMessage = {
  type: 'user'
  message: {
    role: 'user'
    content: string | ContentBlock[]
  }
  parent_tool_use_id: string | null
  isReplay?: boolean
  isSynthetic?: boolean
  uuid?: string
  timestamp?: string
  session_id?: string
}

export type SDKStreamEvent = {
  type: 'stream_event'
  event:
    | { type: 'message_start'; message: { usage: Usage } }
    | { type: 'content_block_start'; index: number; content_block: ContentBlock }
    | { type: 'content_block_delta'; index: number; delta: { type: string; text?: string; partial_json?: string; thinking?: string } }
    | { type: 'content_block_stop'; index: number }
    | { type: 'message_delta'; delta: { stop_reason?: string }; usage: { output_tokens: number } }
    | { type: 'message_stop' }
  session_id: string
  uuid: string
}

export type SDKResultSuccess = {
  type: 'result'
  subtype: 'success'
  is_error: false
  result: string
  stop_reason: string | null
  duration_ms: number
  num_turns: number
  total_cost_usd: number
  usage: Usage
  session_id: string
  uuid: string
}

export type SDKResultError = {
  type: 'result'
  subtype: 'error_max_turns' | 'error_max_budget_usd' | 'error_during_execution' | 'error_max_structured_output_retries'
  is_error: true
  errors: string[]
  duration_ms: number
  num_turns: number
  stop_reason: string | null
  total_cost_usd: number
  usage: Usage
  session_id: string
  uuid: string
}

export type SDKResult = SDKResultSuccess | SDKResultError

export type SDKToolUseSummary = {
  type: 'tool_use_summary'
  summary: string
  preceding_tool_use_ids: string[]
  uuid: string
  session_id: string
}

export type SDKCompactBoundary = {
  type: 'system'
  subtype: 'compact_boundary'
  session_id: string
  uuid: string
}

export type SDKSystemMessage = {
  type: 'system'
  subtype: string
  [key: string]: unknown
}

export type SDKMessage =
  | SDKAssistantMessage
  | SDKUserMessage
  | SDKStreamEvent
  | SDKResult
  | SDKToolUseSummary
  | SDKCompactBoundary
  | SDKSystemMessage

// ============================================================================
// Agent Engine Types
// ============================================================================

export type PermissionResult = {
  behavior: 'allow' | 'deny' | 'ask'
  message?: string
}

export type ThinkingConfig =
  | { type: 'disabled' }
  | { type: 'adaptive' }
  | { type: 'enabled'; budgetTokens?: number }

export type EngineConfig = {
  cwd: string
  tools: ToolDef[]
  deepseekApiKey: string
  deepseekBaseUrl?: string
  model?: string
  maxTurns?: number
  thinkingConfig?: ThinkingConfig
  systemPrompt?: string
  verbose?: boolean
}

// ============================================================================
// Stream Event Types (for SSE delivery)
// ============================================================================

export type StreamEvent =
  | { type: 'text_delta'; index: number; text: string }
  | { type: 'thinking_delta'; thinking: string }
  | { type: 'tool_use_start'; index: number; id: string; name: string; input: Record<string, unknown> }
  | { type: 'message_stop'; stop_reason: string | null }
  | { type: 'error'; message: string; code?: string }
