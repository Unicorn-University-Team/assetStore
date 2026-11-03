import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './App.css'
import MainLayout from './layouts/MainLayout'
import HomePage from './pages/HomePage'
import MockupAssetPage from './pages/MockupAssetPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/asset-mockup" element={<MockupAssetPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App