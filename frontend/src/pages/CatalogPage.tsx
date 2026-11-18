import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { describeFailure } from '../api/client'
import { SEARCH_MAX_LENGTH, listAssets, type AssetPage } from '../api/assets'
import AssetGrid from '../components/AssetGrid'
import Pagination from '../components/Pagination'
import SearchBar from '../components/SearchBar'
import StatusMessage from '../components/StatusMessage'
import { useLiveTick } from '../useLiveTick'
import { usePageTitle } from '../usePageTitle'

export default function CatalogPage() {
  const [params, setParams] = useSearchParams()
  // A longer search typed into the URL is cut to what the API accepts.
  const search = (params.get('search') ?? '').slice(0, SEARCH_MAX_LENGTH)
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1)
  // The answer remembers which search and page it is for; loading = it is not for the current ones yet.
  const request = `${page}:${search}`
  const [loaded, setLoaded] = useState<{ request: string; result: AssetPage | null; error: string } | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  usePageTitle(search ? `“${search}” in the catalogue` : 'Catalogue')
  // Download counts and new assets show up without a reload.
  const tick = useLiveTick(30_000)

  useEffect(() => {
    const controller = new AbortController()
    listAssets(search, page, controller.signal)
      .then((result) => setLoaded({ request, result, error: '' }))
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return
        const failure = describeFailure(cause, 'Could not load the catalogue.')
        // A failed quiet refresh keeps the results already on the screen.
        setLoaded((previous) => previous?.request === request && previous.result ? previous : { request, result: null, error: failure.message })
      })
    return () => controller.abort()
  }, [search, page, request, tick, retryKey])

  const loading = loaded?.request !== request
  // While the next search or page loads, the previous results stay on the screen (dimmed) instead of a loading box,
  // so the page does not jump with every letter typed.
  const stale = loading && loaded?.result != null
  const result = loading ? (loaded?.result ?? null) : loaded.result
  const error = loading ? '' : loaded.error
  const assets = result?.items ?? []
  const showResults = !loading || stale

  function changeSearch(nextSearch: string) {
    const next = new URLSearchParams(params)
    const trimmed = nextSearch.trim()
    if (trimmed) next.set('search', trimmed)
    else next.delete('search')
    next.delete('page')
    // Typing more letters replaces the history entry: Back goes to the page before the search, not to every letter.
    setParams(next, { replace: Boolean(search && trimmed) })
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

  function retry() {
    setLoaded(null)
    setRetryKey((value) => value + 1)
  }

  return (
    <main className="content-width catalog-page">
      <div className="catalog-tools">
        <h1 className="catalog-title">Catalogue</h1>
        <SearchBar
          live
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
      {loading && !stale && <StatusMessage kind="loading" title="Loading assets" />}
      {!loading && error && (
        <StatusMessage kind="error" title="Could not load the catalogue" message={error}>
          <button type="button" className="button button-primary" onClick={retry}>Try again</button>
        </StatusMessage>
      )}
      <div className={stale ? 'live-results is-stale' : 'live-results'} aria-busy={stale}>
      {showResults && !error && !assets.length && (
        <StatusMessage
          kind="empty"
          title={search ? 'No assets found' : result && result.total > 0 ? 'This page is empty' : 'No assets yet'}
          message={search ? `Nothing matches “${search}”. Try another name.` : result && result.total > 0 ? 'There are fewer assets than this page needs.' : 'Published assets will show up here.'}
        >
          {search ? (
            <button type="button" className="button button-secondary" onClick={clearSearch}>Clear search</button>
          ) : result && result.total > 0 ? (
            <button type="button" className="button button-secondary" onClick={() => changePage(1)}>Back to the first page</button>
          ) : null}
        </StatusMessage>
      )}
      {showResults && !error && assets.length > 0 && <AssetGrid assets={assets} />}
      {showResults && !error && result && (
        <Pagination page={page} pageSize={result.pageSize} total={result.total} onChange={changePage} />
      )}
      </div>
    </main>
  )
}