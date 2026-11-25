import { HttpError } from '@assetstore/shared';
import { prisma } from '../db/prisma';
import type { Prisma, Tag } from '../generated/prisma/client';
import { escapeLike } from '../utils/escapeLike';

export type { Tag };

export const TagModel = {
  // Names are stored in lower case, so the prefix must already be in lower case too.
  listByPrefix(prefix: string, limit: number): Promise<Tag[]> {
    return prisma.tag.findMany({
      where: prefix ? { name: { startsWith: escapeLike(prefix) } } : {},
      orderBy: { name: 'asc' },
      take: limit,
    });
  },

  // AM tag/create (US-1.1): a new tag with an already normalized name. null = the name is taken (tagAlreadyExists).
  // ON CONFLICT DO NOTHING: two requests with the same new name at once give one tag and one 409, never a 500.
  async create(name: string): Promise<Tag | null> {
    const { count } = await prisma.tag.createMany({ data: [{ name }], skipDuplicates: true });
    return count === 0 ? null : prisma.tag.findUniqueOrThrow({ where: { name } });
  },

  // AM asset/create step 3 and asset/update step 6: every tag must exist already (a missing one is created first by
  // tag/create). Runs in the caller's transaction; a missing name is a 400 that names it (tagDoesNotExist).
  async findExisting(tx: Prisma.TransactionClient, names: string[]): Promise<Tag[]> {
    if (names.length === 0) return [];
    const tags = await tx.tag.findMany({ where: { name: { in: names } } });
    const missing = names.find((name) => !tags.some((tag) => tag.name === name));
    if (missing !== undefined) throw new HttpError(400, `Tag "${missing}" does not exist; create it first`);
    return tags;
  },
};
