import { describe, expect, it } from 'vitest'
import { isUniqueViolation } from './errors'

describe('isUniqueViolation', () => {
  it('finds the Postgres code directly or a few causes deep (Drizzle wraps driver errors)', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true)
    expect(isUniqueViolation(new Error('query failed', { cause: { code: '23505' } }))).toBe(true)
    expect(isUniqueViolation(new Error('a', { cause: new Error('b', { cause: { code: '23505' } }) }))).toBe(true)
  })

  it('ignores other errors and non-errors', () => {
    expect(isUniqueViolation({ code: '23503' })).toBe(false)
    expect(isUniqueViolation(new Error('boom'))).toBe(false)
    expect(isUniqueViolation(null)).toBe(false)
    expect(isUniqueViolation('23505')).toBe(false)
  })

  it('gives up on absurdly deep or circular cause chains', () => {
    const circular: { code: string; cause?: unknown } = { code: 'x' }
    circular.cause = circular
    expect(isUniqueViolation(circular)).toBe(false)
  })
})
