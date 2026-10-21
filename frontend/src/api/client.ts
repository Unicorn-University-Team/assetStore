// Same origin as the page: Caddy proxies /api to the backend, the Vite dev server does the same (vite.config.ts).
export const API_URL = '/api'

export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { signal })
  if (!response.ok) {
    throw new Error(`GET ${path} failed with status ${response.status}`)
  }
  return response.json() as Promise<T>
}
