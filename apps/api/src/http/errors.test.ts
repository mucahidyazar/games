import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import * as z from 'zod/mini'
import { describe, expect, it } from 'vitest'
import { createLogger } from '../logger'
import { describeIssues } from './body'
import { createErrorHandler, HttpError, notFound } from './errors'

function appThrowing(error: unknown) {
  const lines: string[] = []
  const app = new Hono()
  app.onError(createErrorHandler(createLogger({ level: 'error', sink: (line) => lines.push(line) })))
  app.notFound(notFound)
  app.get('/boom', () => {
    throw error
  })
  return { app, lines }
}

describe('createErrorHandler', () => {
  it('returns expected errors with their status, code and headers', async () => {
    const { app } = appThrowing(new HttpError(429, 'rate_limited', 'Slow down.', { 'Retry-After': '9' }))
    const response = await app.request('/boom')
    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBe('9')
    expect(await response.json()).toEqual({ error: { code: 'rate_limited', message: 'Slow down.' } })
  })

  it("maps Hono's HTTP exceptions onto the same shape", async () => {
    const tooLarge = await appThrowing(new HTTPException(413)).app.request('/boom')
    expect(tooLarge.status).toBe(413)
    expect(await tooLarge.json()).toMatchObject({ error: { code: 'payload_too_large' } })

    const badRequest = await appThrowing(new HTTPException(400)).app.request('/boom')
    expect(await badRequest.json()).toMatchObject({ error: { code: 'bad_request' } })

    const serverSide = await appThrowing(new HTTPException(502)).app.request('/boom')
    expect(serverSide.status).toBe(500)
  })

  it('hides unexpected errors behind a generic 500 and logs them', async () => {
    const { app, lines } = appThrowing(new Error('database password is hunter2'))
    const response = await app.request('/boom')
    expect(response.status).toBe(500)
    const body = await response.text()
    expect(body).toBe('{"error":{"code":"internal_error","message":"Something went wrong."}}')
    expect(lines.join('')).toContain('unhandled error')
  })

  it('answers unknown routes with a JSON 404', async () => {
    const response = await appThrowing(null).app.request('/missing')
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: { code: 'not_found', message: 'Not found.' } })
  })
})

describe('describeIssues', () => {
  it('names the path of the first problem', () => {
    const result = z.object({ inputs: z.array(z.object({ c: z.int() })) }).safeParse({ inputs: [{ c: 1 }, { c: 'x' }] })
    expect(result.success).toBe(false)
    if (!result.success) expect(describeIssues(result.error)).toMatch(/^inputs\.1\.c: /)
  })

  it('works for top-level problems', () => {
    const result = z.string().safeParse(3)
    if (!result.success) expect(describeIssues(result.error)).not.toContain(':  ')
  })
})
