import { Link } from 'react-router-dom'
import type { Asset } from '../api/assets'

const TYPE_NAMES: Record<string, string> = {
  '2d': '2D', '3d': '3D', map: 'Maps', sound: 'Sounds', environment: 'Environments',
}
const GLYPHS = ['✳', '◇', '◉', '⌁', '✣']

export default function AssetCard({ asset, index = 0 }: { asset: Asset; index?: number }) {
  const typeName = TYPE_NAMES[asset.type] ?? asset.type
  return (
    <Link className="asset-card" to={`/assets/${encodeURIComponent(asset.id)}`} aria-label={`Open ${asset.name}`}>
      <span className={`asset-cover cover-${index % 5}`}>
        <span className="cover-type">{typeName}</span>
        {asset.previewUrl
          ? <img className="cover-preview" src={asset.previewUrl} alt="" loading="lazy" />
          : <><span className="cover-glyph" aria-hidden="true">{GLYPHS[index % GLYPHS.length]}</span><span className="cover-name">{asset.name.slice(0, 1).toUpperCase()}</span></>}
      </span>
      <span className="asset-card-body">
        <span className="asset-card-type">{typeName}</span>
        <strong className="asset-card-title">{asset.name}</strong>
        <span className="asset-card-description">{asset.description || 'A free asset for your next project.'}</span>
        <span className="asset-card-foot"><span className="rating-empty">{asset.averageRating == null ? 'No ratings yet' : `★ ${asset.averageRating.toFixed(1)} · ${asset.reviewCount}`}</span><span className="asset-price">Free <span>↗</span></span></span>
      </span>
    </Link>
  )
}
