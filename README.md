# DeepAGI

> 🧠 **The best open-source agent** — Powered by DeepSeek, inspired by Claude Code.

DeepAGI is a fully open-source AI agent framework that brings Claude Code-level capability to the open-source world. Built on **DeepSeek LLM**, it provides a powerful Web UI with tool execution, file management, memory systems, and multi-agent orchestration.

## Architecture

```
apps/web/          → Next.js Web UI (coming soon)
packages/core/    → Core engine (this package)
  ├── engine/     → AgentEngine + QueryPipeline (conversation lifecycle)
  ├── gateway/    → DeepSeekGateway (LLM streaming API)
  ├── tools/      → Tool system (10 tools + orchestrator)
  └── types/      → 22 SDK message types
```

## Quick Start

```bash
# Set up
cp .env.example .env
# Edit .env with your DEEPSEEK_API_KEY

# Build
pnpm install
pnpm build

# Test
pnpm test

# Run
node -e "
const { AgentEngine } = require('@deepagi/core');
const engine = new AgentEngine({
  cwd: process.cwd(),
  tools: [],
  deepseekApiKey: process.env.DEEPSEEK_API_KEY,
});
console.log('Engine ready:', engine.getMessages().length, 'messages');
"
```

## Core Engine

| Module | File | Description |
|---|---|---|
| AgentEngine | `engine/AgentEngine.ts` | 5-phase conversation lifecycle |
| QueryPipeline | `engine/QueryPipeline.ts` | State machine (while + state = next) |
| DeepSeekGateway | `gateway/deepseek/DeepSeekGateway.ts` | OpenAI-compatible streaming API |
| ToolOrchestrator | `tools/orchestrator.ts` | Concurrent/serial tool execution |

## Tools

| Tool | Concurrent | Read-only | Description |
|---|---|---|---|
| bash | ❌ | Tristate | Shell command execution |
| read | ✅ | ✅ | File reading |
| write | ❌ | ❌ | File creation |
| edit | ❌ | ❌ | String replacement in files |
| glob | ✅ | ✅ | File pattern matching |
| grep | ✅ | ✅ | Content search |
| web_fetch | ✅ | ✅ | Web page fetching |
| web_search | ✅ | ✅ | Web search |
| ask_user | ❌ | ❌ | User interaction |

## License

MIT
