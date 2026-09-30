import { afterEach, describe, expect, it, vi } from 'vitest'
import { createId } from './id'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createId', () => {
  it('uses randomUUID when available', () => {
    expect(createId()).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('falls back to random bytes outside secure contexts', () => {
    vi.stubGlobal('crypto', { getRandomValues: (bytes: Uint8Array) => bytes.fill(171) })

    expect(createId()).toBe('ab'.repeat(16))
  })
})
