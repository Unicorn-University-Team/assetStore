import { useEffect, useState } from 'react'
import { API_URL, apiGet } from './api/client'
import './App.css'
import AssetsDemo from './components/AssetsDemo'

type Health = { status: string; database?: string; storage?: string }

type BackendState =
  | { kind: 'loading' }
  | { kind: 'ok'; health: Health; ms: number }
  | { kind: 'error'; message: string }

function App() {
  const [backend, setBackend] = useState<BackendState>({ kind: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    const started = performance.now()

    apiGet<Health>('/health', controller.signal)
      .then((health) => setBackend({ kind: 'ok', health, ms: Math.round(performance.now() - started) }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setBackend({ kind: 'error', message: error instanceof Error ? error.message : String(error) })
      })

    return () => controller.abort()
  }, [])

  return (
    <main className="page">
      <h1>Asset Store</h1>
      <p className="muted">The page is empty for now. The asset catalog is coming soon.</p>

      <section className="card">
        <h2>Backend status</h2>
        {backend.kind === 'loading' && <p className="muted">Checking…</p>}
        {backend.kind === 'ok' && (
          <p className="ok">
            ● Connected: <code>{JSON.stringify(backend.health)}</code> in {backend.ms} ms
          </p>
        )}
        {backend.kind === 'error' && (
          <p className="error">● Not reachable: {backend.message}</p>
        )}
        <p className="muted small">
          GET <code>{API_URL}/health</code>
        </p>
      </section>

      <AssetsDemo />
    </main>
  )
}

export default App
