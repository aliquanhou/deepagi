# DeepAGI — Open-Source AI Agent Framework

> **The best open-source agent** — Powered by DeepSeek, inspired by Claude Code.

**首席架构师 / Lead Architect:** Dr. Yu Qiuhong (于秋鸿博士)

DeepAGI is a fully open-source AI agent framework that brings Claude Code-level capability to the open-source world. Built on **DeepSeek LLM**, it provides a powerful Web UI with intelligent structured rendering, tool execution, file management, memory systems, and multi-agent orchestration.

---

## ✨ Features

| Capability | Status | Description |
|---|---|---|
| 🧠 **LLM Gateway** | ✅ | DeepSeek API with streaming SSE, tool calling, format conversion |
| 🛠️ **44 Tools** | ✅ | Bash, Read/Write/Edit, Glob/Grep, WebFetch/Search, Task/Plan/Cron/MCP + more |
| 🔧 **Tool Orchestration** | ✅ | Concurrent read tools, serial write tools, partitioning algorithm |
| 🔁 **5-Layer Compression** | ✅ | Snip → Microcompact → ContextCollapse → AutoCompact → ReactiveCompact |
| 🧩 **Permission System** | ✅ | Ask/Allow/Deny modes + sliding-window denial tracking |
| 💾 **Memory System** | ✅ | File-based + MEMORY.md index, CRUD, search |
| 📚 **Skills System** | ✅ | Dynamic skill loading from `.deepagi/skills/` |
| 🔐 **Auth System** | ✅ | API Key management (env/runtime), verification |
| 🗄️ **Persistence** | ✅ | SQLite session/message storage (with in-memory fallback) |
| 💰 **Cost Tracking** | ✅ | Token + USD billing with DeepSeek pricing |
| 🤖 **Multi-Agent** | ✅ | Sub-agent creation, task delegation, messaging |
| 🌐 **Web UI** | ✅ | Next.js 14, SSE streaming, smart rendering (code/table/JSON/cards) |

---

## 🏗️ Architecture

```
deepagi/
├── apps/web/                  # Next.js 14 Web UI
│   └── src/
│       ├── app/               # Pages + SSE API route
│       ├── components/        # Smart content rendering
│       └── hooks/             # useChat, useAutoScroll
│
├── packages/core/             # @deepagi/core engine
│   └── src/
│       ├── engine/            # AgentEngine + QueryPipeline
│       ├── gateway/           # DeepSeekGateway (OpenAI-compatible)
│       ├── tools/             # 44 tools + orchestrator
│       ├── compression/       # 5-layer compression pipeline
│       ├── permission/        # 3-mode permission system
│       ├── memory/            # File-based memory system
│       ├── skills/            # Dynamic skill loader
│       ├── auth/              # API Key management
│       ├── persistence/       # SQLite session storage
│       ├── cost/              # Token + USD tracking
│       └── agent/             # Multi-agent coordinator
│
├── docs/                      # Documentation
├── .github/                   # GitHub templates
└── docker/                    # Deployment configs
```

### Core Data Flow

```
User Input → AgentEngine.submitMessage()
  → processUserInput()
  → QueryPipeline.run()
    → 5-Layer Compression (Snip → Micro → Collapse → Auto → Reactive)
    → DeepSeekGateway.stream()
    → Tool Execution (parallel read / serial write)
    → Error Recovery (PTL / max_tokens / media)
    → Result
```

See [docs/architecture.md](docs/architecture.md) for the complete architecture documentation.

---

## 🚀 Quick Start

```bash
# 1. Clone
git clone https://github.com/<your-org>/deepagi
cd deepagi

# 2. Install
pnpm install

# 3. Set API Key
cp .env.example .env
# Edit .env with your DEEPSEEK_API_KEY

# 4. Build
pnpm build

# 5. Test
pnpm test

# 6. Run Web UI
pnpm --filter @deepagi/web dev
# Open http://localhost:3000
```

### Prerequisites

- **Node.js** >= 18
- **pnpm** >= 9
- **DEEPSEEK_API_KEY** from [platform.deepseek.com](https://platform.deepseek.com)

---

## 🛠️ Tool List (44 total)

| Category | Tools |
|---|---|
| **Core** | bash, read, write, edit, glob, grep, web_fetch, web_search, ask_user, agent |
| **Task** | task_create, task_get, task_update, task_list, task_stop, task_output, todo_write |
| **Plan** | enter_plan_mode, exit_plan_mode |
| **MCP** | list_mcp_resources, read_mcp_resource, tool_search |
| **Data** | notebook_edit, config |
| **Cron** | cron_create, cron_delete, cron_list |
| **Specialized** | skill, sleep, snip, ctx_inspect, monitor, web_browser, brief |
| **Sprint 2+** | lsp, powershell, terminal_capture, send_message, team_create, team_delete, testing_permission, overflow_test, verify_plan |

Full details: [docs/tools-list.md](docs/tools-list.md)

---

## 🧪 Test Status

```
✓ 13 tests passing (4 test files)
✓ 0 TypeScript errors
✓ 57 public API exports
✓ Real DeepSeek API streaming verified
```

---

## 📄 License

MIT © 2026 DeepAGI Contributors. Lead: Dr. Yu Qiuhong (于秋鸿博士).

See [NOTICE.md](NOTICE.md) for third-party attributions.

---

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## ⭐ Star History

If you find DeepAGI useful, please give us a ⭐ on GitHub!
