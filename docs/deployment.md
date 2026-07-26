# Deployment Guide

## Local Development

```bash
pnpm --filter @deepagi/web dev
# http://localhost:3000
```

## Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN corepack enable && pnpm install && pnpm build
EXPOSE 3000
CMD ["pnpm", "--filter", "@deepagi/web", "start"]
```

```bash
docker build -t deepagi -f docker/Dockerfile .
docker run -p 3000:3000 -e DEEPSEEK_API_KEY=sk-... deepagi
```

## Docker Compose

See `docker/docker-compose.yml`.

## Vercel

1. Push to GitHub
2. Import repo in Vercel
3. Set `DEEPSEEK_API_KEY` in environment variables
4. Deploy

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DEEPSEEK_API_KEY` | ✅ | — | DeepSeek API key |
| `DEEPSEEK_BASE_URL` | — | `https://api.deepseek.com` | Custom API endpoint |
| `DEEPSEEK_MODEL` | — | `deepseek-v4-flash` | Model name |
| `PORT` | — | `3000` | Server port |
