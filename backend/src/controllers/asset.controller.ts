import type { Request, Response } from 'express';
import { AssetModel, type AssetInput } from '../models/asset.model';
import { HttpError } from '../utils/HttpError';
import { toAssetView } from '../views/asset.view';

type IdParams = { id: string };

function parseAssetInput(body: unknown): AssetInput {
  const name = (body as { name?: unknown } | undefined)?.name;
  if (typeof name !== 'string' || name.trim() === '') {
    throw new HttpError(400, '"name" is required and must be a non-empty string');
  }
  return { name: name.trim() };
}

export const AssetController = {
  list(_req: Request, res: Response) {
    res.json(AssetModel.findAll().map(toAssetView));
  },

  getById(req: Request<IdParams>, res: Response) {
    const asset = AssetModel.findById(req.params.id);
    if (!asset) throw new HttpError(404, 'Asset not found');

    res.json(toAssetView(asset));
  },

  create(req: Request, res: Response) {
    const asset = AssetModel.create(parseAssetInput(req.body));
    res.status(201).json(toAssetView(asset));
  },

  update(req: Request<IdParams>, res: Response) {
    const asset = AssetModel.update(req.params.id, parseAssetInput(req.body));
    if (!asset) throw new HttpError(404, 'Asset not found');

    res.json(toAssetView(asset));
  },

  remove(req: Request<IdParams>, res: Response) {
    if (!AssetModel.remove(req.params.id)) throw new HttpError(404, 'Asset not found');

    res.status(204).end();
  },
};
