import { apiGet, apiPost } from './client'

export type AuthUser = {
  id: string
  username: string
  email: string
  role: 'USER' | 'ADMIN'
  status: 'ACTIVE' | 'SUSPENDED'
}

type MeResponse = { user: AuthUser }

export function getCurrentUser(signal?: AbortSignal): Promise<AuthUser> {
  return apiGet<MeResponse>('/auth/me', signal).then((body) => body.user)
}

export function logout(): Promise<void> {
  return apiPost('/auth/logout')
}
