import { startTransition, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCurrentUser, logout as logoutRequest, type AuthUser } from '../api/auth'
import { ApiError, setSessionExpiredHandler } from '../api/client'
import { AuthContext, type AuthStatus } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')

  const refreshUser = useCallback(async () => {
    try {
      setUser(await getCurrentUser())
    } catch (error) {
      setUser(null)
      if (!(error instanceof ApiError && error.status === 401)) throw error
    } finally {
      setStatus('ready')
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    getCurrentUser(controller.signal)
      .then((current) => {
        if (!controller.signal.aborted) setUser(current)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || isAbort(error)) return
        setUser(null)
      })
      .finally(() => {
        if (!controller.signal.aborted) setStatus('ready')
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser(null)
      setStatus('ready')
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        navigate('/login', { replace: true })
      }
    })
  }, [navigate])

  const logout = useCallback(async () => {
    await logoutRequest()
    // Public pages (catalogue, asset detail) stay where they are; only pages behind RequireAuth go to the catalogue.
    const { pathname } = window.location
    if (!isProtectedPath(pathname)) {
      setUser(null)
      return
    }
    // React Router changes the location inside a transition. Clearing the user in the same transition
    // renders both together, so a protected page never sees "no user" and never redirects to /login.
    startTransition(() => {
      navigate('/', { replace: true })
      setUser(null)
    })
  }, [navigate])

  const value = useMemo(
    () => ({ user, status, refreshUser, logout }),
    [user, status, refreshUser, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// The paths that App.tsx puts behind RequireAuth.
function isProtectedPath(pathname: string): boolean {
  return /^\/(my|admin)(\/|$)/.test(pathname)
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === 'AbortError'
    : error instanceof Error && error.name === 'AbortError'
}
