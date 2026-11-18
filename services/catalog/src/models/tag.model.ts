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

  // US-1.1: the tags with these (already normalized) names; a missing one is created (BR-02), an existing one is
  // reused (BR-03). Runs in the caller's transaction. Two requests creating the same new tag at once do not fail:
  // ON CONFLICT DO NOTHING waits for the other one and skips the name, and the read after it sees that tag.
  async findOrCreate(tx: Prisma.TransactionClient, names: string[]): Promise<Tag[]> {
    if (names.length === 0) return [];
    await tx.tag.createMany({ data: names.map((name) => ({ name })), skipDuplicates: true });
    return tx.tag.findMany({ where: { name: { in: names } } });
  },
};
