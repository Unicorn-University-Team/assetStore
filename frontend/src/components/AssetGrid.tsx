import type { Asset } from '../api/assets'
import AssetCard from './AssetCard'

export default function AssetGrid({ assets }: { assets: Asset[] }) {
  return <div className="asset-grid">{assets.map((asset, index) => <AssetCard key={asset.id} asset={asset} index={index} />)}</div>
}
