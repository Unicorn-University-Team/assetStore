import { createContext, useContext } from 'react'
import type { AuthUser } from '../api/auth'

export type AuthStatus = 'loading' | 'ready'

export type AuthContextValue = {
  user: AuthUser | null
  status: AuthStatus
  refreshUser: () => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

// Logout clears the user while a protected page is still on screen. Pausing the guard
// for that moment stops it from sending the visitor to /login before the redirect home.
let guardPaused = false

export function pauseAuthGuard() {
  guardPaused = true
}

export function resumeAuthGuard() {
  guardPaused = false
}

export function isAuthGuardPaused() {
  return guardPaused
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used within AuthProvider')
  return value
}
