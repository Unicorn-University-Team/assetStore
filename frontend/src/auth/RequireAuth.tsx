import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { isAuthGuardPaused, useAuth } from './auth-context'

export function RequireAuth() {
  const { user, status } = useAuth()
  const location = useLocation()

  if (status === 'loading' || isAuthGuardPaused()) return null
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}
