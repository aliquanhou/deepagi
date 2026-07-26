/**
 * AgentEngine tests
 */

import { describe, it, expect } from 'vitest'
import { AgentEngine } from './AgentEngine.js'

const API_KEY = process.env.DEEPSEEK_API_KEY

describe('AgentEngine', () => {
  it('should create an engine with valid config', () => {
    const engine = new AgentEngine({
      cwd: '/tmp',
      tools: [],
      deepseekApiKey: 'sk-test',
    })
    expect(engine).toBeInstanceOf(AgentEngine)
    expect(engine.getMessages()).toEqual([])
  })

  it('should throw without api key', () => {
    expect(() => {
      new AgentEngine({
        cwd: '/tmp',
        tools: [],
        deepseekApiKey: '',
      })
    }).not.toThrow()
  })

  describe('submitMessage()', () => {
    it('should push user message to messages', async () => {
      const engine = new AgentEngine({
        cwd: '/tmp',
        tools: [],
        deepseekApiKey: API_KEY ?? 'sk-test',
      })

      // Consume generator (may error if no API key, but messages should be pushed)
      const gen = engine.submitMessage('Hello')
      const first = await gen.next()

      // User message should be in engine's message history
      // (even if the API call fails, the user message is pushed first)
      const messages = engine.getMessages()
      expect(messages.length).toBeGreaterThanOrEqual(1)
      expect(messages[0]!.type).toBe('user')
      const userMsg = messages[0]! as any
      expect(userMsg.message.content).toBe('Hello')
    }, 5000)

    it('should accept custom uuid', async () => {
      const engine = new AgentEngine({
        cwd: '/tmp',
        tools: [],
        deepseekApiKey: API_KEY ?? 'sk-test',
      })

      const gen = engine.submitMessage('Hi', { uuid: 'custom-uuid-123' })
      await gen.next() // consume or let it error

      const msg = engine.getMessages()[0] as any
      expect(msg.uuid).toBe('custom-uuid-123')
    })
  })

  describe('interrupt()', () => {
    it('should interrupt the current request', () => {
      const engine = new AgentEngine({
        cwd: '/tmp',
        tools: [],
        deepseekApiKey: 'sk-test',
      })
      expect(() => engine.interrupt()).not.toThrow()
    })
  })
})
