# Getting Started with DeepAGI

## Prerequisites

- **Node.js** >= 18
- **pnpm** >= 9 (`npm install -g pnpm`)
- **DeepSeek API Key** from [platform.deepseek.com](https://platform.deepseek.com)

## Installation

```bash
git clone https://github.com/<your-org>/deepagi
cd deepagi
pnpm install
cp .env.example .env
```

Edit `.env` and add your API key:

```
DEEPSEEK_API_KEY=sk-your-key-here
```

## Build

```bash
pnpm build
```

## Run Web UI

```bash
pnpm --filter @deepagi/web dev
```

Open http://localhost:3000

## Run Tests

```bash
# All tests
pnpm test

# Core only
pnpm --filter @deepagi/core test

# With real API (requires DEEPSEEK_API_KEY)
pnpm --filter @deepagi/core test
```

## API Usage (Node.js)

```typescript
import { AgentEngine, getAllTools } from '@deepagi/core'

const engine = new AgentEngine({
  cwd: process.cwd(),
  tools: getAllTools().map(t => ({
    name: t.name,
    description: t.description(),
    inputSchema: t.inputSchema,
  })),
  deepseekApiKey: process.env.DEEPSEEK_API_KEY!,
})

for await (const message of engine.submitMessage('Hello!')) {
  if (message.type === 'assistant') {
    console.log(message.message.content)
  }
}
```

## Docker

```bash
docker build -t deepagi -f docker/Dockerfile .
docker run -p 3000:3000 -e DEEPSEEK_API_KEY=sk-... deepagi
```
