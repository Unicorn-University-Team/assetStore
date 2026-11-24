import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { AuthProvider } from './auth/AuthProvider'
import { RequireAdmin } from './auth/RequireAdmin'
import { RequireAuth } from './auth/RequireAuth'
import MainLayout from './layouts/MainLayout'
import AdminReportsPage from './pages/AdminReportsPage'
import AssetDetailPage from './pages/AssetDetailPage'
import AuthPage from './pages/AuthPage'
import CatalogPage from './pages/CatalogPage'
import MyAssetsPage from './pages/MyAssetsPage'
import NewAssetPage from './pages/NewAssetPage'
import EditAssetPage from './pages/EditAssetPage'
import NotFoundPage from './pages/NotFoundPage'
import ReportDetailPage from './pages/ReportDetailPage'

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
            {/* /my: the owner's workspace; /admin needs the ADMIN role. */}
            <Route element={<RequireAuth />}>
              <Route path="my" element={<Navigate to="/my/assets" replace />} />
              <Route path="my/assets" element={<MyAssetsPage />} />
              <Route path="my/assets/new" element={<NewAssetPage />} />
              <Route path="my/assets/:id/edit" element={<EditAssetPage />} />
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
