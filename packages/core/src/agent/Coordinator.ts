/**
 * DeepAGI Multi-Agent Coordinator
 *
 * Ported from Open-ClaudeCode's coordinator/coordinatorMode.ts.
 * Manages sub-agents: creation, communication, task delegation.
 */

import { DeepSeekGateway } from '../gateway/deepseek/DeepSeekGateway.js'

// ============================================================================
// Types
// ============================================================================

export type SubAgent = {
  id: string
  name: string
  status: 'idle' | 'running' | 'completed' | 'error'
  task: string | null
  result: string | null
  createdAt: number
}

export type AgentMessage = {
  from: string
  to: string
  content: string
  type: 'task' | 'result' | 'status' | 'message'
  timestamp: number
}

// ============================================================================
// State
// ============================================================================

const agents = new Map<string, SubAgent>()
const messageQueue: AgentMessage[] = []
const MAX_CONCURRENT = 5

// ============================================================================
// Coordinator
// ============================================================================

export class Coordinator {
  private gateway: DeepSeekGateway

  constructor(apiKey: string) {
    this.gateway = new DeepSeekGateway({ apiKey })
  }

  /**
   * Create a sub-agent to handle a task.
   */
  async createAgent(name: string, task: string): Promise<SubAgent> {
    const id = crypto.randomUUID().slice(0, 8)
    const agent: SubAgent = {
      id,
      name,
      status: 'running',
      task,
      result: null,
      createdAt: Date.now(),
    }
    agents.set(id, agent)
    return agent
  }

  /**
   * Run a sub-agent to completion.
   */
  async runAgent(agentId: string, systemPrompt: string): Promise<string> {
    const agent = agents.get(agentId)
    if (!agent) throw new Error(`Agent ${agentId} not found`)

    agent.status = 'running'

    try {
      const messages: any[] = []
      let result = ''

      for await (const msg of this.gateway.stream({
        messages,
        tools: [],
        systemPrompt,
        signal: new AbortController().signal,
      })) {
        if (msg.type === 'assistant') {
          const text = (msg.message.content ?? [])
            .filter((c: any) => c.type === 'text')
            .map((c: any) => c.text)
            .join('\n')
          result += text
        }
      }

      agent.result = result
      agent.status = 'completed'
      return result
    } catch (error: any) {
      agent.result = `Error: ${error.message}`
      agent.status = 'error'
      throw error
    }
  }

  /**
   * Send a message to an agent's inbox.
   */
  sendMessage(from: string, to: string, content: string, type: AgentMessage['type'] = 'message'): void {
    messageQueue.push({ from, to, content, type, timestamp: Date.now() })
  }

  /**
   * Read messages for an agent.
   */
  readMessages(agentId: string): AgentMessage[] {
    return messageQueue.filter(m => m.to === agentId)
  }

  /**
   * Get agent status.
   */
  getAgent(id: string): SubAgent | undefined {
    return agents.get(id)
  }

  /**
   * List all agents.
   */
  listAgents(): SubAgent[] {
    return Array.from(agents.values())
  }

  /**
   * Remove a completed/error agent.
   */
  removeAgent(id: string): boolean {
    return agents.delete(id)
  }

  /**
   * Get current agent count.
   */
  get count(): number {
    return agents.size
  }

  /**
   * Check if coordinator can accept more agents.
   */
  get canAcceptMore(): boolean {
    const running = Array.from(agents.values()).filter(a => a.status === 'running').length
    return running < MAX_CONCURRENT
  }
}
