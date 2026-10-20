import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { createLogger } from '../logger'
import { clientIp, resolveClientIp } from './client-ip'
import type { AppEnv } from './context'

describe('clientIp', () => {
  function appTrusting(trustProxy: number) {
    const lines: string[] = []
    const app = new Hono<AppEnv>()
    app.use('*', clientIp(trustProxy, createLogger({ level: 'warn', sink: (line) => lines.push(line) })))
    app.get('/', (c) => c.text(c.get('clientIp') ?? 'unknown'))
    return { app, lines }
  }

  it('warns once when a proxy passes the visitor’s address on but no proxy is trusted', async () => {
    const { app, lines } = appTrusting(0)
    await app.request('/')
    expect(lines).toEqual([])
    await app.request('/', { headers: { 'X-Forwarded-For': '203.0.113.7' } })
    await app.request('/', { headers: { 'X-Forwarded-For': '198.51.100.9' } })
    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain('TRUST_PROXY is 0')
  })

  it('stays quiet behind a trusted proxy, and uses the address it passed on', async () => {
    const { app, lines } = appTrusting(1)
    const response = await app.request('/', { headers: { 'X-Forwarded-For': '203.0.113.7' } })
    expect(await response.text()).toBe('203.0.113.7')
    expect(lines).toEqual([])
  })
})

describe('resolveClientIp', () => {
  it('uses the socket address when no proxy is trusted, ignoring X-Forwarded-For', () => {
    expect(resolveClientIp({ forwardedFor: '203.0.113.7', remoteAddress: '198.51.100.2', trustProxy: 0 })).toBe('198.51.100.2')
  })

  it('unwraps IPv4-mapped IPv6 socket addresses', () => {
    expect(resolveClientIp({ forwardedFor: undefined, remoteAddress: '::ffff:192.0.2.1', trustProxy: 0 })).toBe('192.0.2.1')
    expect(resolveClientIp({ forwardedFor: undefined, remoteAddress: '2001:DB8::1', trustProxy: 0 })).toBe('2001:db8::1')
  })

  it('behind N proxies, takes the Nth address from the right (the left part can be forged)', () => {
    const forwardedFor = '6.6.6.6, 203.0.113.7, 10.0.0.2'
    expect(resolveClientIp({ forwardedFor, remoteAddress: '10.0.0.3', trustProxy: 1 })).toBe('10.0.0.2')
    expect(resolveClientIp({ forwardedFor, remoteAddress: '10.0.0.3', trustProxy: 2 })).toBe('203.0.113.7')
    expect(resolveClientIp({ forwardedFor: '203.0.113.7', remoteAddress: '10.0.0.3', trustProxy: 3 })).toBe('203.0.113.7')
  })

  it('falls back to the socket when a trusted proxy sent no header', () => {
    expect(resolveClientIp({ forwardedFor: undefined, remoteAddress: '10.0.0.3', trustProxy: 1 })).toBe('10.0.0.3')
  })

  it('returns null for anything that is not an IP address', () => {
    expect(resolveClientIp({ forwardedFor: 'not-an-ip', remoteAddress: undefined, trustProxy: 1 })).toBeNull()
    expect(resolveClientIp({ forwardedFor: undefined, remoteAddress: undefined, trustProxy: 0 })).toBeNull()
    expect(resolveClientIp({ forwardedFor: ' , ', remoteAddress: undefined, trustProxy: 1 })).toBeNull()
  })
})
