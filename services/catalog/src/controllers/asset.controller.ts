import type { Request, Response } from 'express';
import { pipeline } from 'node:stream/promises';
import { env } from '../config/env';
import { ALLOWED_EXTENSIONS, ASSET_TYPES, AssetModel, type Actor, type Asset, type AssetType } from '../models/asset.model';
import { CommunityClient } from '../clients/community.client';
import { IdentityClient } from '../clients/identity.client';
import { FileStorage } from '../storage/file-storage';
import { HttpError } from '@assetstore/shared';
import {
  PREVIEW_EXTENSIONS,
  PREVIEW_IMAGE_TYPES,
  PREVIEW_MAX_BYTES,
  parseRange,
  previewContentType,
} from '../utils/preview';
import { receiveUpload, removeUploaded, type FileRule } from '../utils/receiveUpload';
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

// AM asset limits: the asset file (asset/create) and the preview image (asset/create, asset/update).
const FILE_RULE: FileRule = {
  maxBytes: env.maxUploadMb * 1024 * 1024,
  allowedExtensions: ALLOWED_EXTENSIONS,
  keyPrefix: 'assets/',
  wrongType: (extension) => `Files of type ".${extension}" are not allowed`,
  tooLarge: `The file is larger than ${env.maxUploadMb} MB`,
};
const PREVIEW_RULE: FileRule = {
  maxBytes: PREVIEW_MAX_BYTES,
  allowedExtensions: PREVIEW_EXTENSIONS,
  keyPrefix: 'previews/',
  wrongType: (extension) => `A preview of type ".${extension}" is not allowed: use png, jpg, jpeg or webp`,
  tooLarge: 'The preview is larger than 2 MB',
  contentType: (extension) => PREVIEW_IMAGE_TYPES[extension] ?? 'application/octet-stream',
};

// A preview that is the asset file itself (assets from before previews, migration asset_preview) is never deleted
// on its own: the file would go with it.
async function removePreview(asset: Pick<Asset, 'fileKey' | 'previewKey'>): Promise<void> {
  if (!asset.previewKey || asset.previewKey === asset.fileKey) return;
  await FileStorage.remove(asset.previewKey).catch((error: unknown) => {
    console.error(`Could not delete ${asset.previewKey} from S3`, error);
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
    const actor = readActor(res);
    // AM asset/create step 1 (userSuspended): the access token lives up to 15 minutes after a suspension, so the
    // account status is asked from identity before anything is uploaded.
    if ((await IdentityClient.status(actor.id)) === 'SUSPENDED') {
      throw new HttpError(403, 'A suspended account cannot publish assets');
    }

    // Refuse before reading the body when the storage is already full.
    if ((await AssetModel.totalFileSize()) >= STORAGE_LIMIT_BYTES) throw storageFull();

    const { fields, fieldLists, files } = await receiveUpload(req, { files: { file: FILE_RULE, preview: PREVIEW_RULE } });
    const { file, preview } = files;

    try {
      if (!file) throw new HttpError(400, '"file" is required');
      // AM asset/create: the preview image is required.
      if (!preview) throw new HttpError(400, '"preview" is required: a png, jpg, jpeg or webp image of at most 2 MB');
      if ((await AssetModel.totalFileSize()) + file.size > STORAGE_LIMIT_BYTES) throw storageFull();
      const input = {
        name: readName(fields.name),
        description: readDescription(fields.description),
        type: readType(fields.type),
        fileKey: file.key,
        fileName: file.fileName,
        fileSize: file.size,
        contentType: file.contentType,
        previewKey: preview.key,
        previewContentType: preview.contentType,
      };
      const tagNames = normalizeTagList(tagListFromForm(fieldLists.tagList));
      const asset = await AssetModel.create(input, tagNames, actor);
      res.status(201).json(toAssetView(asset, await IdentityClient.usernames([asset.ownerId])));
    } catch (error) {
      await removeUploaded(files);
      throw error;
    }
  },

  // JSON { name, description?, tagList? }, or multipart/form-data with the same fields and an optional new
  // "preview" image (AM asset/update). The type and the file itself are not replaced.
  async update(req: Request<IdParams>, res: Response) {
    const actor = readActor(res);
    const multipart = Boolean(req.is('multipart/form-data'));
    const upload = multipart ? await receiveUpload(req, { files: { preview: PREVIEW_RULE } }) : null;
    const preview = upload?.files.preview;
    const body = upload
      ? { name: upload.fields.name, description: upload.fields.description, tagList: tagListFromForm(upload.fieldLists.tagList) }
      : ((req.body ?? {}) as { name?: unknown; description?: unknown; tagList?: unknown });

    let result: Awaited<ReturnType<typeof AssetModel.update>>;
    try {
      // AM asset/update: a field that is not sent stays unchanged (before, a missing description emptied it).
      const input = {
        name: readName(body.name),
        ...(body.description === undefined ? {} : { description: readDescription(body.description) }),
        ...(preview ? { previewKey: preview.key, previewContentType: preview.contentType } : {}),
      };
      // AM asset/update: tagList replaces the tags; without it the tags stay unchanged. In a form, no tagList field
      // means no change as well.
      const tagNames = body.tagList === undefined ? null : normalizeTagList(body.tagList);
      result = UUID.test(req.params.id) ? await AssetModel.update(req.params.id, input, actor, tagNames) : null;
      if (!result) throw new HttpError(404, 'Asset not found');
    } catch (error) {
      // AM asset/update steps 7 and 8: nothing saved, so the new preview goes again.
      if (upload) await removeUploaded(upload.files);
      throw error;
    }
    const { before, after: asset } = result;
    // The new preview is saved; the old one is not needed any more.
    if (preview) await removePreview(before);

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

    // The database row is gone already; a leftover file only costs storage, so log and carry on (AM asset/delete
    // step 6: the file and the preview).
    await FileStorage.remove(asset.fileKey).catch((error: unknown) => {
      console.error(`Could not delete ${asset.fileKey} from S3`, error);
    });
    await removePreview(asset);
    res.status(204).end();
  },

  async download(req: Request<IdParams>, res: Response) {
    const asset = await findAsset(req.params.id);
    const body = await openFile(asset);

    res.attachment(asset.fileName);
    res.setHeader('Content-Length', asset.fileSize);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // AM asset/download step 4: count only after the whole file was sent; a broken or cancelled transfer makes the
    // pipeline fail and does not count. The file is already sent, so a failed count is only logged.
    await pipeline(body, res);
    await AssetModel.incrementDownloads(asset.id).catch((error: unknown) => {
      console.error(`Could not count the download of ${asset.id}`, error);
    });
  },

  // AM asset/preview, GET /api/assets/:id/preview: the preview image from the private bucket, with its stored
  // content type. The download count does not change. The ETag is the S3 key, which changes with a new preview, so
  // the browser asks again (no-cache) but gets a 304 while the picture is the same.
  async previewImage(req: Request<IdParams>, res: Response) {
    const asset = await findAsset(req.params.id);
    if (!asset.previewKey) throw new HttpError(404, 'This asset has no preview');
    const etag = `"${asset.previewKey}"`;
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'private, no-cache');
    if (req.headers['if-none-match'] === etag) {
      res.status(304).end();
      return;
    }
    const body = await FileStorage.download(asset.previewKey).catch((error: unknown) => {
      console.error(error);
      throw new HttpError(502, 'Could not read the preview'); // AM previewReadFailed
    });
    res.setHeader('Content-Type', asset.previewContentType ?? 'application/octet-stream');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
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
