import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { listAssets, type AssetPage } from '../api/assets'
import AssetGrid from '../components/AssetGrid'
import InlineError from '../components/InlineError'
import Pagination from '../components/Pagination'

const TYPES = [
  { id: '2d', name: '2D' }, { id: '3d', name: '3D' }, { id: 'map', name: 'Maps' },
  { id: 'sound', name: 'Sounds' }, { id: 'environment', name: 'Environments' },
]

export default function CatalogPage() {
  const [params, setParams] = useSearchParams()
  const search = params.get('search') ?? ''
  const type = params.get('type') ?? ''
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1)
  const [result, setResult] = useState<AssetPage | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    listAssets(search, page, controller.signal)
      .then(setResult)
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load the catalog.')
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [search, page])

  const assets = useMemo(() => result?.items.filter((asset) => !type || asset.type === type) ?? [], [result, type])

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
    const next = new URLSearchParams()
    if (search) next.set('search', search)
    setParams(next)
  }

  return (
    <main className="content-width catalog-page">
      <div className="breadcrumbs"><Link to="/">Home</Link><span>/</span><span>Catalog</span></div>
      <section className="catalog-intro"><div><p className="eyebrow">The asset library</p><h1>Find your next<br /><span>building block.</span></h1></div><p>Useful, free game assets made by people who build games. Browse, download and get back to making.</p></section>
      <section className="catalog-tools">
        <div className="filter-types" aria-label="Filter by asset type">{TYPES.map((item) => <button type="button" key={item.id} className={type === item.id ? 'filter-chip selected' : 'filter-chip'} aria-pressed={type === item.id} onClick={() => changeType(type === item.id ? '' : item.id)}>{item.name}</button>)}</div>
        <div className="catalog-meta"><span>{result?.total ?? '—'} assets</span><label className="sort-label">Sort <select defaultValue="newest"><option value="newest">Newest first</option></select></label></div>
      </section>
      {loading && <div className="state-box" role="status">Finding good stuff<span className="loading-dots">...</span></div>}
      {!loading && error && <InlineError message={error} />}
      {!loading && !error && !assets.length && <div className="state-box empty-state"><span className="empty-star">✳</span><h2>No assets found</h2><p>Try another name or clear the type filter.</p><button type="button" className="button button-secondary" onClick={clearFilters}>Clear filters</button></div>}
      {!loading && !error && assets.length > 0 && <AssetGrid assets={assets} />}
      {!loading && !error && result && <Pagination page={page} pageSize={result.pageSize} total={result.total} onChange={changePage} />}
    </main>
  )
}
