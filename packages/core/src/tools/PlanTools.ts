/**
 * DeepAGI Plan Tools
 *
 * Port of Open-ClaudeCode's EnterPlanModeTool, ExitPlanModeV2Tool.
 */

import { Tool } from './Tool.js'
import type { ToolUseContext } from './ToolUseContext.js'

type PlanState = {
  active: boolean
  plan: string
}

const planState: PlanState = { active: false, plan: '' }

// ============================================================================
// EnterPlanModeTool
// ============================================================================

export const EnterPlanModeTool: Tool<{ plan: string }, boolean> = {
  name: 'enter_plan_mode',
  searchHint: 'create a plan',
  inputSchema: {
    type: 'object',
    properties: {
      plan: { type: 'string', description: 'The implementation plan' },
    },
    required: ['plan'],
  },
  description: () => 'Create or update an implementation plan and enter plan mode',
  isConcurrencySafe: () => false,
  isReadOnly: () => false,
  isEnabled: () => true,
  async call(args) {
    planState.active = true
    planState.plan = args.plan
    return { data: true }
  },
}

// ============================================================================
// ExitPlanModeTool
// ============================================================================

export const ExitPlanModeV2Tool: Tool<{}, boolean> = {
  name: 'exit_plan_mode',
  searchHint: 'exit plan mode',
  inputSchema: {
    type: 'object',
    properties: {},
  },
  description: () => 'Exit plan mode and begin implementation',
  isConcurrencySafe: () => false,
  isReadOnly: () => false,
  isEnabled: () => true,
  async call() {
    planState.active = false
    return { data: true }
  },
}
