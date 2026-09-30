import type { Context } from 'hono'
import type * as z from 'zod/mini'
import { HttpError } from './errors'

const JSON_CONTENT_TYPE = /^application\/json\s*(?:;|$)/i

/** Short, value-free description of the first validation problem, e.g. "inputs.3.c: Too big". */
export function describeIssues(error: z.core.$ZodError): string {
  const issue = error.issues[0]
  if (!issue) return 'Invalid request.'
  const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : ''
  return `${path}${issue.message}`
}

/**
 * Reads a JSON body and validates it. 415 when the body is not declared as
 * JSON, 400 when it does not parse, 422 when it does not match the schema.
 */
export async function readJson<T>(c: Context, schema: z.ZodMiniType<T>): Promise<T> {
  if (!JSON_CONTENT_TYPE.test(c.req.header('content-type') ?? '')) {
    throw new HttpError(415, 'unsupported_media_type', 'Send the body as JSON (Content-Type: application/json).')
  }
  let body: unknown
  try {
    body = JSON.parse(await c.req.text())
  } catch {
    throw new HttpError(400, 'invalid_json', 'The request body is not valid JSON.')
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) throw new HttpError(422, 'invalid_request', describeIssues(parsed.error))
  return parsed.data
}
