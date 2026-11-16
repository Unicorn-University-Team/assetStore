import { ApiError, apiGet, apiPost } from './client'

export type AuthUser = {
  id: string
  username: string
  email: string
  role: 'USER' | 'ADMIN'
  status: 'ACTIVE' | 'SUSPENDED'
}

// user is null when the visitor has no session cookie at all (identity answers 200, not 401).
type MeResponse = { user: AuthUser | null }

// Rejects with ApiError 401 when nobody is logged in, as it did before identity started answering { user: null }.
export function getCurrentUser(signal?: AbortSignal): Promise<AuthUser> {
  return apiGet<MeResponse>('/auth/me', signal).then((body) => {
    if (!body.user) throw new ApiError('Not logged in.', 401)
    return body.user
  })
}

export function logout(): Promise<void> {
  return apiPost('/auth/logout')
}
