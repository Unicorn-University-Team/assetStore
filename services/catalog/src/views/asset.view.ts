import type { Asset } from '../models/asset.model';

// What the client sees (AM asset/list dtoOut item). The S3 key (fileKey) is internal and never leaves the backend.
export interface AssetView {
  id: string;
  ownerId: string | null;
  ownerName: string | null;
  name: string;
  description: string;
  type: string;
  tagList: string[];
  fileName: string;
  fileSize: number;
  previewUrl: string | null;
  downloadCount: number;
  averageRating: number | null;
  reviewCount: number;
  createdAt: string;
  updatedAt: string;
}

export function toAssetView(asset: Asset): AssetView {
  return {
    id: asset.id,
    ownerId: null,
    ownerName: null,
    name: asset.name,
    description: asset.description,
    type: asset.type,
    tagList: [],
    fileName: asset.fileName,
    fileSize: asset.fileSize,
    previewUrl: null,
    downloadCount: asset.downloadCount,
    averageRating: null,
    reviewCount: 0,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
  };
}
