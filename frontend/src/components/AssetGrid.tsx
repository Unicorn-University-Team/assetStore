import type { Asset } from '../api/assets'
import AssetCard from './AssetCard'

export default function AssetGrid({ assets, author }: { assets: Asset[]; author?: string }) {
  return <div className="asset-grid">{assets.map((asset) => <AssetCard key={asset.id} asset={asset} author={author} />)}</div>
}
