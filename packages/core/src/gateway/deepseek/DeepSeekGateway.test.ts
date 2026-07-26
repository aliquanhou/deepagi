/**
 * DeepSeekGateway tests
 *
 * NOTE: Some tests require a valid DEEPSEEK_API_KEY environment variable.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { DeepSeekGateway } from './DeepSeekGateway.js'

const API_KEY = process.env.DEEPSEEK_API_KEY
const skipWithoutKey = !API_KEY ? it.skip : it

describe('DeepSeekGateway', () => {
  let gateway: DeepSeekGateway

  beforeAll(() => {
    if (API_KEY) {
      gateway = new DeepSeekGateway({
        apiKey: API_KEY,
        model: 'deepseek-v4-flash',
      })
    }
  })

  describe('constructor', () => {
    it('should create gateway with defaults', () => {
      const g = new DeepSeekGateway({ apiKey: 'test-key' })
      expect(g.model).toBe('deepseek-v4-flash')
    })

    it('should accept custom model and baseUrl', () => {
      const g = new DeepSeekGateway({
        apiKey: 'test-key',
        model: 'deepseek-v4-pro',
        baseUrl: 'https://custom.example.com',
      })
      expect(g.model).toBe('deepseek-v4-pro')
    })
  })

  describe('stream()', () => {
    skipWithoutKey('should stream a response for basic prompt', async () => {
      const results: any[] = []

      for await (const msg of gateway.stream({
        messages: [],
        tools: [],
        systemPrompt: 'Reply with exactly "Hello!" and nothing else.',
        signal: new AbortController().signal,
      })) {
        results.push(msg)
      }

      const assistantMsg = results.find(m => m.type === 'assistant')
      expect(assistantMsg).toBeDefined()
      expect(assistantMsg!.message.role).toBe('assistant')
    }, 15000)

    skipWithoutKey('should handle tool_use in response', async () => {
      const results: any[] = []

      for await (const msg of gateway.stream({
        messages: [],
        tools: [{
          name: 'bash',
          description: 'Execute shell commands',
          inputSchema: {
            type: 'object',
            properties: {
              command: { type: 'string' },
            },
            required: ['command'],
          },
        }],
        systemPrompt: 'Use the bash tool to run: echo "hello"',
        signal: new AbortController().signal,
      })) {
        results.push(msg)
      }

      const assistantMsg = results.find(m => m.type === 'assistant')
      expect(assistantMsg).toBeDefined()
    }, 30000)
  })

  describe('error handling', () => {
    it('should throw on invalid API key', async () => {
      const badGateway = new DeepSeekGateway({ apiKey: 'sk-invalid-key' })
      try {
        for await (const _ of badGateway.stream({
          messages: [],
          tools: [],
          signal: new AbortController().signal,
        })) {
          // consume
        }
        // Should not reach here
        expect(true).toBe(false)
      } catch (error: any) {
        expect(error.message).toContain('DeepSeek API error')
      }
    })
  })
})
