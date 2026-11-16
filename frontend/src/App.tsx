import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { AuthProvider } from './auth/AuthProvider'
import { RequireAdmin } from './auth/RequireAdmin'
import { RequireAuth } from './auth/RequireAuth'
import MainLayout from './layouts/MainLayout'
import AdminReportsPage from './pages/AdminReportsPage'
import AssetDetailPage from './pages/AssetDetailPage'
import AuthPage from './pages/AuthPage'
import CatalogPage from './pages/CatalogPage'
import ReportDetailPage from './pages/ReportDetailPage'
import { usePageTitle } from './usePageTitle'

function NotFoundPage() {
  usePageTitle('Page not found')
  return (
    <main className="content-width page-state">
      <div className="state-box empty-state">
        <h1>Page not found</h1>
        <p>The page you requested does not exist.</p>
        <Link className="button button-primary" to="/">Back to the catalogue</Link>
      </div>
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
            {/* /my is still a placeholder (the guard already sends anonymous visitors to /login); /admin needs the ADMIN role. */}
            <Route element={<RequireAuth />}>
              <Route path="my/*" element={<NotFoundPage />} />
              <Route element={<RequireAdmin />}>
                <Route path="admin" element={<Navigate to="/admin/reports" replace />} />
                <Route path="admin/reports" element={<AdminReportsPage />} />
                <Route path="admin/reports/:id" element={<ReportDetailPage />} />
                <Route path="admin/*" element={<NotFoundPage />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
