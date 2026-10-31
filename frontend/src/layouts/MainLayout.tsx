import { Link, Outlet } from 'react-router-dom'

export default function MainLayout() {
  return (
    <div>
      <header>
        <nav>
          <strong>Game Asset Store</strong> |{' '}
          <Link to="/">Main Page (Catalog)</Link> |{' '}
          <Link to="/asset-mockup">Mockup Asset</Link>
        </nav>
        <hr />
      </header>

      {/* Outlet vykreslí aktuální stránku podle URL adresy */}
      <Outlet />
    </div>
  )
}