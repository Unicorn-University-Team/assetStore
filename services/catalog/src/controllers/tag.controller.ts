import type { Request, Response } from 'express';
import { HttpError } from '@assetstore/shared';
import { TagModel } from '../models/tag.model';
import { TAG_NAME } from '../utils/tags';
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

  // AM tag/create (US-1.1), POST /api/tags { name }: trimmed, lower case, 1 to 50 Latin letters, digits or hyphens.
  // 201 { id, name }; a wrong name 400 (invalidTagName); a name that exists 409 (tagAlreadyExists).
  async create(req: Request, res: Response) {
    const { name: raw } = (req.body ?? {}) as { name?: unknown };
    if (typeof raw !== 'string') throw new HttpError(400, '"name" is required and must be a string');
    const name = raw.trim().toLowerCase();
    if (!TAG_NAME.test(name)) {
      throw new HttpError(400, `Tag "${raw.trim().slice(0, 60)}" is not valid: use 1 to 50 Latin letters, digits or hyphens`);
    }
    const tag = await TagModel.create(name);
    if (!tag) throw new HttpError(409, `Tag "${name}" already exists`);
    res.status(201).json(toTagView(tag));
  },
};
