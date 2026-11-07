export const API_URL = '/api'

type ApiErrorBody = { error?: unknown; message?: unknown; details?: unknown }

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function responseError(response: Response): Promise<ApiError> {
  const rawBody = await response.text().catch(() => '')
  const contentType = response.headers.get('content-type') ?? ''
  let message = ''

  if (rawBody && contentType.includes('application/json')) {
    try {
      const body = JSON.parse(rawBody) as ApiErrorBody
      if (typeof body.error === 'string') message = body.error
      else if (typeof body.message === 'string') message = body.message
      else if (Array.isArray(body.details)) message = body.details.map(String).join(', ')
    } catch {
      message = ''
    }
  } else {
    message = rawBody.trim().slice(0, 240)
  }

  return new ApiError(message || response.statusText || `Request failed (${response.status})`, response.status)
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === 'AbortError'
    : error instanceof Error && error.name === 'AbortError'
}

// Login and register 401s are wrong credentials, not an expired access token.
// /auth/me is the session probe: a failed refresh means "logged out", not "send the visitor to /login".
const REFRESH_EXEMPT = new Set(['/auth/login', '/auth/register', '/auth/logout', '/auth/refresh'])

let refreshInFlight: Promise<boolean> | null = null
let onSessionExpired = () => {
  if (window.location.pathname !== '/login') window.location.assign('/login')
}

export function setSessionExpiredHandler(handler: () => void) {
  onSessionExpired = handler
}

function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null
      })
  }
  return refreshInFlight
}

async function request<T>(path: string, init: RequestInit = {}, retried = false): Promise<T> {
  const headers = new Headers(init.headers)
  if (!headers.has('Accept')) headers.set('Accept', 'application/json')
  if (init.body != null && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: 'include' })
  } catch (error) {
    if (isAbortError(error)) throw error
    throw new Error('Could not connect to the server. Check your connection and try again.')
  }

  if (!response.ok) {
    if (response.status === 401 && !retried && !REFRESH_EXEMPT.has(path)) {
      const refreshed = await refreshSession()
      if (refreshed) return request(path, init, true)
      // The session probe failing is the logged-out state. Other 401s mean the session is gone.
      if (path !== '/auth/me') onSessionExpired()
    }
    throw await responseError(response)
  }
  if (response.status === 204) return undefined as T

  const body = await response.text()
  if (!body.trim()) return undefined as T

  try {
    return JSON.parse(body) as T
  } catch {
    throw new Error('The server returned an unreadable response.')
  }
}

export function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  return request<T>(path, { signal })
}

export function apiPost<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  })
}

export function apiPostForm<T>(path: string, form: FormData, headers?: HeadersInit): Promise<T> {
  return request<T>(path, { method: 'POST', body: form, headers })
}

export function apiDelete(path: string, headers?: HeadersInit): Promise<void> {
  return request<void>(path, { method: 'DELETE', headers })
}
