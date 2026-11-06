import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { apiGet } from '../api/client'
import type { Asset } from '../api/assets'
import InlineError from '../components/InlineError'

const TYPE_NAMES: Record<string, string> = {
  '2d': '2D', '3d': '3D', map: 'Maps', sound: 'Sounds', environment: 'Environments',
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`
}

export default function AssetDetailPage() {
  const { id = '' } = useParams()
  const [asset, setAsset] = useState<Asset | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    setAsset(null)
    setError('')
    apiGet<Asset>(`/assets/${encodeURIComponent(id)}`, controller.signal)
      .then(setAsset)
      .catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load this asset.') })
    return () => controller.abort()
  }, [id])

  if (error) return <main className="content-width"><div className="breadcrumbs"><Link to="/catalog">Catalog</Link><span>/</span><span>Asset</span></div><InlineError message={error} /></main>
  if (!asset) return <main className="content-width"><div className="state-box" role="status">Loading asset…</div></main>

  const typeName = TYPE_NAMES[asset.type] ?? asset.type
  return (
    <main className="content-width asset-detail-page">
      <div className="breadcrumbs"><Link to="/">Home</Link><span>/</span><Link to="/catalog">{typeName}</Link><span>/</span><span>{asset.name}</span></div>
      <div className="asset-detail-layout">
        <section className="asset-main-column">
          <div className="detail-cover">
            {asset.previewUrl
              ? <img className="detail-preview" src={asset.previewUrl} alt={`${asset.name} preview`} />
              : <><span className="detail-shape shape-a"/><span className="detail-shape shape-b"/><span className="detail-shape shape-c"/><span className="detail-cover-name">{asset.name.slice(0, 1).toUpperCase()}</span></>}
            <span className="detail-cover-type">{typeName}</span>
          </div>
          <div className="detail-tabs"><span className="active">Overview</span><span>Reviews ({asset.reviewCount})</span></div>
          <section className="detail-section"><p className="eyebrow">About this asset</p><h2>Overview</h2><p className="detail-description">{asset.description || 'The creator has not added a description yet.'}</p>{asset.tagList.length > 0 && <div className="asset-tags" aria-label="Tags">{asset.tagList.map((tag) => <span className="asset-tag" key={tag}>{tag}</span>)}</div>}</section>
          <section className="detail-section reviews-section"><div><p className="eyebrow">From the community</p><h2>Reviews</h2></div><div className="reviews-placeholder">{asset.averageRating == null ? <><span className="empty-star">✳</span><strong>No reviews yet</strong><p>Ratings will show up here after people have used this asset.</p></> : <><strong>★ {asset.averageRating.toFixed(1)} average rating</strong><p>Based on {asset.reviewCount} {asset.reviewCount === 1 ? 'review' : 'reviews'}.</p></>}</div></section>
        </section>
        <aside className="asset-sidebar">
          <p className="eyebrow">{typeName} asset</p><h1>{asset.name}</h1><p className="asset-owner">{asset.ownerName ? `By ${asset.ownerName}` : 'Shared by the community'}</p>
          <div className="rating-row"><span className="rating-stars">{asset.averageRating == null ? '☆☆☆☆☆' : `★ ${asset.averageRating.toFixed(1)}`}</span><span>{asset.averageRating == null ? 'No ratings yet' : `${asset.reviewCount} ${asset.reviewCount === 1 ? 'review' : 'reviews'}`}</span></div>
          <div className="download-count">{asset.downloadCount.toLocaleString()} downloads</div>
          <a className="button button-primary download-button" href={`/api/assets/${encodeURIComponent(asset.id)}/download`}>Download <span>↓</span><small>{formatSize(asset.fileSize)}</small></a>
          <p className="free-note">Free to download · no account needed</p><div className="sidebar-rule"/>
          <dl className="asset-facts"><div><dt>File</dt><dd>{asset.fileName}</dd></div><div><dt>Size</dt><dd>{formatSize(asset.fileSize)}</dd></div><div><dt>Published</dt><dd>{new Date(asset.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</dd></div><div><dt>Downloads</dt><dd>{asset.downloadCount.toLocaleString()}</dd></div></dl>
          <Link className="report-link" to="/login">Report this asset</Link>
        </aside>
      </div>
    </main>
  )
}
