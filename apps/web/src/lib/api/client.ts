import {
  apiErrorSchema,
  configResponseSchema,
  finishRunResponseSchema,
  leaderboardResponseSchema,
  meResponseSchema,
  startRunResponseSchema,
  updateProfileResponseSchema,
  type ConfigResponse,
  type FinishRunRequest,
  type FinishRunResponse,
  type LeaderboardQuery,
  type LeaderboardResponse,
  type MeResponse,
  type StartRunRequest,
  type StartRunResponse,
  type UpdateProfileResponse,
} from '@games/contract'

/** A failed API call: `code` comes from the server (or 'network' / 'invalid_response'). */
export class ApiError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

interface Schema<T> {
  safeParse(data: unknown): { success: true; data: T } | { success: false }
}

interface RequestOptions<T> {
  readonly method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  readonly body?: unknown
  readonly schema?: Schema<T>
  readonly signal?: AbortSignal
  /** Let the request finish even if the page is closed meanwhile (small bodies only). */
  readonly keepalive?: boolean
}

async function readError(response: Response): Promise<ApiError> {
  const parsed = apiErrorSchema.safeParse(await response.json().catch(() => null))
  return parsed.success
    ? new ApiError(parsed.data.error.code, parsed.data.error.message, response.status)
    : new ApiError('http_error', `Request failed (${response.status})`, response.status)
}

/** Browsers cap keep-alive request bodies at 64 KB. */
const KEEPALIVE_LIMIT_BYTES = 60_000
const JSON_ACCEPT = { Accept: 'application/json' }
const JSON_SEND = { Accept: 'application/json', 'Content-Type': 'application/json' }

/** Same-origin JSON request; validates the response against the shared contract. */
export async function apiRequest<T>(
  path: string,
  { method = 'GET', body, schema, signal, keepalive = false }: RequestOptions<T> = {},
): Promise<T> {
  const json = body === undefined ? undefined : JSON.stringify(body)
  let response: Response
  try {
    response = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: json === undefined ? JSON_ACCEPT : JSON_SEND,
      body: json,
      signal,
      keepalive: keepalive && json !== undefined && json.length <= KEEPALIVE_LIMIT_BYTES,
    })
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError('network', 'Could not reach the server', 0)
  }

  if (!response.ok) throw await readError(response)
  if (!schema) return undefined as T

  const parsed = schema.safeParse(await response.json().catch(() => null))
  if (!parsed.success) throw new ApiError('invalid_response', 'Unexpected response from the server', response.status)
  return parsed.data
}

export const api = {
  config: (): Promise<ConfigResponse> => apiRequest('/api/config', { schema: configResponseSchema }),
  me: (): Promise<MeResponse> => apiRequest('/api/me', { schema: meResponseSchema }),
  updateProfile: (nickname: string): Promise<UpdateProfileResponse> =>
    apiRequest('/api/me/profile', { method: 'PUT', body: { nickname }, schema: updateProfileResponseSchema }),
  deleteAccount: (): Promise<void> => apiRequest('/api/me', { method: 'DELETE' }),
  startRun: (request: StartRunRequest): Promise<StartRunResponse> =>
    apiRequest('/api/runs', { method: 'POST', body: request, schema: startRunResponseSchema }),
  finishRun: (runId: string, request: FinishRunRequest): Promise<FinishRunResponse> =>
    apiRequest(`/api/runs/${encodeURIComponent(runId)}/finish`, {
      method: 'POST',
      body: request,
      schema: finishRunResponseSchema,
      // The result still counts if the player closes the tab while it is on its way.
      keepalive: true,
    }),
  leaderboard: ({ board, period, date }: LeaderboardQuery, signal?: AbortSignal): Promise<LeaderboardResponse> => {
    const params = new URLSearchParams({ board, period })
    if (date) params.set('date', date)
    return apiRequest(`/api/leaderboards?${params.toString()}`, { schema: leaderboardResponseSchema, signal })
  },
}

/**
 * Best-effort "finish" while the page is going away: the request outlives the
 * page. Returns false when the recording is too large to send this way.
 */
export function finishRunOnExit(runId: string, request: FinishRunRequest): boolean {
  const body = JSON.stringify(request)
  if (body.length > KEEPALIVE_LIMIT_BYTES) return false
  void fetch(`/api/runs/${encodeURIComponent(runId)}/finish`, {
    method: 'POST',
    credentials: 'same-origin',
    keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    body,
  }).catch(() => undefined)
  return true
}
