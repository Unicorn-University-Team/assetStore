import { prisma } from '../db/prisma';
import type { Tag } from '../generated/prisma/client';
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
};
