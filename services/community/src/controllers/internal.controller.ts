import { HttpError } from '@assetstore/shared';
import type { Request, Response } from 'express';
import { AssetContentModel } from '../models/asset-content.model';
import { ReviewModel } from '../models/review.model';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_IDS = 100;

// Answers for other services (catalog...), not for the browser. See src/routes/internal.routes.ts.
export const InternalController = {
  // GET /internal/reviews/summaries?ids=<id>,<id> -> { itemList: [{ assetId, averageRating, reviewCount }] }.
  // Assets without reviews are left out.
  async ratingSummaries(req: Request, res: Response) {
    const raw = req.query.ids;
    if (typeof raw !== 'string') throw new HttpError(400, '"ids" must be a comma-separated list of ids');
    const assetIds = [...new Set(raw.split(',').map((id) => id.trim().toLowerCase()).filter(Boolean))];
    if (assetIds.length > MAX_IDS) throw new HttpError(400, `"ids" length should be at most ${MAX_IDS} ids`);
    if (assetIds.length === 0) return res.json({ itemList: [] });
    if (assetIds.some((id) => !UUID.test(id))) throw new HttpError(400, 'one or more ids are invalid format');
    const assetReviewList = await ReviewModel.ratingSummaries(assetIds);

    res.json({ itemList: assetReviewList });
  },

  // DELETE /internal/assets/:assetId -> { reviews, collectionLinks, reports, keptReports } (how many rows changed).
  // Catalog calls it after deleting the asset (US-3, AM asset/delete step 5). An asset with nothing here is fine.
  async deleteAssetContent(req: Request<{ assetId: string }>, res: Response) {
    const assetId = req.params.assetId.toLowerCase();
    if (!UUID.test(assetId)) throw new HttpError(400, '"assetId" must be a UUID');

    res.json(await AssetContentModel.deleteByAsset(assetId));
  },
};
