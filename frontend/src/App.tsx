import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './App.css'
import { AuthProvider } from './auth/AuthProvider'
import { RequireAuth } from './auth/RequireAuth'
import MainLayout from './layouts/MainLayout'
import AssetDetailPage from './pages/AssetDetailPage'
import AuthPage from './pages/AuthPage'
import CatalogPage from './pages/CatalogPage'
import HomePage from './pages/HomePage'
import MockupAssetPage from './pages/MockupAssetPage'

function NotFoundPage() {
  return (
    <main className="content-width state-box empty-state">
      <h1>Page not found</h1>
      <p>The page you requested does not exist.</p>
      <a className="button button-primary" href="/">Back to the catalog</a>
    </main>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<MainLayout />}>
            <Route index element={<HomePage />} />
            <Route path="catalog" element={<CatalogPage />} />
            <Route path="assets/:id" element={<AssetDetailPage />} />
            <Route path="login" element={<AuthPage mode="login" />} />
            <Route path="register" element={<AuthPage mode="register" />} />
            <Route path="asset-mockup" element={<MockupAssetPage />} />
            {/* Real /my and /admin pages replace these placeholders; the guard already sends anonymous visitors to /login. */}
            <Route element={<RequireAuth />}>
              <Route path="my/*" element={<NotFoundPage />} />
              <Route path="admin/*" element={<NotFoundPage />} />
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
