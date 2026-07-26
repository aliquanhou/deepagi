/**
 * DeepAGI ConfigTool
 *
 * Port of Open-ClaudeCode's ConfigTool.
 * Reads/writes project configuration.
 */

import { Tool } from './Tool.js'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const CONFIG_FILE = '.deepagi.json'

function readConfig(): Record<string, unknown> {
  const filePath = resolve(process.cwd(), CONFIG_FILE)
  if (!existsSync(filePath)) return {}
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'))
  } catch {
    return {}
  }
}

function writeConfig(config: Record<string, unknown>): void {
  const filePath = resolve(process.cwd(), CONFIG_FILE)
  writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf-8')
}

export const ConfigTool: Tool<{ key?: string; value?: unknown; action: 'get' | 'set' | 'list' | 'delete' }, unknown> = {
  name: 'config',
  searchHint: 'manage configuration',
  inputSchema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['get', 'set', 'list', 'delete'], description: 'Config action' },
      key: { type: 'string', description: 'Config key' },
      value: { description: 'Config value (for set action)' },
    },
    required: ['action'],
  },
  description: () => 'Read or modify project configuration',
  isConcurrencySafe: () => false,
  isReadOnly: () => false,
  isEnabled: () => true,
  async call(args) {
    const config = readConfig()
    switch (args.action) {
      case 'get': {
        if (!args.key) return { data: null }
        return { data: config[args.key] ?? null }
      }
      case 'set': {
        if (!args.key) return { data: null }
        config[args.key] = args.value
        writeConfig(config)
        return { data: true }
      }
      case 'delete': {
        if (!args.key) return { data: false }
        delete config[args.key]
        writeConfig(config)
        return { data: true }
      }
      case 'list':
        return { data: config }
    }
  },
}
