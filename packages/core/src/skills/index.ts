/**
 * DeepAGI Skills System
 *
 * Ported from Open-ClaudeCode's skills system.
 * Skills are registered slash commands that the model can invoke.
 */

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'

export type Skill = {
  name: string
  description: string
  prompt: string
  source: 'bundled' | 'file' | 'plugin'
  filePath?: string
}

const skills = new Map<string, Skill>()

/**
 * Register a skill programmatically.
 */
export function registerSkill(skill: Skill): void {
  skills.set(skill.name, skill)
}

/**
 * Load skills from a directory.
 * Each .md file becomes a skill.
 * First line = description, rest = prompt.
 */
export function loadSkillsFromDir(skillsDir?: string): Skill[] {
  const dir = skillsDir ?? resolve(process.cwd(), '.deepagi/skills')
  if (!existsSync(dir)) return []

  const loaded: Skill[] = []

  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.md')) continue
    const filePath = join(dir, file)
    if (!statSync(filePath).isFile()) continue

    try {
      const content = readFileSync(filePath, 'utf-8')
      const lines = content.trim().split('\n')
      const description = (lines[0] ?? file.replace('.md', '')).replace(/^#\s*/, '')
      const name = file.replace('.md', '')

      const skill: Skill = {
        name,
        description,
        prompt: content,
        source: 'file',
        filePath,
      }
      skills.set(name, skill)
      loaded.push(skill)
    } catch {
      // Skip unreadable files
    }
  }

  return loaded
}

/**
 * Get a registered skill by name.
 */
export function getSkill(name: string): Skill | undefined {
  return skills.get(name)
}

/**
 * List all registered skills.
 */
export function listSkills(): Skill[] {
  return Array.from(skills.values())
}

/**
 * Clear all skills (for testing/reload).
 */
export function clearSkills(): void {
  skills.clear()
}
