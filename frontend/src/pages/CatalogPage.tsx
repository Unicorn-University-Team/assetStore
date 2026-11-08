import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { listAssets, type AssetPage } from '../api/assets'
import AssetGrid from '../components/AssetGrid'
import InlineError from '../components/InlineError'
import Pagination from '../components/Pagination'
import SearchBar from '../components/SearchBar'

const TYPES = [
  { id: '2d', name: '2D' }, { id: '3d', name: '3D' }, { id: 'map', name: 'Maps' },
  { id: 'sound', name: 'Sounds' }, { id: 'environment', name: 'Environments' },
]

export default function CatalogPage() {
  const [params, setParams] = useSearchParams()
  const search = params.get('search') ?? ''
  const type = params.get('type') ?? ''
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
            error: cause instanceof Error ? cause.message : 'Could not load the catalog.',
          })
        }
      })
    return () => controller.abort()
  }, [search, page, request])

  const loading = loaded?.request !== request
  // While the next page loads, the previous total stays in the header.
  const result = loaded?.result ?? null
  const error = loading ? '' : loaded.error

  const assets = useMemo(
    () => result?.items.filter((asset) => !type || asset.type === type) ?? [],
    [result, type]
  )

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
  }

  function changeType(nextType: string) {
    const next = new URLSearchParams(params)
    if (nextType) next.set('type', nextType)
    else next.delete('type')
    next.delete('page')
    setParams(next)
  }

  function clearFilters() {
    setParams(new URLSearchParams())
  }

  return (
    <main className="content-width catalog-page">
      <div className="breadcrumbs"><Link to="/">Home</Link><span>/</span><span>Catalog</span></div>
      <section className="catalog-intro">
        <div>
          <p className="eyebrow">The asset library</p>
          <h1>Find your next<br /><span>building block.</span></h1>
        </div>
        <p>Useful, free game assets made by people who build games. Browse, download and get back to making.</p>
      </section>
      <section className="catalog-tools">
        <SearchBar
          key={search}
          id="catalog-search"
          placeholder="Search catalog by name…"
          value={search}
          onSearch={changeSearch}
        />
        <div className="filter-types" aria-label="Filter by asset type">
          {TYPES.map((item) => (
            <button
              type="button"
              key={item.id}
              className={type === item.id ? 'filter-chip selected' : 'filter-chip'}
              aria-pressed={type === item.id}
              onClick={() => changeType(type === item.id ? '' : item.id)}
            >
              {item.name}
            </button>
          ))}
          {search && (
            <button
              type="button"
              className="filter-chip selected"
              onClick={() => changeSearch('')}
              aria-label={`Clear name search: ${search}`}
            >
              Name: “{search}” ×
            </button>
          )}
        </div>
        <div className="catalog-meta">
          <span>{result?.total ?? '—'} assets</span>
          <label className="sort-label">
            Sort <select defaultValue="newest"><option value="newest">Newest first</option></select>
          </label>
        </div>
      </section>
      {loading && <div className="state-box" role="status">Finding good stuff<span className="loading-dots">...</span></div>}
      {!loading && error && <InlineError message={error} />}
      {!loading && !error && !assets.length && (
        <div className="state-box empty-state">
          <span className="empty-star">✳</span>
          <h2>No assets found</h2>
          <p>
            {search
              ? `No assets matching “${search}”. Try another name or clear the filters.`
              : 'Try another name or clear the type filter.'}
          </p>
          <button type="button" className="button button-secondary" onClick={clearFilters}>
            Clear filters
          </button>
        </div>
      )}
      {!loading && !error && assets.length > 0 && <AssetGrid assets={assets} />}
      {!loading && !error && result && (
        <Pagination page={page} pageSize={result.pageSize} total={result.total} onChange={changePage} />
      )}
    </main>
  )
}