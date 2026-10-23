import { useEffect, useState } from 'react'
import { API_URL, apiGet } from './api/client'
import './App.css'
import AssetsDemo from './components/AssetsDemo'

const SERVICES = ['identity', 'catalog', 'community'] as const
type Service = (typeof SERVICES)[number]

type Health = { service: string; status: string; database?: string; storage?: string }

type ServiceState =
  | { kind: 'loading' }
  | { kind: 'ok'; health: Health; ms: number }
  | { kind: 'error'; message: string }

const LOADING: Record<Service, ServiceState> = {
  identity: { kind: 'loading' },
  catalog: { kind: 'loading' },
  community: { kind: 'loading' },
}

function App() {
  const [services, setServices] = useState<Record<Service, ServiceState>>(LOADING)

  useEffect(() => {
    const controller = new AbortController()

    for (const service of SERVICES) {
      const started = performance.now()
      const update = (state: ServiceState) => setServices((current) => ({ ...current, [service]: state }))

      apiGet<Health>(`/health/${service}`, controller.signal)
        .then((health) => update({ kind: 'ok', health, ms: Math.round(performance.now() - started) }))
        .catch((error: unknown) => {
          if (controller.signal.aborted) return
          update({ kind: 'error', message: error instanceof Error ? error.message : String(error) })
        })
    }

    return () => controller.abort()
  }, [])

  return (
    <main className="page">
      <h1>Asset Store</h1>
      <p className="muted">The page is empty for now. The asset catalog is coming soon.</p>

      <section className="card">
        <h2>Backend services</h2>
        {SERVICES.map((service) => {
          const state = services[service]
          return (
            <p key={service} className={state.kind === 'ok' ? 'ok' : state.kind === 'error' ? 'error' : 'muted'}>
              ● <strong>{service}</strong>
              {state.kind === 'loading' && ': checking…'}
              {state.kind === 'ok' && (
                <>
                  : <code>{JSON.stringify(state.health)}</code> in {state.ms} ms
                </>
              )}
              {state.kind === 'error' && `: not reachable (${state.message})`}
            </p>
          )
        })}
        <p className="muted small">
          GET <code>{API_URL}/health/&lt;service&gt;</code>
        </p>
      </section>

      <AssetsDemo />
    </main>
  )
}

export default App
