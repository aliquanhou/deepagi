/**
 * SSE Chat Stream Route
 *
 * Receives user messages, invokes DeepSeekGateway, streams back tokens.
 * Connected to AgentEngine for full tool execution.
 */

import { AgentEngine } from '@deepagi/core'
import { getAllTools } from '@deepagi/core'

// ============================================================================
// Types
// ============================================================================

type HistoryItem = {
  role: string
  content: string
  toolCalls?: Array<{ name: string; input: Record<string, unknown>; result?: string }>
}

type RequestBody = {
  message: string
  history?: HistoryItem[]
}

// ============================================================================
// POST handler — SSE stream
// ============================================================================

export async function POST(request: Request) {
  try {
    const body: RequestBody = await request.json()

    if (!body.message) {
      return new Response(JSON.stringify({ error: 'message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'DEEPSEEK_API_KEY not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Create SSE stream
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        let engineClosed = false

        function sendSSE(data: unknown) {
          if (engineClosed) return
          try {
            const line = `data: ${JSON.stringify(data)}\n\n`
            controller.enqueue(encoder.encode(line))
          } catch {
            // Stream may be closed
          }
        }

        // Build history context
        const historyPrompt = body.history && body.history.length > 0
          ? body.history.map(h =>
              `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`
            ).join('\n') + '\n'
          : ''

        // Create engine
        const engine = new AgentEngine({
          cwd: process.cwd(),
          tools: getAllTools().map(t => ({
            name: t.name,
            description: t.description(),
            inputSchema: t.inputSchema,
          })),
          deepseekApiKey: apiKey,
          systemPrompt: `You are DeepAGI, an interactive agent that helps users with software engineering tasks.

# CORE ACTION PRINCIPLE
**CRITICAL: Act first, then observe.** When a user asks for system information, execute ALL necessary tool calls in a SINGLE bash command combining all checks. Do not run separate commands for each tool. After receiving results, respond immediately.

# Using your tools
- To read files use read instead of cat, head, tail, or sed.
- To edit files use edit instead of sed or awk.
- To create files use write instead of cat with heredoc.
- To search for files use glob instead of find or ls.

# Tone and style
- Be short and concise. Go straight to the point.
- Do not use emojis unless the user requests it.

${historyPrompt}`,
        })

        try {
          // Process the message through the engine
          for await (const message of engine.submitMessage(body.message)) {
            if (message.type === 'assistant') {
              // Stream text content block by block
              for (const block of message.message.content ?? []) {
                if (block.type === 'text') {
                  // Send the entire text as a delta
                  // (in a production app, we'd stream character by character)
                  sendSSE({ type: 'text_delta', text: block.text })
                } else if (block.type === 'tool_use') {
                  sendSSE({
                    type: 'tool_use_start',
                    id: block.id,
                    name: block.name,
                    input: block.input,
                  })
                }
              }
            } else if (message.type === 'result') {
              if ('is_error' in message && message.is_error) {
                const result = message as any
                sendSSE({ type: 'error', message: result.errors?.join(', ') ?? 'Unknown error' })
              }
            } else if (message.type === 'user') {
              // Tool results — extract and send
              const content = Array.isArray(message.message.content)
                ? message.message.content
                : []
              for (const block of content) {
                if (block.type === 'tool_result') {
                  sendSSE({
                    type: 'tool_result',
                    id: block.tool_use_id,
                    result: typeof block.content === 'string'
                      ? block.content.slice(0, 2000)
                      : JSON.stringify(block.content).slice(0, 2000),
                    isError: block.is_error,
                  })
                }
              }
            }
          }
        } catch (error: any) {
          sendSSE({ type: 'error', message: error.message ?? 'Engine error' })
        } finally {
          engineClosed = true
          sendSSE({ type: 'done' })
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message ?? 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
