import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { close, request, serve } from '../../catalog/test/helpers/http';
import { identityPrisma, testPassword, users } from '../../catalog/test/helpers/test-data';
import { collections, communityPrisma } from './helpers/us10-data';

vi.mock('../src/config/env', async () => ({ env: (await import('./helpers/us10-data.js')).testEnv }));
vi.mock('../src/db/prisma', async () => ({ prisma: (await import('./helpers/us10-data.js')).communityPrisma }));
vi.mock('../src/clients/identity.client', async () => ({ IdentityClient: (await import('./helpers/us10-data.js')).identityClient }));
vi.mock('../../identity/src/config/env', async () => ({ env: (await import('../../catalog/test/helpers/test-data.js')).testEnv }));
vi.mock('../../identity/src/db/prisma', async () => ({ prisma: (await import('../../catalog/test/helpers/test-data.js')).identityPrisma }));

import { app as communityApp } from '../src/app';
import { app as identityApp } from '../../identity/src/app';

type CollectionView = { id: string; ownerId: string; name: string; description: string; createdAt: string };

describe('US-10 — private collections and required name', () => {
  let community: Awaited<ReturnType<typeof serve>>;
  let identity: Awaited<ReturnType<typeof serve>>;
  let passwordHash: string;
  let userA: string;
  let userB: string;
  let cookieA: string;
  let cookieB: string;

  beforeAll(async () => {
    passwordHash = await argon2.hash(testPassword);
    community = await serve(communityApp);
    identity = await serve(identityApp);
  });

  afterAll(async () => {
    await Promise.all([community && close(community.server), identity && close(identity.server)]);
  });

  async function login(id: string): Promise<string> {
    const response = await request(identity.url, '/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: users.get(id)!.email, password: testPassword }),
    });
    expect(response.status).toBe(200);
    const cookie = response.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
    expect(cookie).toContain('access_token=');
    const me = await request(identity.url, '/api/auth/me', { headers: { Cookie: cookie } });
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({ user: { id, role: 'USER', status: 'ACTIVE' } });
    return cookie;
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    collections.clear();
    users.clear();
    userA = randomUUID();
    userB = randomUUID();
    for (const id of [userA, userB]) {
      users.set(id, {
        id, username: `us10-${id}`, email: `${id}@us10.example.test`, passwordHash,
        role: 'USER', status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date(),
      });
    }
    cookieA = await login(userA);
    cookieB = await login(userB);
    expect(identityPrisma.session.create).toHaveBeenCalledTimes(2);
  });

  afterEach(() => { collections.clear(); users.clear(); });

  function create(body: Record<string, unknown>, cookie?: string) {
    return request(community.url, '/api/collections', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: JSON.stringify(body),
    });
  }

  async function createValid(cookie = cookieA, name = 'US10 private collection'): Promise<CollectionView> {
    const response = await create({ name, description: 'Private test description' }, cookie);
    expect(response.status).toBe(201);
    return await response.json() as CollectionView;
  }

  async function list(cookie: string): Promise<CollectionView[]> {
    const response = await request(community.url, '/api/collections', { headers: { Cookie: cookie } });
    expect(response.status).toBe(200);
    return (await response.json() as { itemList: CollectionView[] }).itemList;
  }

  async function assertNoCreation(body: Record<string, unknown>, error: string, cookie = cookieA, status = 400) {
    // Existing data catches accidental writes/deletions, rather than only checking an empty store.
    await createValid();
    const before = structuredClone([...collections]);
    communityPrisma.collection.create.mockClear();
    const response = await create(body, cookie);
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error });
    expect([...collections]).toEqual(before);
    expect(communityPrisma.collection.create).not.toHaveBeenCalled();
    expect(communityPrisma.collectionAsset.create).not.toHaveBeenCalled();
    expect(communityPrisma.collectionAsset.createMany).not.toHaveBeenCalled();
    expect(await list(cookieA)).toHaveLength(1);
  }

  it('TC-US10-01: valid collection belongs to A, has no asset writes and appears in My collections', async () => {
    const collection = await createValid();
    expect(collection).toEqual({
      id: expect.any(String), ownerId: userA, name: 'US10 private collection',
      description: 'Private test description', createdAt: expect.any(String),
    });
    expect(collections.get(collection.id)).toMatchObject({ ownerId: userA, name: collection.name });
    // Only scalar fields reach Prisma: no nested asset connect/create, and no separate link inserts.
    expect(communityPrisma.collection.create).toHaveBeenCalledExactlyOnceWith({
      data: { ownerId: userA, name: collection.name, description: collection.description },
    });
    expect(communityPrisma.collectionAsset.create).not.toHaveBeenCalled();
    expect(communityPrisma.collectionAsset.createMany).not.toHaveBeenCalled();
    expect(await list(cookieA)).toEqual([collection]);
  });

  it('TC-US10-02: description may be omitted', async () => {
    const response = await create({ name: 'No description' }, cookieA);
    expect(response.status).toBe(201);
    const collection = await response.json() as CollectionView;
    expect(collection).toMatchObject({ ownerId: userA, name: 'No description', description: '' });
    expect(await list(cookieA)).toEqual([collection]);
  });

  it('TC-US10-03: missing name is rejected without a write', async () => {
    await assertNoCreation({ description: 'Missing name' }, '"name" must be from 1 to 100 characters');
  });

  it('TC-US10-04: empty name is rejected without a write', async () => {
    await assertNoCreation({ name: '' }, '"name" must be from 1 to 100 characters');
  });

  it('TC-US10-05: owner sees the created collection in their own list', async () => {
    const own = await createValid();
    await createValid(cookieB, 'B private collection');
    expect(await list(cookieA)).toEqual([own]);
    expect(communityPrisma.collection.findMany).toHaveBeenLastCalledWith({
      where: { ownerId: userA }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  });

  it.skip('TC-US10-05 details: NOT EXECUTED — no collection detail route exists in routes or README', () => {});

  it('TC-US10-06: B sees only B collections; direct ID probe returns no private data', async () => {
    const privateA = await createValid();
    expect(await list(cookieB)).toEqual([]);
    const ownB = await createValid(cookieB, 'B private collection');
    expect(await list(cookieB)).toEqual([ownB]);
    // Negative URL probe only: this is NOT an implemented collection detail API.
    const path = `/api/collections/${privateA.id}`;
    const response = await request(community.url, path, { headers: { Cookie: cookieB } });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: `Route GET ${path} not found` });
    expect(collections.size).toBe(2);
  });

  it('TC-US10-07: guest cannot list collections or get data through a direct ID probe', async () => {
    const privateA = await createValid();
    for (const path of ['/api/collections', `/api/collections/${privateA.id}`]) {
      const response = await request(community.url, path);
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: 'Authentication required.' });
    }
    expect(communityPrisma.collection.findMany).not.toHaveBeenCalled();
  });

  it('TC-US10-08: guest creation is rejected without a write', async () => {
    await assertNoCreation({ name: 'Guest collection' }, 'Authentication required.', '', 401);
  });

  it('TC-US10-09: whitespace-only name is rejected', async () => {
    await assertNoCreation({ name: ' \t\n ' }, '"name" must be from 1 to 100 characters');
  });

  it.each([1, 100])('TC-US10-10: name boundary %i and description boundary 2000 are accepted after trimming', async (length) => {
    const response = await create({ name: ` ${'n'.repeat(length)} `, description: ` ${'d'.repeat(2000)} ` }, cookieA);
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ name: 'n'.repeat(length), description: 'd'.repeat(2000), ownerId: userA });
    expect(collections.size).toBe(1);
  });

  it('TC-US10-11: name of 101 characters is rejected', async () => {
    await assertNoCreation({ name: 'n'.repeat(101) }, '"name" must be from 1 to 100 characters');
  });

  it('TC-US10-12: description of 2001 characters is rejected', async () => {
    await assertNoCreation({ name: 'Valid', description: 'd'.repeat(2001) }, '"description" must be at most 2000 characters');
  });

  // DEF-US10-01: expected failure until creation checks the current account status.
  // Keep the required behavior below; remove `.fails` when the backend defect is fixed.
  it.fails('TC-US10-13 [DEF-US10-01]: user suspended after login must not create with their existing access cookie', async () => {
    users.get(userA)!.status = 'SUSPENDED';
    const before = structuredClone([...collections]);
    const response = await create({ name: 'Suspended attempt' }, cookieA);
    // US-10 requires an active account; no exact rejection status is specified for collections.
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
    expect([...collections]).toEqual(before);
    expect(communityPrisma.collection.create).not.toHaveBeenCalled();
  });

  it('TC-US10-14: supplied ownerId cannot transfer ownership to B', async () => {
    const response = await create({ name: 'Ownership attempt', ownerId: userB }, cookieA);
    expect(response.status).toBe(201);
    const collection = await response.json() as CollectionView;
    expect(collection.ownerId).toBe(userA);
    expect(collections.get(collection.id)?.ownerId).toBe(userA);
    expect(await list(cookieB)).toEqual([]);
    expect(await list(cookieA)).toEqual([collection]);
  });
});
