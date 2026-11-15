import { useEffect, useId, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import SearchBar from '../components/SearchBar'

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
      <span className="header-username">{user.username}</span>
      <button className="header-login" type="button" onClick={() => { void onLogout() }} disabled={busy}>Log out</button>
    </div>
  )
}

function SiteHeader() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const search = searchParams.get('search') ?? ''

  function searchAssets(value: string) {
    navigate(value ? `/?search=${encodeURIComponent(value)}` : '/')
  }

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link className="brand" to="/" aria-label="assetStore home">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><span>assetStore</span>
        </Link>
        {/* key: a new search in the URL (link, back button) starts the field over with that value */}
        <SearchBar key={search} value={search} onSearch={searchAssets} />
        <Link className="header-publish" to="/my/assets/new">Publish an asset</Link>
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
  const isAuthPage = pathname === '/login' || pathname === '/register'
  const isWorkspace = pathname === '/my' || pathname.startsWith('/my/')

  return (
    <div className="app-shell">
      {!isAuthPage && (isWorkspace ? <WorkspaceHeader /> : <SiteHeader />)}
      <Outlet />
      {!isAuthPage && <SiteFooter />}
    </div>
  )
}
