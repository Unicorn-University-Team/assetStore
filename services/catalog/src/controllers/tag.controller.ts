import type { Request, Response } from 'express';
import { HttpError } from '@assetstore/shared';
import { TagModel } from '../models/tag.model';
import { toTagView } from '../views/tag.view';

const MAX_SUGGESTIONS = 10;

function readPrefix(value: unknown): string {
  if (value === undefined) return '';
  if (typeof value !== 'string') throw new HttpError(400, '"prefix" must be a string');
  if (value.trim().length > 50) throw new HttpError(400, '"prefix" must be at most 50 characters');
  return value.trim().toLowerCase();
}

export const TagController = {
  async list(req: Request, res: Response) {
    const tags = await TagModel.listByPrefix(readPrefix(req.query.prefix), MAX_SUGGESTIONS);

    res.json({ itemList: tags.map(toTagView) });
  },
};
