import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { describeFailure } from '../api/client'
import { listMyAssets, type AssetPage } from '../api/assets'
import { useAuth } from '../auth/auth-context'
import AssetGrid from '../components/AssetGrid'
import Pagination from '../components/Pagination'
import StatusMessage from '../components/StatusMessage'
import { useLiveTick } from '../useLiveTick'

export default function MyAssetsPage() {
  const { user } = useAuth()
  const ownerId = user?.id ?? ''
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1)
  const request = `${ownerId}:${page}`
  const [loaded, setLoaded] = useState<{ request: string; result: AssetPage | null; error: string } | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  // Download counts of the user's assets stay current without a reload.
  const tick = useLiveTick(30_000)

  useEffect(() => {
    if (!ownerId) return
    const controller = new AbortController()
    listMyAssets(page, controller.signal)
      .then((result) => setLoaded({ request, result, error: '' }))
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return
        const failure = describeFailure(cause, 'Could not load your assets.')
        // A failed quiet refresh keeps the assets already on the screen.
        setLoaded((previous) => previous?.request === request && previous.result ? previous : { request, result: null, error: failure.message })
      })
    return () => controller.abort()
  }, [ownerId, page, request, tick, retryKey])

  const loading = loaded?.request !== request
  const result = loading ? null : loaded.result
  const error = loading ? '' : loaded.error
  const assets = result?.items ?? []

  function retry() {
    setLoaded(null)
    setRetryKey((value) => value + 1)
  }

  function changePage(nextPage: number) {
    const next = new URLSearchParams(params)
    if (nextPage <= 1) next.delete('page')
    else next.set('page', String(nextPage))
    setParams(next)
    window.scrollTo({ top: 0 })
  }

  return (
    <main className="content-width workspace-page">
      <div className="workspace-heading">
        <div>
          <h1>My assets</h1>
          {result && <p className="workspace-count">{result.total} {result.total === 1 ? 'asset' : 'assets'}</p>}
        </div>
        <Link className="button button-primary" to="/my/assets/new">New asset</Link>
      </div>
      {loading && <StatusMessage kind="loading" title="Loading your assets" />}
      {!loading && error && (
        <StatusMessage kind="error" title="Could not load your assets" message={error}>
          <button type="button" className="button button-primary" onClick={retry}>Try again</button>
        </StatusMessage>
      )}
      {!loading && !error && !assets.length && (
        <StatusMessage
          kind="empty"
          title={result && result.total > 0 ? 'This page is empty' : 'No assets yet'}
          message={result && result.total > 0 ? 'There are fewer assets than this page needs.' : 'Assets you publish show up here and in the catalogue.'}
        >
          {result && result.total > 0 ? (
            <button type="button" className="button button-secondary" onClick={() => changePage(1)}>Back to the first page</button>
          ) : (
            <Link className="button button-primary" to="/my/assets/new">Publish an asset</Link>
          )}
        </StatusMessage>
      )}
      {!loading && !error && assets.length > 0 && <AssetGrid assets={assets} author={user?.username} />}
      {!loading && !error && result && (
        <Pagination page={page} pageSize={result.pageSize} total={result.total} onChange={changePage} label="My assets pages" />
      )}
    </main>
  )
}
