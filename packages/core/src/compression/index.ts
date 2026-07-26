/**
 * DeepAGI Compression Pipeline
 *
 * Ported from Open-ClaudeCode's 5-layer compression system.
 */

import type { SDKMessage } from '../types/index.js'
import { snipCompact } from './snip.js'
import { microcompact } from './microcompact.js'
import { contextCollapse } from './collapse.js'
import { autoCompact } from './autocompact.js'
import { reactiveCompact } from './reactiveCompact.js'

export type { CollapseStore } from './collapse.js'

export type CompressionConfig = {
  maxMessages?: number
  maxTokens?: number
  snipKeepLast?: number
  autoCompactEnabled?: boolean
  collapseEnabled?: boolean
}

export type CompressionResult = {
  messages: SDKMessage[]
  boundaryMessage?: SDKMessage
  tokensFreed?: number
}

export type SnipResult = CompressionResult

export type CompactResult = CompressionResult & {
  summaryMessage?: SDKMessage
  preCompactTokenCount?: number
  postCompactTokenCount?: number
}

export function createCompressionPipeline(config?: CompressionConfig) {
  return {
    snip: (messages: SDKMessage[]) => snipCompact(messages, config?.snipKeepLast),
    microcompact: (messages: SDKMessage[]) => microcompact(messages),
    contextCollapse: (messages: SDKMessage[]) => contextCollapse(messages, config?.collapseEnabled),
    autoCompact: async (messages: SDKMessage[]) => autoCompact(messages, config?.autoCompactEnabled),
    reactiveCompact: async (messages: SDKMessage[], error: string) => reactiveCompact(messages, error),
  }
}
