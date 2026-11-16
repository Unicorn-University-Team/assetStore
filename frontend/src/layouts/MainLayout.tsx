import { useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
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
      <Link className="text-link" to="/">Browse catalogue ↗</Link>
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
