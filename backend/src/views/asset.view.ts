import type { Asset } from '../models/asset.model';

// What the client sees. The S3 key (fileKey) is internal and never leaves the backend.
export interface AssetView {
  id: string;
  name: string;
  description: string;
  type: string;
  fileName: string;
  fileSize: number;
  downloadCount: number;
  createdAt: string;
  updatedAt: string;
}

export function toAssetView(asset: Asset): AssetView {
  return {
    id: asset.id,
    name: asset.name,
    description: asset.description,
    type: asset.type,
    fileName: asset.fileName,
    fileSize: asset.fileSize,
    downloadCount: asset.downloadCount,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
  };
}
