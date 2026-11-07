import { Link } from 'react-router-dom'
import type { Asset } from '../api/assets'
import AssetTypeIcon from './AssetTypeIcon'

const TYPE_LABELS: Record<string, string> = {
  '2d': '2D', '3d': '3D', map: 'Map', sound: 'Sound', environment: 'Environment',
}

function Rating({ average, count }: { average: number | null; count: number }) {
  if (average == null) return <span className="asset-card-rating">No reviews yet</span>
  const filled = Math.round(average)
  return (
    <span className="asset-card-rating">
      <span className="card-stars" aria-hidden="true">{'★'.repeat(filled)}<span className="star-empty">{'★'.repeat(5 - filled)}</span></span>
      <span className="sr-only">Rated</span>
      <strong>{average.toFixed(1)}</strong>
      <span>({count}<span className="sr-only"> {count === 1 ? 'review' : 'reviews'}</span>)</span>
    </span>
  )
}

export default function AssetCard({ asset }: { asset: Asset }) {
  return (
    <Link className="asset-card" to={`/assets/${encodeURIComponent(asset.id)}`}>
      <span className={`asset-cover cover-${asset.type}`} aria-hidden="true" />
      <span className="asset-card-body">
        <span className="asset-card-type"><AssetTypeIcon type={asset.type} />{TYPE_LABELS[asset.type] ?? asset.type}</span>
        <strong className="asset-card-title">{asset.name}</strong>
        <Rating average={asset.averageRating} count={asset.reviewCount} />
        <span className="asset-card-foot">
          <span className="asset-card-author">{asset.ownerName ?? 'Unknown author'}</span>
          <span className="asset-card-downloads">
            <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 1.5 V8 M3 5.5 L6 8.5 L9 5.5 M1.5 10.5 H10.5" /></svg>
            {asset.downloadCount.toLocaleString('en-US')}
            <span className="sr-only"> downloads</span>
          </span>
        </span>
      </span>
    </Link>
  )
}
