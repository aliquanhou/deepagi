# Contributing to DeepAGI

We love contributions! Here's how to get started.

## Code of Conduct

This project adheres to the [Contributor Covenant](CODE_OF_CONDUCT.md). By participating, you agree to uphold this code.

## Development Process

### 1. Setup

```bash
git clone https://github.com/<your-org>/deepagi
cd deepagi
pnpm install
cp .env.example .env  # Add your DEEPSEEK_API_KEY
```

### 2. Branch Strategy

- `main` — stable, release-ready
- `develop` — integration branch
- `feat/*` — new features (e.g., `feat/web-search-tool`)
- `fix/*` — bug fixes
- `docs/*` — documentation changes

### 3. Code Standards

- **TypeScript**: Strict mode. No `any` unless absolutely necessary.
- **Formatting**: Use prettier (`pnpm format`)
- **Imports**: Prefer named exports. Relative imports within package.
- **Tests**: Add tests for new features. Run `pnpm test`.

### 4. Pull Request Process

1. Fork the repo and create your branch from `develop`
2. Make your changes
3. Run `pnpm build` and `pnpm test` — both must pass
4. Update docs if needed
5. Submit a PR with a clear description

### 5. Commit Messages

Follow conventional commits:

```
feat: add web_search tool
fix: correct tool_call_id mapping in DeepSeekGateway
docs: update architecture diagram
test: add orchestrator partition tests
```

## Project Structure

```
packages/core/     — Core engine (TypeScript)
apps/web/          — Web UI (Next.js 14)
docs/              — Documentation
```

## Testing

```bash
# All tests
pnpm test

# Core only
pnpm --filter @deepagi/core test

# Web only
pnpm --filter @deepagi/web test
```

## Questions?

Open a [Discussion](https://github.com/<your-org>/deepagi/discussions) or [Issue](https://github.com/<your-org>/deepagi/issues).
