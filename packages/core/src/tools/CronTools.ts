/**
 * DeepAGI Cron Tools
 *
 * Port of Open-ClaudeCode's CronCreateTool, CronDeleteTool, CronListTool.
 * In-memory cron schedule (no file persistence).
 */

import { Tool } from './Tool.js'

type CronJob = {
  id: string
  cron: string
  prompt: string
  createdAt: number
  recurring: boolean
}

const jobs = new Map<string, CronJob>()

// ============================================================================
// CronCreateTool
// ============================================================================

export const CronCreateTool: Tool<{ cron: string; prompt: string; recurring?: boolean }, { id: string }> = {
  name: 'cron_create',
  searchHint: 'schedule recurring tasks',
  inputSchema: {
    type: 'object',
    properties: {
      cron: { type: 'string', description: '5-field cron expression (M H DoM Mon DoW)' },
      prompt: { type: 'string', description: 'Prompt to execute on each fire' },
      recurring: { type: 'boolean', description: 'Whether this repeats (default: true)' },
    },
    required: ['cron', 'prompt'],
  },
  description: () => 'Schedule a recurring or one-shot task via cron expression',
  isConcurrencySafe: () => false,
  isReadOnly: () => false,
  isEnabled: () => true,
  async call(args) {
    const id = crypto.randomUUID().slice(0, 8)
    jobs.set(id, {
      id,
      cron: args.cron,
      prompt: args.prompt,
      createdAt: Date.now(),
      recurring: args.recurring ?? true,
    })
    return { data: { id } }
  },
}

// ============================================================================
// CronDeleteTool
// ============================================================================

export const CronDeleteTool: Tool<{ id: string }, boolean> = {
  name: 'cron_delete',
  searchHint: 'remove scheduled task',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Job ID to delete' },
    },
    required: ['id'],
  },
  description: () => 'Cancel a scheduled cron job',
  isConcurrencySafe: () => false,
  isReadOnly: () => false,
  isEnabled: () => true,
  async call(args) {
    return { data: jobs.delete(args.id) }
  },
}

// ============================================================================
// CronListTool
// ============================================================================

export const CronListTool: Tool<{}, CronJob[]> = {
  name: 'cron_list',
  searchHint: 'list scheduled tasks',
  inputSchema: { type: 'object', properties: {} },
  description: () => 'List all scheduled cron jobs',
  isConcurrencySafe: () => true,
  isReadOnly: () => true,
  isEnabled: () => true,
  async call() {
    return { data: Array.from(jobs.values()) }
  },
}
