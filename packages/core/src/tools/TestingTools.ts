/**
 * DeepAGI Testing & Debug Tools
 *
 * Ports:
 * - TestingPermissionTool — permission testing helper
 * - OverflowTestTool — context overflow testing
 * - VerifyPlanExecutionTool — plan verification
 */

import { Tool } from './Tool.js'

export const TestingPermissionTool: Tool<{ action: string }, string> = {
  name: 'testing_permission',
  searchHint: 'test permissions',
  inputSchema: {
    type: 'object',
    properties: {
      action: { type: 'string', description: 'Permission action to test' },
    },
    required: ['action'],
  },
  description: () => 'Testing helper for permission system',
  isConcurrencySafe: () => true,
  isReadOnly: () => true,
  isEnabled: () => false, // Only enabled in test mode
  async call(args) {
    return { data: `Permission test: ${args.action} allowed` }
  },
}

export const OverflowTestTool: Tool<{ size: number }, string> = {
  name: 'overflow_test',
  searchHint: 'test context overflow',
  inputSchema: {
    type: 'object',
    properties: {
      size: { type: 'number', description: 'Output size in KB' },
    },
    required: ['size'],
  },
  description: () => 'Generate large output to test context overflow handling',
  isConcurrencySafe: () => true,
  isReadOnly: () => true,
  isEnabled: () => false,
  async call(args) {
    const kb = args.size ?? 10
    return { data: 'x'.repeat(kb * 1024) }
  },
}

export const VerifyPlanExecutionTool: Tool<{ planId?: string }, string> = {
  name: 'verify_plan',
  searchHint: 'verify plan execution',
  inputSchema: {
    type: 'object',
    properties: {
      planId: { type: 'string', description: 'Plan ID to verify' },
    },
  },
  description: () => 'Verify that a plan has been correctly executed',
  isConcurrencySafe: () => false,
  isReadOnly: () => false,
  isEnabled: () => true,
  async call(args) {
    return { data: `Plan verification for ${args.planId ?? 'current plan'} completed` }
  },
}
