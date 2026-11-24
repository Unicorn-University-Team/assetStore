import type { Request, Response } from 'express';
import { HttpError } from '@assetstore/shared';
import { CollectionModel, type Collection } from '../models/collection.model';
import { CatalogClient } from '../clients/catalog.client';

const NAME_MAX_LENGTH = 100;
const DESCRIPTION_MAX_LENGTH = 2000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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


function readId(value: unknown): string{
  if(typeof value !== 'string' || !UUID.test(value)) {
    throw new HttpError(400, 'invalid ID.');
  }
    return value;
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

  // returns the collection; the system checks that the user is its owner
  async get(req: Request, res: Response){
    const ownerId : string = res.locals.userId;
    const collectionId = readId(req.params.id);

    const collection = await CollectionModel.get({collectionId, ownerId}); //returns one collection
    if(collection === null) {
      throw new HttpError(404, 'collection not found.');
    }
    const assetIds= collection.assets.map((assets)=> assets.assetId); //returns [] of assets ids

    const assetSummaries = await CatalogClient.assetSummaries(assetIds); //returns Map with assetId, name, ownerId, type
    const assetList = assetIds
      .map((assetId) => assetSummaries
      .get(assetId)).filter((asset) =>  asset !== undefined) // filter non-undefined values
      .map((asset)=> ({id: asset.id, name: asset.name, type: asset.type})); // form a DTO

    return res.status(200).json({
      id: collection.id, 
      ownerId: collection.ownerId, 
      name: collection.name, 
      description: collection.description, 
      createdAt: collection.createdAt, 
      assetList})

  }
};
