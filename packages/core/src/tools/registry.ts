/**
 * DeepAGI Tool Registry
 *
 * Ported from Open-ClaudeCode's tools.ts getAllBaseTools().
 */

import type { Tool, Tools } from './Tool.js'

// Base tools — always available
import { BashTool } from './BashTool.js'
import { ReadTool } from './ReadTool.js'
import { WriteTool } from './WriteTool.js'
import { EditTool } from './EditTool.js'
import { GlobTool } from './GlobTool.js'
import { GrepTool } from './GrepTool.js'
import { WebFetchTool } from './WebFetchTool.js'
import { WebSearchTool } from './WebSearchTool.js'
import { AskUserTool } from './AskUserTool.js'

// Export the Tools type so other modules can use it
export type { Tool, Tools } from './Tool.js'

/**
 * Returns all base tools available in DeepAGI.
 */
export function getAllTools(): Tools {
  return [
    BashTool,
    ReadTool,
    WriteTool,
    EditTool,
    GlobTool,
    GrepTool,
    WebFetchTool,
    WebSearchTool,
    AskUserTool,
  ]
}

/**
 * Filter tools based on permission deny rules.
 */
export function filterToolsByDenyRules(
  tools: Tools,
  denyRules?: Set<string>,
): Tools {
  if (!denyRules || denyRules.size === 0) return tools
  return tools.filter(t => !denyRules.has(t.name))
}

/**
 * Get tools for a specific mode.
 */
export function getTools(
  permissionContext?: { denyRules?: Set<string> },
): Tools {
  const all = getAllTools()
  const enabled = all.filter(t => t.isEnabled())
  if (!permissionContext) return enabled
  return filterToolsByDenyRules(enabled, permissionContext.denyRules)
}
