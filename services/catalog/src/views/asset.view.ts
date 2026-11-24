import type { Asset, AssetWithTags } from '../models/asset.model';
import { cardPreviewUrl } from '../utils/preview';

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

// ownerNames: username by user id from identity (IdentityClient.usernames). Missing = ownerName null.
// tagList: names in alphabetical order; an asset read without its tags has [].
export function toAssetView(asset: Asset | AssetWithTags, ownerNames: ReadonlyMap<string, string> = new Map()): AssetView {
  return {
    id: asset.id,
    ownerId: asset.ownerId,
    ownerName: (asset.ownerId && ownerNames.get(asset.ownerId)) ?? null,
    name: asset.name,
    description: asset.description,
    type: asset.type,
    tagList: 'tags' in asset ? asset.tags.map((link) => link.tag.name).sort() : [],
    fileName: asset.fileName,
    fileSize: asset.fileSize,
    // Small images are their own preview (GET /api/assets/:id/file); other types have none yet.
    previewUrl: cardPreviewUrl(asset),
    downloadCount: asset.downloadCount,
    averageRating: null,
    reviewCount: 0,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
  };
}
