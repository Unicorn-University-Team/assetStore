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

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
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

  if (!response.ok) throw await responseError(response)
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

export function apiPost<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  return request<T>(path, { method: 'POST', body: JSON.stringify(body), signal })
}

export function apiPostForm<T>(path: string, form: FormData, headers?: HeadersInit): Promise<T> {
  return request<T>(path, { method: 'POST', body: form, headers })
}

export function apiDelete(path: string, headers?: HeadersInit): Promise<void> {
  return request<void>(path, { method: 'DELETE', headers })
}
