/**
 * DeepAGI Auth System
 *
 * API Key management with runtime switching and optional OAuth.
 * Supports: env var, runtime set, keychain (future).
 */

export type AuthMethod = 'env' | 'runtime' | 'oauth'
export type AuthState = {
  method: AuthMethod
  apiKey: string | null
  provider: string
  isAuthenticated: boolean
}

let runtimeState: AuthState = {
  method: 'env',
  apiKey: null,
  provider: 'deepseek',
  isAuthenticated: false,
}

/**
 * Initialize auth from environment.
 * Priority: runtime key > env var > unauthenticated
 */
export function initAuth(): AuthState {
  const envKey = process.env.DEEPSEEK_API_KEY
  if (runtimeState.apiKey) {
    runtimeState.isAuthenticated = true
  } else if (envKey) {
    runtimeState = { ...runtimeState, apiKey: envKey, method: 'env', isAuthenticated: true }
  } else {
    runtimeState = { ...runtimeState, isAuthenticated: false }
  }
  return runtimeState
}

/**
 * Set API key at runtime (e.g., from Web UI settings).
 */
export function setApiKey(key: string): AuthState {
  runtimeState = { method: 'runtime', apiKey: key, provider: 'deepseek', isAuthenticated: true }
  return runtimeState
}

/**
 * Clear API key (logout).
 */
export function clearApiKey(): AuthState {
  runtimeState = { method: 'env', apiKey: null, provider: 'deepseek', isAuthenticated: false }
  return runtimeState
}

/**
 * Get current API key (from runtime or env).
 */
export function getApiKey(): string | null {
  return runtimeState.apiKey ?? process.env.DEEPSEEK_API_KEY ?? null
}

/**
 * Check if authenticated.
 */
export function isAuthenticated(): boolean {
  return getApiKey() !== null
}

/**
 * Get current auth state.
 */
export function getAuthState(): AuthState {
  const key = getApiKey()
  return {
    ...runtimeState,
    apiKey: key,
    isAuthenticated: key !== null,
  }
}

/**
 * Verify API key by making a lightweight API call.
 */
export async function verifyApiKey(key?: string): Promise<{ valid: boolean; error?: string }> {
  const apiKey = key ?? getApiKey()
  if (!apiKey) return { valid: false, error: 'No API key' }

  try {
    const response = await fetch('https://api.deepseek.com/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10000),
    })
    return { valid: response.ok, error: response.ok ? undefined : `HTTP ${response.status}` }
  } catch (error: any) {
    return { valid: false, error: error.message }
  }
}
