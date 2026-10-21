import type { Request, Response } from 'express';
import { pipeline } from 'node:stream/promises';
import { env } from '../config/env';
import { ALLOWED_EXTENSIONS, ASSET_TYPES, AssetModel, type Asset, type AssetType } from '../models/asset.model';
import { FileStorage } from '../storage/file-storage';
import { HttpError } from '../utils/HttpError';
import { receiveUpload } from '../utils/receiveUpload';
import { toAssetView } from '../views/asset.view';

type IdParams = { id: string };

const PAGE_SIZE = 20;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readName(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new HttpError(400, '"name" is required and must be a non-empty string');
  }
  if (value.trim().length > 100) throw new HttpError(400, '"name" must be at most 100 characters');
  return value.trim();
}

function readDescription(value: unknown): string {
  if (value === undefined) return '';
  if (typeof value !== 'string') throw new HttpError(400, '"description" must be a string');
  if (value.length > 2000) throw new HttpError(400, '"description" must be at most 2000 characters');
  return value.trim();
}

function readType(value: unknown): AssetType {
  const type = ASSET_TYPES.find((t) => t === value);
  if (!type) throw new HttpError(400, `"type" must be one of: ${ASSET_TYPES.join(', ')}`);
  return type;
}

// Invalid ids are reported as "not found" instead of reaching the database as a malformed uuid.
async function findAsset(id: string): Promise<Asset> {
  const asset = UUID.test(id) ? await AssetModel.findById(id) : null;
  if (!asset) throw new HttpError(404, 'Asset not found');
  return asset;
}

export const AssetController = {
  async list(req: Request, res: Response) {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const page = Math.max(1, Math.floor(Number(req.query.page)) || 1);
    const { items, total } = await AssetModel.findPage({ search, page, pageSize: PAGE_SIZE });

    res.json({ items: items.map(toAssetView), page, pageSize: PAGE_SIZE, total });
  },

  async getById(req: Request<IdParams>, res: Response) {
    res.json(toAssetView(await findAsset(req.params.id)));
  },

  // multipart/form-data: name, description, type, file
  async create(req: Request, res: Response) {
    const { fields, file } = await receiveUpload(req, {
      fileField: 'file',
      maxBytes: env.maxUploadMb * 1024 * 1024,
      allowedExtensions: ALLOWED_EXTENSIONS,
    });
    if (!file) throw new HttpError(400, '"file" is required');

    try {
      const asset = await AssetModel.create({
        name: readName(fields.name),
        description: readDescription(fields.description),
        type: readType(fields.type),
        fileKey: file.key,
        fileName: file.fileName,
        fileSize: file.size,
        contentType: file.contentType,
      });
      res.status(201).json(toAssetView(asset));
    } catch (error) {
      await FileStorage.remove(file.key).catch(() => undefined);
      throw error;
    }
  },

  // JSON: name, description. The file itself is not replaced.
  async update(req: Request<IdParams>, res: Response) {
    const body = (req.body ?? {}) as { name?: unknown; description?: unknown };
    const input = { name: readName(body.name), description: readDescription(body.description) };
    const asset = UUID.test(req.params.id) ? await AssetModel.update(req.params.id, input) : null;
    if (!asset) throw new HttpError(404, 'Asset not found');

    res.json(toAssetView(asset));
  },

  async remove(req: Request<IdParams>, res: Response) {
    const asset = UUID.test(req.params.id) ? await AssetModel.remove(req.params.id) : null;
    if (!asset) throw new HttpError(404, 'Asset not found');

    // The database row is gone already; a leftover file only costs storage, so log and carry on.
    await FileStorage.remove(asset.fileKey).catch((error: unknown) => {
      console.error(`Could not delete ${asset.fileKey} from S3`, error);
    });
    res.status(204).end();
  },

  async download(req: Request<IdParams>, res: Response) {
    const asset = await findAsset(req.params.id);
    const body = await FileStorage.download(asset.fileKey);
    await AssetModel.incrementDownloads(asset.id);

    res.attachment(asset.fileName);
    res.setHeader('Content-Length', asset.fileSize);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    await pipeline(body, res);
  },
};
