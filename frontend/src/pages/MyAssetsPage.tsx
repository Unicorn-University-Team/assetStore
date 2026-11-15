import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { listMyAssets, type AssetPage } from '../api/assets'
import { useAuth } from '../auth/auth-context'
import AssetGrid from '../components/AssetGrid'
import InlineError from '../components/InlineError'
import Pagination from '../components/Pagination'

export default function MyAssetsPage() {
  const { user } = useAuth()
  const ownerId = user?.id ?? ''
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1)
  const request = `${ownerId}:${page}`
  const [loaded, setLoaded] = useState<{ request: string; result: AssetPage | null; error: string } | null>(null)

  useEffect(() => {
    if (!ownerId) return
    const controller = new AbortController()
    listMyAssets(ownerId, page, controller.signal)
      .then((result) => setLoaded({ request, result, error: '' }))
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setLoaded({
            request,
            result: null,
            error: cause instanceof Error ? cause.message : 'Could not load your assets.',
          })
        }
      })
    return () => controller.abort()
  }, [ownerId, page, request])

  const loading = loaded?.request !== request
  const result = loading ? null : loaded.result
  const error = loading ? '' : loaded.error
  const assets = result?.items ?? []

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
      {loading && <div className="state-box" role="status">Loading your assets<span className="loading-dots">...</span></div>}
      {!loading && error && <InlineError message={error} />}
      {!loading && !error && !assets.length && (
        <div className="state-box empty-state">
          <span className="empty-star">✳</span>
          {result && result.total > 0 ? (
            <>
              <h2>This page is empty</h2>
              <p>There are fewer assets than this page needs.</p>
              <button type="button" className="button button-secondary" onClick={() => changePage(1)}>Back to the first page</button>
            </>
          ) : (
            <>
              <h2>No assets yet</h2>
              <p>Assets you publish show up here and in the catalogue.</p>
              <Link className="button button-primary" to="/my/assets/new">Publish an asset</Link>
            </>
          )}
        </div>
      )}
      {!loading && !error && assets.length > 0 && <AssetGrid assets={assets} author={user?.username} />}
      {!loading && !error && result && (
        <Pagination page={page} pageSize={result.pageSize} total={result.total} onChange={changePage} label="My assets pages" />
      )}
    </main>
  )
}
