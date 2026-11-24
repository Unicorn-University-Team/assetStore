import { callService } from '@assetstore/shared';
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
};
