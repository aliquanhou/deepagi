/**
 * DeepAGI Core Engine
 *
 * Core engine entry point. Re-exports all public API surface.
 */

// Types
export * from './types/index.js'

// Tools
export * from './tools/Tool.js'
export * from './tools/registry.js'
export * from './tools/orchestrator.js'

// Gateway
export * from './gateway/deepseek/DeepSeekGateway.js'

// Engine
export * from './engine/AgentEngine.js'
export * from './engine/QueryPipeline.js'

// Compression
export { snipCompact } from './compression/snip.js'
export { microcompact } from './compression/microcompact.js'
export { contextCollapse } from './compression/collapse.js'
export { autoCompact } from './compression/autocompact.js'
export { reactiveCompact } from './compression/reactiveCompact.js'
export type { CollapseStore } from './compression/collapse.js'
export { createCompressionPipeline } from './compression/index.js'
export type { CompressionConfig, CompressionResult, SnipResult, CompactResult } from './compression/index.js'

// Permission
export * from './permission/index.js'

// Memory
export * from './memory/index.js'

// Skills
export * from './skills/index.js'
