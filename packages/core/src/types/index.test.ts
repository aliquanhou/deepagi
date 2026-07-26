/**
 * Core types tests
 */

import { describe, it, expect } from 'vitest'

describe('Core types', () => {
  it('should be importable', async () => {
    const types = await import('./index.js')
    // Basic validation that the module loads
    expect(types).toBeDefined()
  })
})
