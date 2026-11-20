import { useEffect, useId, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { listReports } from '../api/reports'
import LiveCount from '../components/LiveCount'
import PageErrorBoundary from '../components/PageErrorBoundary'
import SearchBar from '../components/SearchBar'
import { useLiveTick } from '../useLiveTick'

// Number of open reports next to the admin's "Reports" link. Read again every minute, when the admin comes back to
// the tab and after each page change (a decision on a report lowers it). Nothing is shown when it cannot be read.
function OpenReportCount() {
  const tick = useLiveTick(60_000)
  const { pathname } = useLocation()
  const [open, setOpen] = useState<number | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    listReports('open', 1, controller.signal)
      .then((page) => setOpen(page.total))
      .catch(() => undefined)
    return () => controller.abort()
  }, [tick, pathname])

  if (!open) return null
  return <span className="header-badge" aria-label={`${open} open`}><LiveCount value={open} /></span>
}

function HeaderAccount() {
  const { user, status, logout } = useAuth()
  const [busy, setBusy] = useState(false)

  async function onLogout() {
    setBusy(true)
    try {
      await logout()
    } finally {
      setBusy(false)
    }
  }

  if (status === 'loading') return <span className="header-account" />
  if (!user) return <Link className="header-login" to="/login">Log in</Link>

  return (
    <div className="header-account">
      {user.role === 'ADMIN' && <Link className="header-login" to="/admin/reports">Reports<OpenReportCount /></Link>}
      <span className="header-username">{user.username}</span>
      <button className="header-login" type="button" onClick={() => { void onLogout() }} disabled={busy}>Log out</button>
    </div>
  )
}

function SiteHeader() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  // The catalogue has its own search field; a second one in the header would do the same thing.
  const isCatalog = pathname === '/'

  function searchAssets(value: string) {
    // Clearing the field (×) on another page only empties it, it does not leave the page.
    if (value) navigate(`/?search=${encodeURIComponent(value)}`)
  }

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link className="brand" to="/" aria-label="assetStore home">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><span>assetStore</span>
        </Link>
        {isCatalog ? <span className="header-spacer" /> : <SearchBar value="" onSearch={searchAssets} />}
        {/* On a phone only "Publish": with the account links it still fits on the first row. */}
        <Link className="header-publish" to="/my/assets/new">Publish<span className="header-publish-more"> an asset</span></Link>
        <HeaderAccount />
      </div>
    </header>
  )
}

function initial(username: string): string {
  const first = Array.from(username.trim())[0]
  return first ? first.toLocaleUpperCase() : '?'
}

function WorkspaceHeader() {
  const { user, status, logout } = useAuth()
  const [menuPath, setMenuPath] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const menuId = useId()
  const menuRef = useRef<HTMLDivElement>(null)
  const { pathname } = useLocation()
  const open = menuPath === pathname

  useEffect(() => {
    if (!open) return
    function onPointer(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuPath(null)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuPath(null)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function onLogout() {
    setBusy(true)
    try {
      await logout()
    } finally {
      setBusy(false)
    }
  }

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link className="brand" to="/" aria-label="assetStore home">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><span>assetStore</span>
        </Link>
        <div className="header-account workspace-tools">
          <div className="workspace-menu" ref={menuRef}>
            <button
              type="button"
              className="workspace-menu-button"
              aria-expanded={open}
              aria-controls={menuId}
              onClick={() => setMenuPath(open ? null : pathname)}
            >
              My workspace
              <svg viewBox="0 0 12 8" width="12" height="8" aria-hidden="true"><path d="M1 1.5 L6 6.5 L11 1.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            {open && (
              <div className="workspace-menu-panel" id={menuId}>
                <NavLink to="/my/assets" end className={({ isActive }) => isActive ? 'active' : undefined} onClick={() => setMenuPath(null)}>My assets</NavLink>
                <NavLink to="/my/assets/new" className={({ isActive }) => isActive ? 'active' : undefined} onClick={() => setMenuPath(null)}>New asset</NavLink>
                <NavLink to="/" end onClick={() => setMenuPath(null)}>Catalogue</NavLink>
                <div className="menu-sep" />
                <button type="button" onClick={() => { void onLogout() }} disabled={busy}>Log out</button>
              </div>
            )}
          </div>
          {status !== 'loading' && user && (
            <span className="header-user">
              <span className="header-avatar" aria-hidden="true">{initial(user.username)}</span>
              <span className="header-user-name">{user.username}</span>
            </span>
          )}
        </div>
      </div>
    </header>
  )
}

const ADMIN_LINKS = [
  { to: '/admin/reports', label: 'Reports', showOpenCount: true },
  { to: '/admin/users', label: 'Suspended users', showOpenCount: false },
]

function AdminHeader() {
  const { user, status, logout } = useAuth()
  const [busy, setBusy] = useState(false)

  async function onLogout() {
    setBusy(true)
    try {
      await logout()
    } finally {
      setBusy(false)
    }
  }

  return (
    <header className="site-header">
      <div className="header-inner admin-header">
        <Link className="brand" to="/" aria-label="assetStore home">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><span>assetStore</span>
        </Link>
        <span className="admin-badge">Admin</span>
        <nav className="admin-nav" aria-label="Admin sections">
          {ADMIN_LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} className={({ isActive }) => isActive ? 'active' : undefined}>
              {link.label}
              {link.showOpenCount && <OpenReportCount />}
            </NavLink>
          ))}
        </nav>
        <div className="header-account">
          {status !== 'loading' && user && (
            <span className="header-user">
              <span className="header-avatar" aria-hidden="true">{initial(user.username)}</span>
              <span className="header-user-name">{user.username}</span>
            </span>
          )}
          <button className="header-login" type="button" onClick={() => { void onLogout() }} disabled={busy}>Log out</button>
        </div>
      </div>
    </header>
  )
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <Link className="brand footer-brand" to="/"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><span>assetStore</span></Link>
      <span>Free assets for the games we make together.</span>
      <Link className="text-link" to="/">Browse catalogue ↗</Link>
    </footer>
  )
}

export default function MainLayout() {
  const { pathname } = useLocation()
  const { user } = useAuth()
  const isAuthPage = pathname === '/login' || pathname === '/register'
  const isWorkspace = pathname === '/my' || pathname.startsWith('/my/')
  const isAdminSection = (pathname === '/admin' || pathname.startsWith('/admin/')) && user?.role === 'ADMIN'

  let header = <SiteHeader />
  if (isWorkspace) header = <WorkspaceHeader />
  else if (isAdminSection) header = <AdminHeader />

  return (
    <div className="app-shell">
      {!isAuthPage && header}
      <PageErrorBoundary key={pathname}>
        <Outlet />
      </PageErrorBoundary>
      {!isAuthPage && <SiteFooter />}
    </div>
  )
}
