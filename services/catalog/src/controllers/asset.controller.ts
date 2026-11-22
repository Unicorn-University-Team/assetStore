import type { Request, Response } from 'express';
import { pipeline } from 'node:stream/promises';
import { env } from '../config/env';
import { ALLOWED_EXTENSIONS, ASSET_TYPES, AssetModel, type Actor, type Asset, type AssetType } from '../models/asset.model';
import { CommunityClient } from '../clients/community.client';
import { IdentityClient } from '../clients/identity.client';
import { FileStorage } from '../storage/file-storage';
import { HttpError } from '@assetstore/shared';
import { parseRange, previewContentType } from '../utils/preview';
import { receiveUpload } from '../utils/receiveUpload';
import { MAX_TAGS_PER_ASSET, normalizeTagList, tagListFromForm } from '../utils/tags';
import { toAssetView } from '../views/asset.view';

type IdParams = { id: string };

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const STORAGE_LIMIT_BYTES = env.maxStorageGb * 1024 ** 3;

function storageFull(): HttpError {
  return new HttpError(507, 'The storage limit is reached, no more files can be uploaded');
}
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

// asset/list search by name: optional, may be empty (unlike readName for create and update).
function readSearchName(value: unknown): string {
  if (value === undefined) return '';
  if (typeof value !== 'string') throw new HttpError(400, '"name" must be a string');
  if (value.trim().length > 100) throw new HttpError(400, '"name" must be at most 100 characters');
  return value.trim();
}

// asset/list filter by owner ("My assets"): optional user id from identity.
function readOwnerId(value: unknown): string | null {
  if (value === undefined) return null;
  if (typeof value !== 'string' || !UUID.test(value)) throw new HttpError(400, '"ownerId" must be a uuid');
  return value.toLowerCase();
}

// asset/list filter by tags (AND): tag names, one parameter per tag (?tagList=medieval&tagList=low-poly), the same
// format and rules as tagList of asset/create. One parameter comes as a string, several as an array.
function readTagFilter(value: unknown): string[] {
  const list = typeof value === 'string' ? [value] : value;
  if (Array.isArray(list) && list.length > MAX_TAGS_PER_ASSET) {
    throw new HttpError(400, `Filter by at most ${MAX_TAGS_PER_ASSET} tags`);
  }
  return normalizeTagList(list);
}

// Whole number from the query string (always a string there, or an array if the parameter is repeated).
// max = null means no upper limit.
function readInteger(field: string, value: unknown, min: number, max: number | null, fallback: number): number {
  if (value === undefined) return fallback;
  const number = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(number) || number < min || (max !== null && number > max)) {
    const range = max === null ? `>= ${min}` : `from ${min} to ${max}`;
    throw new HttpError(400, `"${field}" must be an integer ${range}`);
  }
  return number;
}

// Invalid ids are reported as "not found" instead of reaching the database as a malformed uuid.
async function findAsset(id: string): Promise<Asset> {
  const asset = UUID.test(id) ? await AssetModel.findById(id) : null;
  if (!asset) throw new HttpError(404, 'Asset not found');
  return asset;
}

// The file in S3; a missing file is a 404 with its own message, any other S3 error a 502.
async function openFile(asset: Asset, range?: { start: number; end: number }) {
  return FileStorage.download(asset.fileKey, range).catch((error: unknown) => {
    if ((error as { name?: unknown } | null)?.name === 'NoSuchKey') throw new HttpError(404, 'The file of this asset is missing');
    console.error(error);
    throw new HttpError(502, 'Could not read the file');
  });
}

function readActor(res: Response): Actor {
  return { id: res.locals.userId as string, role: res.locals.role as Actor['role'] };
}

