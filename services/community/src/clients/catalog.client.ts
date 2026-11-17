import { callService } from '@assetstore/shared';
import { env } from '../config/env';

export type AssetSummary = { id: string; name: string; ownerId: string | null };

// Questions community asks the catalog service. Its database is not ours, so we ask over HTTP.
export const CatalogClient = {
  // Throws HttpError 503/502 when catalog is down or fails (see callService).
  async assetExists(assetId: string): Promise<boolean> {
    const { exists } = await callService<{ exists: boolean }>(
      env.catalogUrl,
      `/internal/assets/${encodeURIComponent(assetId)}/exists`,
      { internalKey: env.internalKey },
    );
    return exists;
  },

  // Name and owner of each asset that still exists, by id. Throws HttpError 503/502 like assetExists.
  async assetSummaries(assetIds: string[]): Promise<Map<string, AssetSummary>> {
    const unique = [...new Set(assetIds)];
    if (unique.length === 0) return new Map();
    const { itemList } = await callService<{ itemList: AssetSummary[] }>(
      env.catalogUrl,
      `/internal/assets?ids=${unique.join(',')}`,
      { internalKey: env.internalKey },
    );
    return new Map(itemList.map((asset) => [asset.id, asset]));
  },
};
