import { Tool } from './Tool.js'
import { createInterface } from 'node:readline/promises'

export const AskUserTool: Tool<{ question: string; options?: string[] }, string> = {
  name: 'ask_user',
  searchHint: 'ask user a question',
  inputSchema: {
    type: 'object',
    properties: {
      question: { type: 'string', description: 'Question to ask the user' },
      options: {
        type: 'array',
        items: { type: 'string' },
        description: 'Multiple choice options',
      },
    },
    required: ['question'],
  },

  description() {
    return 'Ask the user a question and get their response'
  },

  isConcurrencySafe() {
    return false
  },

  isReadOnly() {
    return false
  },

  isEnabled() {
    return true
  },

  interruptBehavior() {
    return 'cancel' as const
  },

  async call(args) {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    try {
      let question = args.question
      if (args.options && args.options.length > 0) {
        question += '\n' + args.options.map((opt, i) => `  ${i + 1}. ${opt}`).join('\n')
      }
      const answer = await rl.question(question + '\n> ')
      return { data: answer }
    } finally {
      rl.close()
    }
  },
}
