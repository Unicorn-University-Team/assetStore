import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { AuthProvider } from './auth/AuthProvider'
import { RequireAuth } from './auth/RequireAuth'
import MainLayout from './layouts/MainLayout'
import AssetDetailPage from './pages/AssetDetailPage'
import AuthPage from './pages/AuthPage'
import CatalogPage from './pages/CatalogPage'
import MockupAssetPage from './pages/MockupAssetPage'
import MyAssetsPage from './pages/MyAssetsPage'
import NewAssetPage from './pages/NewAssetPage'

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
            <Route index element={<CatalogPage />} />
            <Route path="catalog" element={<Navigate to="/" replace />} />
            <Route path="assets/:id" element={<AssetDetailPage />} />
            <Route path="login" element={<AuthPage mode="login" />} />
            <Route path="register" element={<AuthPage mode="register" />} />
            <Route path="asset-mockup" element={<MockupAssetPage />} />
            <Route element={<RequireAuth />}>
              <Route path="my" element={<Navigate to="/my/assets" replace />} />
              <Route path="my/assets" element={<MyAssetsPage />} />
              <Route path="my/assets/new" element={<NewAssetPage />} />
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
