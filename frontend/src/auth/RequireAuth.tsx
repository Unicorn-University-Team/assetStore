import { Navigate, Outlet, useLocation } from 'react-router-dom'
import StatusMessage from '../components/StatusMessage'
import { useAuth } from './auth-context'

export function RequireAuth() {
  const { user, status } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return (
      <main className="content-width page-state">
        <StatusMessage kind="loading" title="Loading your account" />
      </main>
    )
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}
