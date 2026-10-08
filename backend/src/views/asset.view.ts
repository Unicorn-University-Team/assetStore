import type { Asset } from '../models/asset.model';

export interface AssetView {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export function toAssetView(asset: Asset): AssetView {
  return {
    id: asset.id,
    name: asset.name,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
  };
}
