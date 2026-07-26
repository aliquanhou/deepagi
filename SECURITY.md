# Security Policy

## Supported Versions

| Version | Supported |
|---|---|
| 0.1.x (latest) | ✅ |
| < 0.1 | ❌ |

## Reporting a Vulnerability

If you discover a security vulnerability in DeepAGI, please report it privately.

**Do not** report security vulnerabilities through public GitHub issues.

Instead, please email: security@deepagi.ai (or open a private advisory on GitHub).

We will acknowledge receipt within 48 hours and provide a timeline for a fix.

## Scope

- API key leakage in logs or transcripts
- Remote code execution via tool inputs
- Authentication bypass
- Data exfiltration

## Best Practices

1. **Always use environment variables** for API keys (never hardcode)
2. **Review tool permissions** before enabling new tools
3. **Use the permission system** in `ask` mode for sensitive operations
4. **Keep dependencies updated** via `pnpm audit`
