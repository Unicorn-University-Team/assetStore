import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { importPKCS8, SignJWT } from 'jose';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { assets, auditEntries, catalogPrisma, privateKeyPem, seedAsset } from './helpers/us2-data';

// AM tag/create (US-1.1) and the rule that asset/create and asset/update take only existing tags (tagDoesNotExist).
// The real Express app runs; the database is a small double (tags in a Map), as in us-2-permissions.spec.ts.
vi.mock('../src/config/env', async () => ({ env: (await import('./helpers/us2-data.js')).testEnv }));
vi.mock('../src/db/prisma', async () => ({ prisma: (await import('./helpers/us2-data.js')).catalogPrisma }));
vi.mock('../src/clients/identity.client', async () => ({
  IdentityClient: (await import('./helpers/us2-data.js')).identityClient,
}));

import { app } from '../src/app';

const tags = new Map<string, { id: string; name: string }>();
const tag = {
  createMany: vi.fn(async ({ data }: { data: { name: string }[] }) => {
    let count = 0;
    for (const { name } of data) {
      if (tags.has(name)) continue;
      tags.set(name, { id: randomUUID(), name });
      count++;
    }
    return { count };
  }),
  findUniqueOrThrow: vi.fn(async ({ where }: { where: { name: string } }) => {
    const found = tags.get(where.name);
    if (!found) throw new Error('Test tag not found');
    return found;
  }),
  findMany: vi.fn(async ({ where }: { where: { name: { in: string[] } } }) =>
    where.name.in.flatMap((name) => (tags.has(name) ? [tags.get(name)!] : [])),
  ),
};
const assetTag = { deleteMany: vi.fn(async () => ({ count: 0 })), createMany: vi.fn(async () => ({ count: 0 })) };
Object.assign(catalogPrisma, { tag });

describe('AM tag/create and tagDoesNotExist', () => {
  let server: Server;
  let baseUrl: string;
  let key: Awaited<ReturnType<typeof importPKCS8>>;

  beforeAll(async () => {
    key = await importPKCS8(privateKeyPem, 'RS256');
    server = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Expected local TCP address');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    tags.clear();
    assets.clear();
    auditEntries.length = 0;
    catalogPrisma.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({ asset: catalogPrisma.asset, auditLog: catalogPrisma.auditLog, tag, assetTag }),
    );
  });

  async function cookie(userId = randomUUID()): Promise<string> {
    const jwt = await new SignJWT({ role: 'USER' })
      .setProtectedHeader({ alg: 'RS256' })
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(key);
    return `access_token=${jwt}`;
  }

  async function createTag(body: unknown, auth?: string): Promise<Response> {
    return fetch(`${baseUrl}/api/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(auth ? { Cookie: auth } : {}) },
      body: JSON.stringify(body),
    });
  }

  it('creates a tag in lower case for a signed-in user (201)', async () => {
    const response = await createTag({ name: '  Low-Poly ' }, await cookie());
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: tags.get('low-poly')?.id, name: 'low-poly' });
  });

  it('refuses a guest (401)', async () => {
    const response = await createTag({ name: 'medieval' });
    expect(response.status).toBe(401);
    expect(tags.size).toBe(0);
  });

  it('refuses a name that exists already (409 tagAlreadyExists)', async () => {
    tags.set('medieval', { id: randomUUID(), name: 'medieval' });
    const response = await createTag({ name: 'MEDIEVAL' }, await cookie());
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'Tag "medieval" already exists' });
  });

  it.each([['ca$tle'], ['x'.repeat(51)], [''], [42]])('refuses the name %j (400 invalidTagName)', async (name) => {
    const response = await createTag({ name }, await cookie());
    expect(response.status).toBe(400);
    expect(tags.size).toBe(0);
  });

  it('asset/update with a tag that does not exist is 400 and changes nothing (tagDoesNotExist)', async () => {
    const ownerId = randomUUID();
    const asset = seedAsset(ownerId);
    tags.set('medieval', { id: randomUUID(), name: 'medieval' });
    const response = await fetch(`${baseUrl}/api/assets/${asset.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: await cookie(ownerId) },
      body: JSON.stringify({ name: 'Medieval sword', tagList: ['medieval', 'castle'] }),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Tag "castle" does not exist; create it first' });
    expect(tag.createMany).not.toHaveBeenCalled();
    expect(assetTag.createMany).not.toHaveBeenCalled();
  });
});
