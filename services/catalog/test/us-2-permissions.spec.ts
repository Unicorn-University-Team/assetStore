import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { importPKCS8, SignJWT } from 'jose';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assets, auditEntries, catalogPrisma, identityClient, privateKeyPem,
  seedAsset, testEnv,
} from './helpers/us2-data';

// The actual catalog Express app, route, auth middleware, controller, model, and
// audit model run. Only external PostgreSQL, identity HTTP, and configuration
// are replaced. No production service or database is modified.
vi.mock('../src/config/env', async () => ({
  env: (await import('./helpers/us2-data.js')).testEnv,
}));
vi.mock('../src/db/prisma', async () => ({
  prisma: (await import('./helpers/us2-data.js')).catalogPrisma,
}));
vi.mock('../src/clients/identity.client', async () => ({
  IdentityClient: (await import('./helpers/us2-data.js')).identityClient,
}));

import { app } from '../src/app';

type TestResponse = { status: number; json: () => Promise<unknown> };

function copyForAssertion(id: string) {
  const asset = assets.get(id);
  if (!asset) throw new Error('Missing fixture asset');
  return {
    name: asset.name,
    description: asset.description,
    ownerId: asset.ownerId,
    downloadCount: asset.downloadCount,
    tags: asset.tags.map((t) => t.tag.name),
  };
}

describe('US-2 — asset editing permissions and name validation', () => {
  let server: Server;
  let baseUrl: string;
  let assetId: string;
  let ownerId: string;
  let strangerId: string;
  let ownerCookie: string;
  let strangerCookie: string;
  let adminCookie: string;
  let key: Awaited<ReturnType<typeof importPKCS8>>;

  beforeAll(async () => {
    key = await importPKCS8(privateKeyPem, 'RS256');
    server = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Expected local TCP address');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
      server.closeAllConnections();
    });
  });

  async function cookie(userId: string, role: 'USER' | 'ADMIN' = 'USER'): Promise<string> {
    const jwt = await new SignJWT({ role })
      .setProtectedHeader({ alg: 'RS256' })
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(key);
    return `access_token=${jwt}`;
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    assets.clear();
    auditEntries.length = 0;
    ownerId = randomUUID();
    strangerId = randomUUID();
    assetId = seedAsset(ownerId).id;
    ownerCookie = await cookie(ownerId);
    strangerCookie = await cookie(strangerId);
    adminCookie = await cookie(strangerId, 'ADMIN');
  });

  async function edit(
    data: Record<string, unknown>,
    auth?: string,
    id = assetId,
  ): Promise<Response> {
    return fetch(`${baseUrl}/api/assets/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(auth ? { Cookie: auth } : {}),
      },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(5_000),
    });
  }

  async function read(id = assetId): Promise<TestResponse> {
    const response = await fetch(`${baseUrl}/api/assets/${id}`, { signal: AbortSignal.timeout(5_000) });
    return response;
  }

  it('TC-01: owner changes name and description; audit log records both changes', async () => {
    const response = await edit({ name: 'Updated sword', description: 'Improved description' }, ownerCookie);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      id: assetId, name: 'Updated sword', description: 'Improved description', ownerId,
      downloadCount: 7, tagList: ['medieval'],
    });
    expect(copyForAssertion(assetId)).toMatchObject({
      name: 'Updated sword', description: 'Improved description', downloadCount: 7,
    });
    expect(auditEntries).toHaveLength(1);
    expect(auditEntries[0]).toMatchObject({
      action: 'assetUpdated', objectType: 'asset', objectId: assetId, actorId: ownerId,
      changes: {
        name: { old: 'Medieval sword', new: 'Updated sword' },
        description: { old: 'Original asset description', new: 'Improved description' },
      },
    });
  });

  it('TC-02: logged-in non-owner gets 403, with no asset or audit changes', async () => {
    const before = copyForAssertion(assetId);
    const response = await edit({ name: 'Stolen edit', description: 'Not allowed' }, strangerCookie);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Only the owner can edit this asset' });
    expect(copyForAssertion(assetId)).toEqual(before);
    expect(catalogPrisma.asset.updateMany).not.toHaveBeenCalled();
    expect(auditEntries).toHaveLength(0);
  });

  it('TC-03: ADMIN who is not owner also gets 403 for editing', async () => {
    const response = await edit({ name: 'Admin edit', description: 'Not owner' }, adminCookie);
    expect(response.status).toBe(403);
    expect(catalogPrisma.asset.updateMany).not.toHaveBeenCalled();
    expect(auditEntries).toHaveLength(0);
  });

  it('TC-04: owner submits an empty name and receives 400', async () => {
    const before = copyForAssertion(assetId);
    const response = await edit({ name: '', description: 'Change attempted' }, ownerCookie);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: '"name" is required and must be a non-empty string' });
    expect(copyForAssertion(assetId)).toEqual(before);
    expect(auditEntries).toHaveLength(0);
  });

  it('TC-05: owner submits whitespace-only name and receives 400', async () => {
    const response = await edit({ name: '   ', description: 'Change attempted' }, ownerCookie);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: '"name" is required and must be a non-empty string' });
    expect(catalogPrisma.asset.updateMany).not.toHaveBeenCalled();
    expect(auditEntries).toHaveLength(0);
  });

  it('TC-06: missing name is rejected with 400', async () => {
    const response = await edit({ description: 'Only description' }, ownerCookie);
    expect(response.status).toBe(400);
    expect(catalogPrisma.asset.updateMany).not.toHaveBeenCalled();
  });

  it('TC-07: unauthenticated guest cannot edit an asset (401)', async () => {
    const before = copyForAssertion(assetId);
    const response = await edit({ name: 'Guest edit', description: 'Not allowed' });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Authentication required.' });
    expect(copyForAssertion(assetId)).toEqual(before);
    expect(auditEntries).toHaveLength(0);
  });

  it('TC-08: name over 100 characters is rejected with 400', async () => {
    const response = await edit({ name: 'x'.repeat(101), description: 'Too long' }, ownerCookie);
    expect(response.status).toBe(400);
    expect(catalogPrisma.asset.updateMany).not.toHaveBeenCalled();
  });

  it('TC-09: unknown asset UUID gives 404', async () => {
    const response = await edit({ name: 'Not found', description: 'N/A' }, ownerCookie, randomUUID());
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Asset not found' });
    expect(auditEntries).toHaveLength(0);
  });

  it('TC-10: owner saves unchanged values; no audit event is created', async () => {
    const response = await edit({ name: 'Medieval sword', description: 'Original asset description' }, ownerCookie);
    expect(response.status).toBe(200);
    expect(auditEntries).toHaveLength(0);
    expect(copyForAssertion(assetId).downloadCount).toBe(7);
  });

  it('TC-11: non-owner with empty name gets validation 400 before ownership 403', async () => {
    const response = await edit({ name: '', description: 'N/A' }, strangerCookie);
    expect(response.status).toBe(400);
    expect(catalogPrisma.asset.updateMany).not.toHaveBeenCalled();
    expect(auditEntries).toHaveLength(0);
  });

  it('TC-12: updated asset can be read publicly with download count and tags intact', async () => {
    const response = await edit({ name: 'Updated sword', description: 'Current version' }, ownerCookie);
    expect(response.status).toBe(200);
    const retrieved = await read();
    expect(retrieved.status).toBe(200);
    expect(await retrieved.json()).toMatchObject({
      id: assetId, name: 'Updated sword', description: 'Current version',
      downloadCount: 7, tagList: ['medieval'],
    });
  });
});
