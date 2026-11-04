import { callService } from '@assetstore/shared';
import { env } from '../config/env';

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
};
