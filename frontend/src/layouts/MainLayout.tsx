import { Link, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import SearchBar from '../components/SearchBar'

function SiteHeader() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  function searchAssets(value: string) {
    navigate(value ? `/catalog?search=${encodeURIComponent(value)}` : '/catalog')
  }

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link className="brand" to="/" aria-label="assetStore home">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><span>assetStore</span>
        </Link>
        <SearchBar value={searchParams.get('search') ?? ''} onSearch={searchAssets} />
        <Link className="header-publish" to="/login">Publish an asset</Link>
        <Link className="header-login" to="/login">Log in</Link>
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
