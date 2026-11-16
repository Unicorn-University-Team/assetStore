import { Link, Outlet } from 'react-router-dom'
import { usePageTitle } from '../usePageTitle'
import { useAuth } from './auth-context'

// Inside RequireAuth: the user is logged in here. Admin pages for everybody else end at "no access";
// the backend refuses their requests with 403 anyway.
export function RequireAdmin() {
  const { user } = useAuth()
  if (user?.role === 'ADMIN') return <Outlet />
  return <NoAccess />
}

function NoAccess() {
  usePageTitle('No access')
  return (
    <main className="content-width page-state">
      <div className="state-box empty-state">
        <h1>No access</h1>
        <p>This page is only for admins.</p>
        <Link className="button button-primary" to="/">Back to the catalogue</Link>
      </div>
    </main>
  )
}
