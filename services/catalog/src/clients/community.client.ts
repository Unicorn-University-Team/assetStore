import { callService, HttpError } from '@assetstore/shared';
import { env } from '../config/env';

export interface AssetRating {
  averageRating: number | null;
  reviewCount: number;
}

// Questions catalog asks the community service. Its database is not ours, so we ask over HTTP.
export const CommunityClient = {
  // Rating by asset id, one call for the whole page. An asset without reviews is not in the map. Ratings are only
  // for display: when community is down or fails, the error is logged and the map is empty, so the catalogue keeps
  // working.
  async ratings(assetIds: string[]): Promise<Map<string, AssetRating>> {
    if (assetIds.length === 0) return new Map();
    try {
      const { itemList } = await callService<{ itemList: (AssetRating & { assetId: string })[] }>(
        env.communityUrl,
        `/internal/reviews/summaries?ids=${assetIds.join(',')}`,
        { internalKey: env.internalKey },
      );
      return new Map(
        itemList.map((item) => [item.assetId, { averageRating: item.averageRating, reviewCount: item.reviewCount }]),
      );
    } catch {
      // callService has logged the details already.
      return new Map();
    }
  },

  // US-3, AM asset/delete step 5: community deletes the reviews, the collection links and the open and rejected
  // reports of a deleted asset; resolved reports stay as history. Unlike ratings this must not be skipped, so a
  // failure is an error of the delete (AM communityCallFailed); callService has logged the details.
  async deleteAssetContent(assetId: string): Promise<void> {
    try {
      await callService(env.communityUrl, `/internal/assets/${encodeURIComponent(assetId)}`, {
        internalKey: env.internalKey,
        method: 'DELETE',
      });
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 502;
      throw new HttpError(status, 'Deleting the reviews, collection items and reports of the asset failed');
    }
  },
};
