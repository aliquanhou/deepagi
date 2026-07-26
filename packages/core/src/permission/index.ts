/**
 * DeepAGI Permission System
 *
 * Ported from Open-ClaudeCode's permission system.
 * Three modes: ask (default), allow (auto-approve), deny (auto-block).
 * Includes denial tracking with sliding window fallback.
 */

export type PermissionMode = 'ask' | 'allow' | 'deny'

export type PermissionRule = {
  toolName: string
  ruleContent?: string
}

export type PermissionDecision = {
  behavior: 'allow' | 'deny'
  reason?: string
}

// ============================================================================
// Permission Context
// ============================================================================

export type PermissionContext = {
  mode: PermissionMode
  alwaysAllowRules: Map<string, PermissionRule[]>
  alwaysDenyRules: Map<string, PermissionRule[]>
}

export function createPermissionContext(): PermissionContext {
  return {
    mode: 'ask',
    alwaysAllowRules: new Map(),
    alwaysDenyRules: new Map(),
  }
}

// ============================================================================
// Permission Check
// ============================================================================

/**
 * Check if a tool is allowed.
 * Follows the same precedence as Open-ClaudeCode:
 * 1. Always-deny rules → deny immediately
 * 2. Always-allow rules → allow immediately
 * 3. Mode → ask/allow/deny
 */
export function checkPermission(
  toolName: string,
  context: PermissionContext,
): PermissionDecision {
  // Step 1: Always-deny
  if (context.alwaysDenyRules.has(toolName)) {
    return { behavior: 'deny', reason: 'Always-deny rule matched' }
  }

  // Step 2: Always-allow
  if (context.alwaysAllowRules.has(toolName)) {
    return { behavior: 'allow', reason: 'Always-allow rule matched' }
  }

  // Step 3: Mode
  switch (context.mode) {
    case 'allow':
      return { behavior: 'allow', reason: 'Mode: allow' }
    case 'deny':
      return { behavior: 'deny', reason: 'Mode: deny' }
    case 'ask':
      // In ask mode, we always allow by default in headless mode.
      // Interactive mode prompts the user via the UI layer.
      return { behavior: 'allow', reason: 'Ask mode: default allow' }
  }
}

// ============================================================================
// Denial Tracking
// ============================================================================

type DenialRecord = {
  toolName: string
  timestamp: number
}

const denialWindow: DenialRecord[] = []
const WINDOW_SIZE = 5
const WINDOW_MS = 60_000 // 1 minute

/**
 * Track a denial event. When the sliding window threshold is reached,
 * the system falls back to prompting mode.
 */
export function trackDenial(toolName: string): void {
  const now = Date.now()

  // Prune expired records
  while (denialWindow.length > 0 && denialWindow[0]!.timestamp < now - WINDOW_MS) {
    denialWindow.shift()
  }

  denialWindow.push({ toolName, timestamp: now })
}

/**
 * Check if the denial window has reached its threshold.
 */
export function isDenialThresholdReached(): boolean {
  const now = Date.now()

  // Prune first
  while (denialWindow.length > 0 && denialWindow[0]!.timestamp < now - WINDOW_MS) {
    denialWindow.shift()
  }

  return denialWindow.length >= WINDOW_SIZE
}

/**
 * Get recent denials (for diagnostics)
 */
export function getRecentDenials(): DenialRecord[] {
  const now = Date.now()
  return denialWindow.filter(r => r.timestamp > now - WINDOW_MS)
}

/**
 * Reset denial tracking (for testing)
 */
export function resetDenialTracking(): void {
  denialWindow.length = 0
}
