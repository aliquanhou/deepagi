/**
 * DeepAGI Cost Tracker
 *
 * Ported from Open-ClaudeCode's cost-tracker.ts.
 * Tracks token usage and USD costs for DeepSeek API.
 */

// DeepSeek pricing per 1M tokens (deepseek-v4-flash)
const PRICING = {
  input: 0.27,        // $0.27 per 1M input tokens
  output: 1.10,       // $1.10 per 1M output tokens
  cacheRead: 0.07,    // $0.07 per 1M cache read tokens
  cacheWrite: 0.27,   // $0.27 per 1M cache write tokens
} as const

type UsageRecord = {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  timestamp: number
}

const usageHistory: UsageRecord[] = []
let sessionInput = 0
let sessionOutput = 0
let sessionCacheRead = 0
let sessionCacheWrite = 0
let totalCost = 0

/**
 * Track token usage from a model response.
 */
export function trackUsage(input: number, output: number, cacheRead = 0, cacheWrite = 0): void {
  sessionInput += input
  sessionOutput += output
  sessionCacheRead += cacheRead
  sessionCacheWrite += cacheWrite

  const cost = (input * PRICING.input + output * PRICING.output + cacheRead * PRICING.cacheRead + cacheWrite * PRICING.cacheWrite) / 1_000_000
  totalCost += cost

  usageHistory.push({
    inputTokens: input,
    outputTokens: output,
    cacheReadTokens: cacheRead,
    cacheWriteTokens: cacheWrite,
    timestamp: Date.now(),
  })
}

/**
 * Get current session usage.
 */
export function getUsage() {
  return {
    inputTokens: sessionInput,
    outputTokens: sessionOutput,
    cacheReadTokens: sessionCacheRead,
    cacheWriteTokens: sessionCacheWrite,
    totalCostUSD: totalCost,
  }
}

/**
 * Get cost breakdown.
 */
export function getCostBreakdown() {
  return {
    inputCost: (sessionInput * PRICING.input) / 1_000_000,
    outputCost: (sessionOutput * PRICING.output) / 1_000_000,
    cacheReadCost: (sessionCacheRead * PRICING.cacheRead) / 1_000_000,
    cacheWriteCost: (sessionCacheWrite * PRICING.cacheWrite) / 1_000_000,
    totalCostUSD: totalCost,
    inputTokens: sessionInput,
    outputTokens: sessionOutput,
  }
}

/**
 * Format cost for display.
 */
export function formatCost(usd: number): string {
  if (usd < 0.001) return '<$0.001'
  return `$${usd.toFixed(3)}`
}

/**
 * Format tokens for display.
 */
export function formatTokens(tokens: number): string {
  if (tokens < 1000) return `${tokens}`
  if (tokens < 1_000_000) return `${(tokens / 1000).toFixed(1)}K`
  return `${(tokens / 1_000_000).toFixed(2)}M`
}

/**
 * Get usage history for analytics.
 */
export function getUsageHistory() {
  return [...usageHistory]
}

/**
 * Reset session usage (for new conversation).
 */
export function resetSessionUsage(): void {
  sessionInput = 0
  sessionOutput = 0
  sessionCacheRead = 0
  sessionCacheWrite = 0
  totalCost = 0
}

/**
 * Get DeepSeek pricing table.
 */
export function getPricing() {
  return PRICING
}
