import { useState } from 'react'
import { Link, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
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
    navigate(value ? `/catalog?search=${encodeURIComponent(value)}` : '/catalog')
  }

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link className="brand" to="/" aria-label="assetStore home">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><span>assetStore</span>
        </Link>
        {/* key: a new search in the URL (link, back button) starts the field over with that value */}
        <SearchBar key={search} value={search} onSearch={searchAssets} />
        <Link className="header-publish" to="/login">Publish an asset</Link>
        <HeaderAccount />
      </div>
    </header>
  )
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <Link className="brand footer-brand" to="/"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><span>assetStore</span></Link>
      <span>Free assets for the games we make together.</span>
      <Link className="text-link" to="/catalog">Browse catalog ↗</Link>
    </footer>
  )
}

export default function MainLayout() {
  const { pathname } = useLocation()
  const isAuthPage = pathname === '/login' || pathname === '/register'

  return (
    <div className="app-shell">
      {!isAuthPage && <SiteHeader />}
      <Outlet />
      {!isAuthPage && <SiteFooter />}
    </div>
  )
}
