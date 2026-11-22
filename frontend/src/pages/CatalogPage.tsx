import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { describeFailure } from '../api/client'
import { SEARCH_MAX_LENGTH, listAssets, type AssetPage } from '../api/assets'
import AssetGrid from '../components/AssetGrid'
import Pagination from '../components/Pagination'
import SearchBar from '../components/SearchBar'
import StatusMessage from '../components/StatusMessage'
import TagFilter from '../components/TagFilter'
import { useLiveTick } from '../useLiveTick'
import { usePageTitle } from '../usePageTitle'

export default function CatalogPage() {
  const [params, setParams] = useSearchParams()
  // A longer search typed into the URL is cut to what the API accepts.
  const search = (params.get('search') ?? '').slice(0, SEARCH_MAX_LENGTH)
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1)
  // Selected tags from the URL (AM route home: ?tags=medieval,low-poly), at most 10 like on an asset.
  const tagsParam = params.get('tags') ?? ''
  const tags = useMemo(
    // A name the API would refuse (hand-written URL) is left out instead of breaking the whole catalogue.
    () => [...new Set(tagsParam.split(',').map((tag) => tag.trim().toLowerCase()).filter((tag) => /^[a-z0-9-]{1,50}$/.test(tag)))].slice(0, 10),
    [tagsParam],
  )
  const filtered = Boolean(search) || tags.length > 0
  // The answer remembers which search, tags and page it is for; loading = it is not for the current ones yet.
  const request = `${page}:${search}:${tags.join(',')}`
  const [loaded, setLoaded] = useState<{ request: string; result: AssetPage | null; error: string } | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  usePageTitle(search ? `“${search}” in the catalogue` : 'Catalogue')
  // Download counts and new assets show up without a reload.
  const tick = useLiveTick(30_000)

  useEffect(() => {
    const controller = new AbortController()
    listAssets(search, page, controller.signal, tags)
      .then((result) => setLoaded({ request, result, error: '' }))
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return
        const failure = describeFailure(cause, 'Could not load the catalogue.')
        // A failed quiet refresh keeps the results already on the screen.
        setLoaded((previous) => previous?.request === request && previous.result ? previous : { request, result: null, error: failure.message })
      })
    return () => controller.abort()
  }, [search, page, tags, request, tick, retryKey])

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

  // A change of the tags goes back to the first page (AM: pageIndex 0 when the filter changes).
  function changeTags(nextTags: string[]) {
    const next = new URLSearchParams(params)
    if (nextTags.length) next.set('tags', nextTags.join(','))
    else next.delete('tags')
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
        <TagFilter selected={tags} onChange={changeTags} />
        {result && (
          <div className="catalog-meta">
            <span>{result.total} {result.total === 1 ? 'asset' : 'assets'}</span>
          </div>
        )}
      </div>
      {filtered && (
        <p className="catalog-search-note">
          Results{search ? ` for “${search}”` : ''}{tags.length ? ` with tags ${tags.join(', ')}` : ''}{' '}
          <button type="button" className="text-link" onClick={clearSearch}>
            {tags.length ? 'Clear filters' : 'Clear search'}
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
          title={filtered ? 'No assets found' : result && result.total > 0 ? 'This page is empty' : 'No assets yet'}
          message={filtered ? (tags.length ? (search ? `No asset has all the selected tags and matches “${search}”. Remove a tag or change the search.` : 'No asset has all the selected tags. Remove a tag.') : `Nothing matches “${search}”. Try another name.`) : result && result.total > 0 ? 'There are fewer assets than this page needs.' : 'Published assets will show up here.'}
        >
          {filtered ? (
            <button type="button" className="button button-secondary" onClick={clearSearch}>{tags.length ? 'Clear filters' : 'Clear search'}</button>
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