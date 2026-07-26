/**
 * DeepAGI Tool Registry
 *
 * Complete tool registry. All 46 tools from Open-ClaudeCode's getAllBaseTools(),
 * adapted for DeepAGI (removed Anthropic-internal tools).
 */

import type { Tool, Tools } from './Tool.js'

// Core tools (10)
import { BashTool } from './BashTool.js'
import { ReadTool } from './ReadTool.js'
import { WriteTool } from './WriteTool.js'
import { EditTool } from './EditTool.js'
import { GlobTool } from './GlobTool.js'
import { GrepTool } from './GrepTool.js'
import { WebFetchTool } from './WebFetchTool.js'
import { WebSearchTool } from './WebSearchTool.js'
import { AskUserTool } from './AskUserTool.js'

// Task tools (7)
import { TaskCreateTool, TaskGetTool, TaskUpdateTool, TaskListTool, TaskStopTool, TaskOutputTool } from './TaskTools.js'
import { TodoWriteTool } from './TodoWriteTool.js'

// Plan tools (2)
import { EnterPlanModeTool, ExitPlanModeV2Tool } from './PlanTools.js'

// MCP tools (3)
import { ListMcpResourcesTool, ReadMcpResourceTool, ToolSearchTool } from './McpTools.js'

// Data tools (2)
import { NotebookEditTool } from './NotebookEditTool.js'
import { ConfigTool } from './ConfigTool.js'

// Cron tools (3)
import { CronCreateTool, CronDeleteTool, CronListTool } from './CronTools.js'

// Specialized tools
import { AgentTool } from './AgentTool.js'
import { SkillTool } from './SkillTool.js'
import { SleepTool } from './SleepTool.js'
import { SnipTool } from './SnipTool.js'
import { CtxInspectTool } from './CtxInspectTool.js'
import { MonitorTool } from './MonitorTool.js'
import { WebBrowserTool } from './WebBrowserTool.js'
import { BriefTool } from './BriefTool.js'
import { TerminalCaptureTool } from './TerminalCaptureTool.js'
import { LSPTool } from './LSPTool.js'
import { PowerShellTool } from './PowerShellTool.js'
import { SendMessageTool } from './SendMessageTool.js'
import { TeamCreateTool, TeamDeleteTool } from './TeamTools.js'
import { TestingPermissionTool, OverflowTestTool, VerifyPlanExecutionTool } from './TestingTools.js'

export type { Tool, Tools } from './Tool.js'

export function getAllTools(): Tools {
  return [
    // Core (10)
    BashTool, ReadTool, WriteTool, EditTool, GlobTool, GrepTool,
    WebFetchTool, WebSearchTool, AskUserTool,

    // Task (7)
    TaskCreateTool as Tool, TaskGetTool as Tool, TaskUpdateTool as Tool,
    TaskListTool as Tool, TaskStopTool as Tool, TaskOutputTool as Tool,
    TodoWriteTool,

    // Plan (2)
    EnterPlanModeTool, ExitPlanModeV2Tool,

    // MCP (3)
    ListMcpResourcesTool, ReadMcpResourceTool, ToolSearchTool,

    // Data (2)
    NotebookEditTool, ConfigTool,

    // Cron (3)
    CronCreateTool, CronDeleteTool, CronListTool,

    // Special (7)
    AgentTool, SkillTool, SleepTool, SnipTool, CtxInspectTool,
    MonitorTool, WebBrowserTool,

    // Sprint 2 additions (9)
    BriefTool, TerminalCaptureTool, LSPTool, PowerShellTool,
    SendMessageTool, TeamCreateTool, TeamDeleteTool,
    TestingPermissionTool, OverflowTestTool, VerifyPlanExecutionTool,
  ]
}

export function filterToolsByDenyRules(tools: Tools, denyRules?: Set<string>): Tools {
  if (!denyRules || denyRules.size === 0) return tools
  return tools.filter(t => !denyRules.has(t.name))
}

export function getTools(permissionContext?: { denyRules?: Set<string> }): Tools {
  const all = getAllTools()
  const enabled = all.filter(t => t.isEnabled())
  if (!permissionContext) return enabled
  return filterToolsByDenyRules(enabled, permissionContext.denyRules)
}
