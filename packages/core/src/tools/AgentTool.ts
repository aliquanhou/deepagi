/**
 * DeepAGI AgentTool
 *
 * Port of Open-ClaudeCode's AgentTool.
 * Creates sub-agents that work independently on delegated tasks.
 */

import { Tool } from './Tool.js'
import { DeepSeekGateway } from '../gateway/deepseek/DeepSeekGateway.js'

type SubAgent = {
  id: string
  name: string
  task: string
  status: 'running' | 'completed' | 'error'
  result?: string
}

const agents = new Map<string, SubAgent>()

export const AgentTool: Tool<{ name: string; task: string; model?: string }, { agentId: string }> = {
  name: 'agent',
  searchHint: 'create a sub-agent',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Name for the sub-agent' },
      task: { type: 'string', description: 'The task for the agent to complete' },
      model: { type: 'string', description: 'Optional: model override' },
    },
    required: ['name', 'task'],
  },
  description: () => 'Create a sub-agent to work on a task independently',
  isConcurrencySafe: () => false,
  isReadOnly: () => false,
  isEnabled: () => true,
  async call(args) {
    const id = crypto.randomUUID().slice(0, 8)
    const agent: SubAgent = {
      id,
      name: args.name,
      task: args.task,
      status: 'running',
    }

    // Run agent asynchronously (fire and forget)
    const apiKey = process.env.DEEPSEEK_API_KEY
    if (apiKey) {
      runAgent(agent, apiKey, args.model)
    }

    agents.set(id, agent)
    return { data: { agentId: id } }
  },
}

async function runAgent(agent: SubAgent, apiKey: string, model?: string): Promise<void> {
  try {
    const gateway = new DeepSeekGateway({ apiKey, model })
    const messages: any[] = []
    let result = ''

    for await (const msg of gateway.stream({
      messages,
      tools: [],
      systemPrompt: `You are a sub-agent "${agent.name}". Your task: ${agent.task}`,
      signal: new AbortController().signal,
    })) {
      if (msg.type === 'assistant') {
        const text = msg.message.content?.filter(c => c.type === 'text').map(c => (c as any).text).join('\n') ?? ''
        result += text
      }
    }

    agent.result = result
    agent.status = 'completed'
  } catch (error: any) {
    agent.result = `Error: ${error.message}`
    agent.status = 'error'
  }
}

// Read agent output
export function getAgentResult(agentId: string): SubAgent | undefined {
  return agents.get(agentId)
}
