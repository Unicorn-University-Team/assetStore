import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { importPKCS8, SignJWT } from 'jose';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { assets, auditEntries, catalogPrisma, identityClient, privateKeyPem, seedAsset } from './helpers/us2-data';

// Fixes from the comparison of catalog with the Application Model (25. 11. 2026). The real Express app runs; only
// the database, identity and the configuration are replaced, as in us-2-permissions.spec.ts.
vi.mock('../src/config/env', async () => ({ env: (await import('./helpers/us2-data.js')).testEnv }));
vi.mock('../src/db/prisma', async () => ({ prisma: (await import('./helpers/us2-data.js')).catalogPrisma }));
vi.mock('../src/clients/identity.client', async () => ({
  IdentityClient: (await import('./helpers/us2-data.js')).identityClient,
}));

import { app } from '../src/app';

const status = vi.fn(async (_id: string): Promise<string | null> => 'ACTIVE');
Object.assign(identityClient, { status });

describe('catalog and the Application Model', () => {
  let server: Server;
  let baseUrl: string;
  let key: Awaited<ReturnType<typeof importPKCS8>>;
  let ownerId: string;
  let assetId: string;

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
    assets.clear();
    auditEntries.length = 0;
    ownerId = randomUUID();
    assetId = seedAsset(ownerId).id;
  });

  async function cookie(userId: string): Promise<string> {
    const jwt = await new SignJWT({ role: 'USER' })
      .setProtectedHeader({ alg: 'RS256' })
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(key);
    return `access_token=${jwt}`;
  }

  it('asset/update: a description that is not sent stays unchanged', async () => {
    const response = await fetch(`${baseUrl}/api/assets/${assetId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: await cookie(ownerId) },
      body: JSON.stringify({ name: 'Renamed sword' }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ name: 'Renamed sword', description: 'Original asset description' });
    expect(assets.get(assetId)?.description).toBe('Original asset description');
    expect(auditEntries.at(-1)?.changes).toEqual({ name: { old: 'Medieval sword', new: 'Renamed sword' } });
  });

  it('asset/update: an empty description sent on purpose still clears it', async () => {
    const response = await fetch(`${baseUrl}/api/assets/${assetId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: await cookie(ownerId) },
      body: JSON.stringify({ name: 'Medieval sword', description: '' }),
    });
    expect(response.status).toBe(200);
    expect(assets.get(assetId)?.description).toBe('');
  });

  it('asset/create: a suspended account gets 403 before anything is uploaded (userSuspended)', async () => {
    status.mockResolvedValueOnce('SUSPENDED');
    const form = new FormData();
    form.set('name', 'Sword');
    form.set('type', '3d');
    form.set('file', new Blob(['o 1']), 'sword.obj');
    const response = await fetch(`${baseUrl}/api/assets`, {
      method: 'POST',
      headers: { Cookie: await cookie(ownerId) },
      body: form,
    });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'A suspended account cannot publish assets' });
    expect(status).toHaveBeenCalledWith(ownerId);
    expect(catalogPrisma.$transaction).not.toHaveBeenCalled();
  });
});
