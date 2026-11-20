import type { Request, Response } from 'express';
import { HttpError } from '@assetstore/shared';
import { CollectionModel, type Collection } from '../models/collection.model';

const NAME_MAX_LENGTH = 100;
const DESCRIPTION_MAX_LENGTH = 2000;

// Required, trimmed, 1 to 100 characters.
function readName(value: unknown): string {
  const name = typeof value === 'string' ? value.trim() : '';
  if (name.length === 0 || name.length > NAME_MAX_LENGTH) {
    throw new HttpError(400, `"name" must be from 1 to ${NAME_MAX_LENGTH} characters`);
  }
  return name;
}

// Optional, trimmed, at most 2000 characters; missing or null = empty.
function readDescription(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw new HttpError(400, '"description" must be a string');
  const description = value.trim();
  if (description.length > DESCRIPTION_MAX_LENGTH) {
    throw new HttpError(400, `"description" must be at most ${DESCRIPTION_MAX_LENGTH} characters`);
  }
  return description;
}

function toCollectionView(collection: Collection) {
  return {
    id: collection.id,
    ownerId: collection.ownerId,
    name: collection.name,
    description: collection.description,
    createdAt: collection.createdAt,
  };
}

export const CollectionController = {
  // COL-1, POST /api/collections: { name, description? }. The owner is the logged-in user.
  async create(req: Request, res: Response) {
    const ownerId: string = res.locals.userId;
    const body = (req.body ?? {}) as { name?: unknown; description?: unknown };
    const name = readName(body.name);
    const description = readDescription(body.description);

    const collection = await CollectionModel.create({ ownerId, name, description });
    res.status(201).json(toCollectionView(collection));
  },

  // GET /api/collections: the logged-in user's own collections, newest first.
  async listMy(_req: Request, res: Response) {
    const collections = await CollectionModel.listByOwner(res.locals.userId);
    res.json({ itemList: collections.map(toCollectionView) });
  },
};
