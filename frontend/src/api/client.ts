// Same origin as the page: Caddy proxies /api to the backend, the Vite dev server does the same (vite.config.ts).
export const API_URL = '/api'

async function readError(response: Response, what: string): Promise<Error> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null
  return new Error(body?.error ?? `${what} failed with status ${response.status}`)
}

export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { signal })
  if (!response.ok) throw await readError(response, `GET ${path}`)
  return response.json() as Promise<T>
}

// multipart/form-data upload; the browser sets the Content-Type with the boundary itself.
export async function apiPostForm<T>(path: string, form: FormData, headers?: HeadersInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { method: 'POST', body: form, headers })
  if (!response.ok) throw await readError(response, `POST ${path}`)
  return response.json() as Promise<T>
}

export async function apiDelete(path: string, headers?: HeadersInit): Promise<void> {
  const response = await fetch(`${API_URL}${path}`, { method: 'DELETE', headers })
  if (!response.ok) throw await readError(response, `DELETE ${path}`)
}
