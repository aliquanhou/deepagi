# DeepAGI Architecture

> **首席架构师 / Lead Architect:** Dr. Yu Qiuhong (于秋鸿博士)

## Overview

DeepAGI is a multi-layered AI agent framework built around a **core engine** (`@deepagi/core`) that manages conversation lifecycle, tool execution, compression, permissions, and memory. The engine is API-agnostic and currently uses **DeepSeek** as its LLM backend via an OpenAI-compatible gateway.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      Web UI (apps/web)                       │
│  Next.js 14 · SSE Streaming · Smart Content Rendering       │
│  Zustand State · Shadcn UI · TailwindCSS                     │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP SSE
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   API Route (/api/chat/stream)               │
│   POST → AgentEngine.submitMessage() → SSE Events            │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌─────────────────────────────────────────────────────────────┐
│                    @deepagi/core (Engine)                    │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                    AgentEngine                           │ │
│  │  submitMessage() — 5-phase conversation lifecycle        │ │
│  │  Phase 1: Initialize (config, system prompt)             │ │
│  │  Phase 2: User input processing                          │ │
│  │  Phase 3: Prepare (context, skills, plugins)             │ │
│  │  Phase 4: QueryPipeline loop                             │ │
│  │  Phase 5: Result (success/error)                         │ │
│  └───────────────────────┬─────────────────────────────────┘ │
│                          │                                    │
│  ┌───────────────────────▼─────────────────────────────────┐ │
│  │                   QueryPipeline                          │ │
│  │  while(true) + state = next state machine                │ │
│  │                                                          │ │
│  │  ┌─────────┐ ┌──────────┐ ┌───────┐ ┌──────────┐       │ │
│  │  │ Snip    │→│Microcompact│→│Collapse│→│AutoCompact│      │ │
│  │  └─────────┘ └──────────┘ └───────┘ └───────┬──────┘    │ │
│  │                                              │            │ │
│  │  ┌───────────────────────────────────────────▼──────────┐ │ │
│  │  │           DeepSeekGateway.stream()                   │ │ │
│  │  │  OpenAI-compatible · SSE parsing · tool_use mapping  │ │ │
│  │  └───────────────────────┬──────────────────────────────┘ │ │
│  │                          │                                 │ │
│  │  ┌───────────────────────▼──────────────────────────────┐ │ │
│  │  │           Tool Orchestrator                          │ │ │
│  │  │  Partition: read-only (parallel) / write (serial)    │ │ │
│  │  │  Error recovery: reactiveCompact on PTL              │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌──────┐ ┌──────────┐ │
│  │ Perm     │ │ Memory   │ │ Skills │ │ Auth │ │ Cost     │ │
│  │ 3 modes  │ │ FILE.md  │ │ Dynamic│ │APIKey│ │ Token+USD│ │
│  └──────────┘ └──────────┘ └────────┘ └──────┘ └──────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Core Engine Design

### AgentEngine

The `AgentEngine` class manages a conversation's lifecycle. Each instance owns a `mutableMessages` array that persists across turns.

```typescript
class AgentEngine {
  private mutableMessages: SDKMessage[]
  private abortController: AbortController
  private gateway: DeepSeekGateway

  async *submitMessage(prompt: string): AsyncGenerator<SDKMessage>
  interrupt(): void
  getMessages(): readonly SDKMessage[]
}
```

### QueryPipeline State Machine

The pipeline uses a `while(true) + state = next` pattern with these terminal reasons:

- `completed` — normal end (no tool_use)
- `tool_use` — tools need execution, caller handles
- `model_error` — API error, unrecoverable
- `max_turns` — turn limit reached
- `max_output_tokens_recovery` — auto-recovery via continue message

### 5-Layer Compression

| Layer | Trigger | Strategy | API Required |
|---|---|---|---|
| Snip | Every turn | Truncate to last N messages | No |
| Microcompact | Every turn | Trim verbose tool results | No |
| ContextCollapse | Every turn | Fold distant segments | No |
| AutoCompact | Message threshold | Summarize oldest messages | Yes (DeepSeek) |
| ReactiveCompact | API error (413) | Aggressive truncation + retry | No |

### Tool Orchestration

The orchestrator partitions tools by concurrency safety:

```
[read, read, write, read, write]
  → [[read, read], [write], [read], [write]]
     (parallel)    (serial)  (parallel) (serial)
```

- **Concurrent limit**: 10
- **Context modifiers**: Collected from parallel batch, applied serially after

## Data Flow for a Typical Query

```
1. User sends message via Web UI
2. SSE POST /api/chat/stream
3. AgentEngine.submitMessage("list files")
4. QueryPipeline.run() with messages=["user: list files"]
5. Compression: skip (only 1 message)
6. DeepSeekGateway.stream() → SSE events
7. Model responds with tool_use(bash: "ls")
8. Engine executes bash tool → "file1.txt file2.txt"
9. QueryPipeline.run() with messages=["user", "assistant(tool_use)", "tool(result)"]
10. Model responds with text: "Here are the files..."
11. AgentEngine yields result
12. SSE returns text_delta events → UI renders
```

## Message Protocol

22 SDK message types for engine↔consumer communication:

- `assistant` — Model response (text + tool_use)
- `user` — User message (text + tool_result)
- `stream_event` — Raw SSE events (content_block, message_delta)
- `result` — Final result (success/error)
- `tool_use_summary` — Generated tool use summary

## License

MIT © 2026 DeepAGI Contributors. Lead: Dr. Yu Qiuhong.
