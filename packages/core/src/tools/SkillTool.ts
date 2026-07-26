/**
 * DeepAGI SkillTool
 *
 * Port of Open-ClaudeCode's SkillTool.
 * Invokes registered skills (slash commands available to the model).
 */

import { Tool } from './Tool.js'

type Skill = {
  name: string
  description: string
  prompt: string
}

const skills = new Map<string, Skill>()

export function registerSkill(skill: Skill): void {
  skills.set(skill.name, skill)
}

export const SkillTool: Tool<{ name: string; args?: string }, string> = {
  name: 'skill',
  searchHint: 'invoke a skill',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Skill name to invoke' },
      args: { type: 'string', description: 'Arguments to pass to the skill' },
    },
    required: ['name'],
  },
  description: () => 'Invoke a registered skill that provides specialized capabilities',
  isConcurrencySafe: () => false,
  isReadOnly: () => false,
  isEnabled: () => true,
  async call(args) {
    const skill = skills.get(args.name)
    if (!skill) {
      return { data: `Unknown skill: ${args.name}. Available: ${Array.from(skills.keys()).join(', ')}` }
    }
    return { data: skill.prompt + (args.args ? `\n\nArguments: ${args.args}` : '') }
  },
}
