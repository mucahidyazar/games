import { isIP } from 'node:net'
import { getConnInfo } from '@hono/node-server/conninfo'
import type { Context, MiddlewareHandler } from 'hono'
import type { AppEnv } from './context'

const IPV4_MAPPED_PREFIX = '::ffff:'

function normalizeIp(candidate: string | undefined): string | null {
  const trimmed = candidate?.trim()
  if (!trimmed) return null
  const lower = trimmed.toLowerCase()
  const address = lower.startsWith(IPV4_MAPPED_PREFIX) && isIP(lower.slice(IPV4_MAPPED_PREFIX.length)) === 4
    ? lower.slice(IPV4_MAPPED_PREFIX.length)
    : lower
  return isIP(address) === 0 ? null : address
}

export interface ClientIpSources {
  readonly forwardedFor: string | undefined
  readonly remoteAddress: string | undefined
  /** Number of reverse proxies in front of the API; 0 ignores X-Forwarded-For entirely. */
  readonly trustProxy: number
}

/**
 * The client address used for rate limiting. Behind N trusted proxies, the
 * Nth X-Forwarded-For entry from the right is the address the outermost proxy
 * saw; entries further left can be forged by the client.
 */
export function resolveClientIp({ forwardedFor, remoteAddress, trustProxy }: ClientIpSources): string | null {
  if (trustProxy > 0 && forwardedFor) {
    const hops = forwardedFor.split(',').map((hop) => hop.trim()).filter(Boolean)
    const hop = hops[Math.max(0, hops.length - trustProxy)]
    return normalizeIp(hop)
  }
  return normalizeIp(remoteAddress)
}

function socketAddress(c: Context): string | undefined {
  try {
    return getConnInfo(c).remote.address
  } catch {
    // No Node socket, e.g. requests made in-process with app.request().
    return undefined
  }
}

export function clientIp(trustProxy: number): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    c.set('clientIp', resolveClientIp({ forwardedFor: c.req.header('x-forwarded-for'), remoteAddress: socketAddress(c), trustProxy }))
    await next()
  }
}
