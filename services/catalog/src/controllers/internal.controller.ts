import type { Request, Response } from 'express';
import { AssetModel } from '../models/asset.model';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Answers for other services (community...), not for the browser. See src/routes/internal.routes.ts.
export const InternalController = {
  // GET /internal/assets/:id/exists -> { exists: boolean }. An invalid id simply does not exist.
  async assetExists(req: Request<{ id: string }>, res: Response) {
    const exists = UUID.test(req.params.id) && (await AssetModel.findById(req.params.id)) !== null;
    res.json({ exists });
  },
};