export const AssetController = {
  async list(req: Request, res: Response) {
    const search = readSearchName(req.query.name);
    const ownerId = readOwnerId(req.query.ownerId);
    const tagNames = readTagFilter(req.query.tagList);
    const pageIndex = readInteger('pageIndex', req.query.pageIndex, 0, null, 0);
    const pageSize = readInteger('pageSize', req.query.pageSize, 1, MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE);
    const { items, total } = await AssetModel.findPage({ name: search, ownerId, tagNames, pageIndex, pageSize });

    // One call per service for the whole page, at the same time.
    const [ownerNames, ratings] = await Promise.all([
      IdentityClient.usernames(items.map((asset) => asset.ownerId)),
      CommunityClient.ratings(items.map((asset) => asset.id)),
    ]);
    res.json({ itemList: items.map((asset) => toAssetView(asset, ownerNames, ratings)), pageInfo: { pageIndex, pageSize, total } });
  },

  // GET /api/assets/my (AM asset/listMy, US-1 "My assets"): only the logged-in user's assets, newest first, the same
  // paging as asset/list. The owner always comes from the token, never from the request.
  async listMy(req: Request, res: Response) {
    const actor = readActor(res);
    const pageIndex = readInteger('pageIndex', req.query.pageIndex, 0, null, 0);
    const pageSize = readInteger('pageSize', req.query.pageSize, 1, MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE);
    const { items, total } = await AssetModel.findPage({ name: '', ownerId: actor.id, tagNames: [], pageIndex, pageSize });

    const [ownerNames, ratings] = await Promise.all([
      IdentityClient.usernames([actor.id]),
      CommunityClient.ratings(items.map((asset) => asset.id)),
    ]);
    res.json({ itemList: items.map((asset) => toAssetView(asset, ownerNames, ratings)), pageInfo: { pageIndex, pageSize, total } });
  },

  async getById(req: Request<IdParams>, res: Response) {
    const asset = await findAsset(req.params.id);
    const [ownerNames, ratings] = await Promise.all([
      IdentityClient.usernames([asset.ownerId]),
      CommunityClient.ratings([asset.id]),
    ]);
    res.json(toAssetView(asset, ownerNames, ratings));
  },

  // multipart/form-data: name, description, type, tagList (optional, one field per tag or a JSON array), file
  async create(req: Request, res: Response) {
    // Refuse before reading the body when the storage is already full.
    if ((await AssetModel.totalFileSize()) >= STORAGE_LIMIT_BYTES) throw storageFull();

    const actor = readActor(res);

    const { fields, fieldLists, file } = await receiveUpload(req, {
      fileField: 'file',
      maxBytes: env.maxUploadMb * 1024 * 1024,
      allowedExtensions: ALLOWED_EXTENSIONS,
    });
    if (!file) throw new HttpError(400, '"file" is required');

    try {
      if ((await AssetModel.totalFileSize()) + file.size > STORAGE_LIMIT_BYTES) throw storageFull();
      const input = {
        name: readName(fields.name),
        description: readDescription(fields.description),
        type: readType(fields.type),
        fileKey: file.key,
        fileName: file.fileName,
        fileSize: file.size,
        contentType: file.contentType,
      };
      const tagNames = normalizeTagList(tagListFromForm(fieldLists.tagList));
      const asset = await AssetModel.create(input, tagNames, actor);
      res.status(201).json(toAssetView(asset, await IdentityClient.usernames([asset.ownerId])));
    } catch (error) {
      await FileStorage.remove(file.key).catch(() => undefined);
      throw error;
    }
  },

  // JSON: name, description. The file itself is not replaced.
  async update(req: Request<IdParams>, res: Response) {
    const actor = readActor(res);
    const body = (req.body ?? {}) as { name?: unknown; description?: unknown };
    const input = { name: readName(body.name), description: readDescription(body.description) };
    const asset = UUID.test(req.params.id) ? await AssetModel.update(req.params.id, input, actor) : null;
    if (!asset) throw new HttpError(404, 'Asset not found');

    const [ownerNames, ratings] = await Promise.all([
      IdentityClient.usernames([asset.ownerId]),
      CommunityClient.ratings([asset.id]),
    ]);
    res.json(toAssetView(asset, ownerNames, ratings));
  },

  async remove(req: Request<IdParams>, res: Response) {
    const actor = readActor(res);
    const asset = UUID.test(req.params.id) ? await AssetModel.remove(req.params.id, actor) : null;
    if (!asset) throw new HttpError(404, 'Asset not found');

    // AM asset/delete step 5: community removes what refers to the asset. A failure is the error of this request
    // (communityCallFailed), but only after the file is removed: the row is gone, so nothing would remove it later.
    const community = await CommunityClient.deleteAssetContent(asset.id).then(() => null, (error: unknown) => error);

    // The database row is gone already; a leftover file only costs storage, so log and carry on.
    await FileStorage.remove(asset.fileKey).catch((error: unknown) => {
      console.error(`Could not delete ${asset.fileKey} from S3`, error);
    });
    if (community) throw community;
    res.status(204).end();
  },

  async download(req: Request<IdParams>, res: Response) {
    const asset = await findAsset(req.params.id);
    const body = await openFile(asset);
    await AssetModel.incrementDownloads(asset.id);

    res.attachment(asset.fileName);
    res.setHeader('Content-Length', asset.fileSize);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    await pipeline(body, res);
  },

  // GET /api/assets/:id/file: the file for the preview on the asset page (README "Náhled"). Shown in the browser,
  // not saved, and it does not count as a download. Only images, glTF models and sounds.
  async preview(req: Request<IdParams>, res: Response) {
    const asset = await findAsset(req.params.id);
    const contentType = previewContentType(asset.fileName);
    if (!contentType) throw new HttpError(404, 'This file type has no preview');

    const range = parseRange(req.headers.range, asset.fileSize);
    if (range === 'unsatisfiable') {
      res.setHeader('Content-Range', `bytes */${asset.fileSize}`);
      throw new HttpError(416, 'The requested range is outside the file');
    }
    const body = await openFile(asset, range ?? undefined);

    res.status(range ? 206 : 200);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', range ? range.end - range.start + 1 : asset.fileSize);
    if (range) res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${asset.fileSize}`);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Opened directly in a tab, the file can never run a script; pictures, models and sounds load as usual.
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    // The file of an asset never changes after the upload (PUT changes only name and description).
    // private: the site may run behind SITE_AUTH.
    res.setHeader('Cache-Control', 'private, max-age=3600');
    await pipeline(body, res);
  },
};
