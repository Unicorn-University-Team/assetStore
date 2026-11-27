import { randomUUID } from 'node:crypto';
import { vi } from 'vitest';
import type { Collection } from '../../src/generated/prisma/client';
import { testEnv as authEnv, users } from '../../../catalog/test/helpers/test-data';

// Reuse US-9's ephemeral RSA keys, identity database double and user fixtures.
export const testEnv = {
  ...authEnv,
  identityUrl: 'http://127.0.0.1:1',
  catalogUrl: 'http://127.0.0.1:1',
};
export const collections = new Map<string, Collection>();


export const communityPrisma = {
  collection: {
    create: vi.fn(async ({ data }: { data: Pick<Collection, 'ownerId' | 'name' | 'description'> }) => {
      const row: Collection = { ...data, id: randomUUID(), createdAt: new Date(), updatedAt: new Date() };
      collections.set(row.id, row);
      return { ...row };
    }),
    findMany: vi.fn(async ({ where, orderBy }: {
      where: { ownerId: string };
      orderBy: Array<Record<string, 'desc'>>;
    }) => {
      const rows = [...collections.values()].filter((row) => !where || row.ownerId === where.ownerId);
      if (orderBy) rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id));
      return rows.map((row) => ({ ...row }));
    }),
    findUnique: vi.fn(async (data: { where: { id: string } }) => {
      const row = collections.get(data.where.id);
      if (!row) return null;
      return { ...row, assets: [] };
    }),
  },
  collectionAsset: {
    create: vi.fn(() => { throw new Error('A newly created collection must have no asset links'); }),
    createMany: vi.fn(() => { throw new Error('A newly created collection must have no asset links'); }),
    count: vi.fn(async ({ where }: { where: { collectionId: string } }) => {
      return collections.has(where.collectionId) ? 0 : 0;
    }),
  },
};


// Keep account status observable without real service I/O. Authentication is never mocked.
export const identityClient = {
  status: vi.fn(async (id: string) => users.get(id)?.status ?? null),
};
