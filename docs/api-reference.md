# DeepAGI API Reference

## @deepagi/core

### AgentEngine

```typescript
class AgentEngine {
  constructor(config: EngineConfig)
  submitMessage(prompt: string, options?): AsyncGenerator<SDKMessage>
  interrupt(): void
  getMessages(): SDKMessage[]
}
```

### QueryPipeline

```typescript
class QueryPipeline {
  constructor(config: PipelineConfig)
  run(params): AsyncGenerator<SDKAssistantMessage | SDKStreamEvent, Terminal>
}
```

### DeepSeekGateway

```typescript
class DeepSeekGateway {
  constructor(config: DeepSeekConfig)
  stream(options: GatewayOptions): AsyncGenerator<SDKAssistantMessage | SDKStreamEvent>
}
```

### Tool System

```typescript
// Create a tool
const myTool: Tool = {
  name: 'my_tool',
  inputSchema: { type: 'object', properties: { ... } },
  description: () => '...',
  isConcurrencySafe: () => true,
  isReadOnly: () => true,
  isEnabled: () => true,
  async call(args, context) { return { data: result } },
}

// Use registry
import { getAllTools, getTools, filterToolsByDenyRules } from '@deepagi/core'
```

### Compression

```typescript
import { snipCompact, microcompact, contextCollapse, autoCompact, reactiveCompact } from '@deepagi/core'
```

### Permission

```typescript
import { createPermissionContext, checkPermission, trackDenial } from '@deepagi/core'
```

### Memory

```typescript
import { saveMemory, getMemory, listMemories, searchMemories, deleteMemory } from '@deepagi/core'
```

### Auth

```typescript
import { initAuth, setApiKey, getApiKey, verifyApiKey, isAuthenticated } from '@deepagi/core'
```

### Persistence

```typescript
import { initPersistence, createSession, appendMessage, listSessions, getSessionMessages } from '@deepagi/core'
```

### Cost

```typescript
import { trackUsage, getUsage, getCostBreakdown, formatCost, formatTokens } from '@deepagi/core'
```

### Multi-Agent

```typescript
import { Coordinator } from '@deepagi/core'

const coord = new Coordinator(apiKey)
const agent = await coord.createAgent('worker-1', 'Analyze this data')
await coord.runAgent(agent.id, 'You are a data analyst...')
```
