import type { MiddlewareHandler } from 'hono'
import { HttpError } from '../http/errors'

const SAFE_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD', 'OPTIONS'])

export function isTrustedOrigin(origin: string | null | undefined, trustedOrigins: readonly string[]): boolean {
  return typeof origin === 'string' && origin !== 'null' && trustedOrigins.includes(origin)
}

/**
 * CSRF defence in depth for state-changing requests: browsers always send
 * `Origin` on POST/PUT/DELETE, so a missing or foreign origin is refused.
 * Paths under `skipPrefix` (Better Auth, which runs its own checks) pass through.
 */
export function requireTrustedOrigin(trustedOrigins: readonly string[], skipPrefix: string): MiddlewareHandler {
  return async (c, next) => {
    if (SAFE_METHODS.has(c.req.method) || c.req.path.startsWith(skipPrefix)) return next()
    if (!isTrustedOrigin(c.req.header('origin'), trustedOrigins)) {
      throw new HttpError(403, 'forbidden_origin', 'This request must come from the Trap The Orb site.')
    }
    return next()
  }
}
