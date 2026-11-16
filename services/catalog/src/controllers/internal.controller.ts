import { HttpError } from '@assetstore/shared';
import type { Request, Response } from 'express';
import { AssetModel } from '../models/asset.model';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_IDS = 100;

// Answers for other services (community...), not for the browser. See src/routes/internal.routes.ts.
export const InternalController = {
  // GET /internal/assets/:id/exists -> { exists: boolean }. An invalid id simply does not exist.
  async assetExists(req: Request<{ id: string }>, res: Response) {
    const exists = UUID.test(req.params.id) && (await AssetModel.findById(req.params.id)) !== null;
    res.json({ exists });
  },

  // GET /internal/assets?ids=<id>,<id> -> { itemList: [{ id, name, ownerId }] }. Unknown (or deleted) ids are left out.
  // Community uses it for reports: whose asset is reported and what it is called.
  async summaries(req: Request, res: Response) {
    const raw = req.query.ids;
    if (typeof raw !== 'string') throw new HttpError(400, '"ids" must be a comma-separated list of ids');
    const ids = [...new Set(raw.split(',').map((id) => id.trim().toLowerCase()).filter(Boolean))];
    if (ids.length > MAX_IDS || ids.some((id) => !UUID.test(id))) {
      throw new HttpError(400, `"ids" must be at most ${MAX_IDS} uuids`);
    }
    res.json({ itemList: ids.length ? await AssetModel.findSummaries(ids) : [] });
  },
};
