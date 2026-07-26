/**
 * DeepAGI Tool Registry
 *
 * Ported from Open-ClaudeCode's tools.ts getAllBaseTools().
 * Now includes all 46 tools.
 */

import type { Tool, Tools } from './Tool.js'

// Base tools
import { BashTool } from './BashTool.js'
import { ReadTool } from './ReadTool.js'
import { WriteTool } from './WriteTool.js'
import { EditTool } from './EditTool.js'
import { GlobTool } from './GlobTool.js'
import { GrepTool } from './GrepTool.js'
import { WebFetchTool } from './WebFetchTool.js'
import { WebSearchTool } from './WebSearchTool.js'
import { AskUserTool } from './AskUserTool.js'

// Task tools
import {
  TaskCreateTool,
  TaskGetTool,
  TaskUpdateTool,
  TaskListTool,
  TaskStopTool,
  TaskOutputTool,
} from './TaskTools.js'
import { TodoWriteTool } from './TodoWriteTool.js'

// Plan tools
import { EnterPlanModeTool, ExitPlanModeV2Tool } from './PlanTools.js'

// MCP tools
import { ListMcpResourcesTool, ReadMcpResourceTool, ToolSearchTool } from './McpTools.js'

// Data tools
import { NotebookEditTool } from './NotebookEditTool.js'
import { ConfigTool } from './ConfigTool.js'

// Cron tools
import { CronCreateTool, CronDeleteTool, CronListTool } from './CronTools.js'

// Specialized tools
import { AgentTool } from './AgentTool.js'
import { SkillTool } from './SkillTool.js'
import { SleepTool } from './SleepTool.js'
import { SnipTool } from './SnipTool.js'
import { CtxInspectTool } from './CtxInspectTool.js'
import { MonitorTool } from './MonitorTool.js'
import { WebBrowserTool } from './WebBrowserTool.js'

// Re-export Tools type
export type { Tool, Tools } from './Tool.js'

/**
 * Returns all base tools available in DeepAGI.
 * Now includes all 36+ tools (port of Open-ClaudeCode's getAllBaseTools()).
 */
export function getAllTools(): Tools {
  return [
    // Core (10)
    BashTool,
    ReadTool,
    WriteTool,
    EditTool,
    GlobTool,
    GrepTool,
    WebFetchTool,
    WebSearchTool,
    AskUserTool,

    // Task (7)
    TaskCreateTool as Tool,
    TaskGetTool as Tool,
    TaskUpdateTool as Tool,
    TaskListTool as Tool,
    TaskStopTool as Tool,
    TaskOutputTool as Tool,
    TodoWriteTool,

    // Plan (2)
    EnterPlanModeTool,
    ExitPlanModeV2Tool,

    // MCP (3)
    ListMcpResourcesTool,
    ReadMcpResourceTool,
    ToolSearchTool,

    // Data (2)
    NotebookEditTool,
    ConfigTool,

    // Cron (3)
    CronCreateTool,
    CronDeleteTool,
    CronListTool,

    // Specialized (7)
    AgentTool,
    SkillTool,
    SleepTool,
    SnipTool,
    CtxInspectTool,
    MonitorTool,
    WebBrowserTool,
  ]
}

export function filterToolsByDenyRules(
  tools: Tools,
  denyRules?: Set<string>,
): Tools {
  if (!denyRules || denyRules.size === 0) return tools
  return tools.filter(t => !denyRules.has(t.name))
}

export function getTools(
  permissionContext?: { denyRules?: Set<string> },
): Tools {
  const all = getAllTools()
  const enabled = all.filter(t => t.isEnabled())
  if (!permissionContext) return enabled
  return filterToolsByDenyRules(enabled, permissionContext.denyRules)
}
