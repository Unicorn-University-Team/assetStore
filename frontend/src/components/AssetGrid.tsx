import type { ReactNode } from 'react'
import type { Asset } from '../api/assets'
import AssetCard from './AssetCard'

type AssetGridProps = {
  assets: Asset[]
  author?: string
  // Buttons under each card (My assets: Edit, Delete). The card itself is a link, so they cannot go inside it.
  actions?: (asset: Asset) => ReactNode
}

export default function AssetGrid({ assets, author, actions }: AssetGridProps) {
  return (
    <div className="asset-grid">
      {assets.map((asset) => actions ? (
        <div key={asset.id} className="asset-card-with-actions">
          <AssetCard asset={asset} author={author} />
          <div className="asset-card-actions">{actions(asset)}</div>
        </div>
      ) : <AssetCard key={asset.id} asset={asset} author={author} />)}
    </div>
  )
}
