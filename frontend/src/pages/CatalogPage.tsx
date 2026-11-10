import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { listAssets, type AssetPage } from '../api/assets'
import AssetGrid from '../components/AssetGrid'
import InlineError from '../components/InlineError'
import Pagination from '../components/Pagination'
import SearchBar from '../components/SearchBar'

export default function CatalogPage() {
  const [params, setParams] = useSearchParams()
  const search = params.get('search') ?? ''
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1)
  // The answer remembers which search and page it is for; loading = it is not for the current ones yet.
  const request = `${page}:${search}`
  const [loaded, setLoaded] = useState<{ request: string; result: AssetPage | null; error: string } | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    listAssets(search, page, controller.signal)
      .then((result) => setLoaded({ request, result, error: '' }))
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setLoaded({
            request,
            result: null,
            error: cause instanceof Error ? cause.message : 'Could not load the catalogue.',
          })
        }
      })
    return () => controller.abort()
  }, [search, page, request])

  const loading = loaded?.request !== request
  const result = loading ? null : loaded.result
  const error = loading ? '' : loaded.error
  const assets = result?.items ?? []

  function changeSearch(nextSearch: string) {
    const next = new URLSearchParams(params)
    const trimmed = nextSearch.trim()
    if (trimmed) next.set('search', trimmed)
    else next.delete('search')
    next.delete('page')
    setParams(next)
  }

  function changePage(nextPage: number) {
    const next = new URLSearchParams(params)
    if (nextPage <= 1) next.delete('page')
    else next.set('page', String(nextPage))
    setParams(next)
    window.scrollTo({ top: 0 })
  }

  function clearSearch() {
    setParams(new URLSearchParams())
  }

  return (
    <main className="content-width catalog-page">
      <div className="catalog-tools">
        <h1 className="catalog-title">Catalogue</h1>
        <SearchBar
          key={search}
          id="catalog-search"
          placeholder="Search catalogue by name…"
          value={search}
          onSearch={changeSearch}
        />
        {result && (
          <div className="catalog-meta">
            <span>{result.total} {result.total === 1 ? 'asset' : 'assets'}</span>
          </div>
        )}
      </div>
      {search && (
        <p className="catalog-search-note">
          Results for “{search}”{' '}
          <button type="button" className="text-link" onClick={clearSearch}>
            Clear search
          </button>
        </p>
      )}
      {loading && <div className="state-box" role="status">Loading assets<span className="loading-dots">...</span></div>}
      {!loading && error && <InlineError message={error} />}
      {!loading && !error && !assets.length && (
        <div className="state-box empty-state">
          <span className="empty-star">✳</span>
          {search ? (
            <>
              <h2>No assets found</h2>
              <p>Nothing matches “{search}”. Try another name.</p>
              <button type="button" className="button button-secondary" onClick={clearSearch}>
                Clear search
              </button>
            </>
          ) : result && result.total > 0 ? (
            <>
              <h2>This page is empty</h2>
              <p>There are fewer assets than this page needs.</p>
              <button type="button" className="button button-secondary" onClick={() => changePage(1)}>
                Back to the first page
              </button>
            </>
          ) : (
            <>
              <h2>No assets yet</h2>
              <p>Published assets will show up here.</p>
            </>
          )}
        </div>
      )}
      {!loading && !error && assets.length > 0 && <AssetGrid assets={assets} />}
      {!loading && !error && result && (
        <Pagination page={page} pageSize={result.pageSize} total={result.total} onChange={changePage} />
      )}
    </main>
  )
}