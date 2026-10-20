import type { ApiErrorCode } from '@games/contract'
import type { Context, ErrorHandler, NotFoundHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import type { Logger } from '../logger'

/** An expected failure with a stable code for the client: `{ error: { code, message } }`. */
export class HttpError extends Error {
  readonly status: ContentfulStatusCode
  readonly code: ApiErrorCode
  readonly headers: Readonly<Record<string, string>>

  constructor(status: ContentfulStatusCode, code: ApiErrorCode, message: string, headers: Readonly<Record<string, string>> = {}) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.code = code
    this.headers = headers
  }
}

export const errorBody = (code: ApiErrorCode, message: string) => ({ error: { code, message } })

export function errorResponse(c: Context, error: HttpError): Response {
  return c.json(errorBody(error.code, error.message), error.status, { ...error.headers })
}

export const unauthorized = (): HttpError => new HttpError(401, 'unauthorized', 'Sign in to continue.')

/** Maps a Hono HTTPException (thrown by built-in middleware) to our error shape. */
function fromHttpException(exception: HTTPException): HttpError {
  if (exception.status === 413) return new HttpError(413, 'payload_too_large', 'The request body is too large.')
  const status = exception.status >= 400 && exception.status < 500 ? exception.status : 500
  return new HttpError(status, status === 500 ? 'internal_error' : 'bad_request', status === 500 ? 'Something went wrong.' : 'Bad request.')
}

const RATE_LIMIT_LOG_EVERY_MS = 60_000
const RATE_LIMIT_LOG_PATHS = 100

/**
 * Expected errors keep their status and code; anything else is logged and
 * becomes a bare 500 — never a stack trace. Rate limiting is expected too, but
 * worth seeing (a limit too tight for real players drops their requests): it is
 * logged at most once a minute per path, with how many requests it turned away.
 */
export function createErrorHandler(logger: Logger, now: () => number = Date.now): ErrorHandler {
  const limited = new Map<string, { count: number; loggedAt: number }>()
  const noteRateLimited = (path: string): void => {
    if (limited.size >= RATE_LIMIT_LOG_PATHS && !limited.has(path)) limited.clear()
    const entry = limited.get(path) ?? { count: 0, loggedAt: -Infinity }
    entry.count += 1
    if (now() - entry.loggedAt >= RATE_LIMIT_LOG_EVERY_MS) {
      logger.warn('rate limited', { path, requests: entry.count })
      entry.count = 0
      entry.loggedAt = now()
    }
    limited.set(path, entry)
  }

  return (error, c) => {
    if (error instanceof HttpError) {
      if (error.status === 429) noteRateLimited(c.req.path)
      return errorResponse(c, error)
    }
    if (error instanceof HTTPException) return errorResponse(c, fromHttpException(error))
    logger.error('unhandled error', { method: c.req.method, path: c.req.path, error })
    return errorResponse(c, new HttpError(500, 'internal_error', 'Something went wrong.'))
  }
}

export const notFound: NotFoundHandler = (c) => errorResponse(c, new HttpError(404, 'not_found', 'Not found.'))
