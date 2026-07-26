/**
 * DeepAGI Team Tools
 *
 * Port of Open-ClaudeCode's TeamCreateTool, TeamDeleteTool.
 * Creates/deletes agent teams for multi-agent coordination.
 */

import { Tool } from './Tool.js'
import type { ToolUseContext } from './ToolUseContext.js'

type Team = {
  id: string
  name: string
  members: string[]
  created: number
}

const teams = new Map<string, Team>()

export const TeamCreateTool: Tool<{ name: string; members?: string[] }, { teamId: string }> = {
  name: 'team_create',
  searchHint: 'create agent team',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Team name' },
      members: { type: 'array', items: { type: 'string' }, description: 'Initial member agent IDs' },
    },
    required: ['name'],
  },
  description: () => 'Create a new team of agents for collaborative work',
  isConcurrencySafe: () => false,
  isReadOnly: () => false,
  isEnabled: () => true,
  async call(args) {
    const id = crypto.randomUUID().slice(0, 8)
    teams.set(id, { id, name: args.name, members: args.members ?? [], created: Date.now() })
    return { data: { teamId: id } }
  },
}

export const TeamDeleteTool: Tool<{ teamId: string }, boolean> = {
  name: 'team_delete',
  searchHint: 'delete agent team',
  inputSchema: {
    type: 'object',
    properties: {
      teamId: { type: 'string', description: 'Team ID to delete' },
    },
    required: ['teamId'],
  },
  description: () => 'Delete an agent team',
  isConcurrencySafe: () => false,
  isReadOnly: () => false,
  isEnabled: () => true,
  async call(args) {
    return { data: teams.delete(args.teamId) }
  },
}

export function getTeam(teamId: string): Team | undefined {
  return teams.get(teamId)
}

export function listTeams(): Team[] {
  return Array.from(teams.values())
}
