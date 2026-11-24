import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { close, request, serve } from './helpers/http';
import {
  assets, catalogPrisma, fixtureBytes, fixtureFileName, identityPrisma,
  seedAsset, testEnv, testPassword, users,
} from './helpers/test-data';
import type { Asset } from '../src/generated/prisma/client';
import type { AssetView } from '../src/views/asset.view';

vi.mock('../src/config/env', async () => ({ env: (await import('./helpers/test-data.js')).testEnv }));
vi.mock('../../identity/src/config/env', async () => ({ env: (await import('./helpers/test-data.js')).testEnv }));
vi.mock('../src/db/prisma', async () => ({ prisma: (await import('./helpers/test-data.js')).catalogPrisma }));
vi.mock('../../identity/src/db/prisma', async () => ({ prisma: (await import('./helpers/test-data.js')).identityPrisma }));

// Real apps, routing, controllers, models, JWTs and streaming; only external I/O is replaced.
import { app as catalogApp } from '../src/app';
import { app as identityApp } from '../../identity/src/app';

describe('US-9 — asset download', () => {
  let catalog: Awaited<ReturnType<typeof serve>>;
  let identity: Awaited<ReturnType<typeof serve>>;
  let asset: Asset;
  let passwordHash: string;
  let userId: string;

  beforeAll(async () => {
    passwordHash = await argon2.hash(testPassword);
    catalog = await serve(catalogApp);
    identity = await serve(identityApp);
  });

  afterAll(async () => {
    await Promise.all([catalog && close(catalog.server), identity && close(identity.server)]);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    assets.clear();
    users.clear();
    asset = seedAsset();
    userId = randomUUID();
    users.set(userId, {
      id: userId, username: 'us9-test-user', email: 'us9@example.test', passwordHash,
      role: 'USER', status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date(),
    });

    // Fail closed for any unexpected S3 operation/key. Never invoke the SDK transport.
    vi.spyOn(S3Client.prototype, 'send').mockImplementation(async (command: unknown) => {
      expect(command).toBeInstanceOf(GetObjectCommand);
      const input = (command as GetObjectCommand).input;
      expect(input).toEqual({ Bucket: testEnv.s3Bucket, Key: asset.fileKey });
      return { Body: Readable.from([fixtureBytes.subarray(0, 20), fixtureBytes.subarray(20)]) };
    });
  });

  async function login(): Promise<string> {
    const response = await request(identity.url, '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'us9@example.test', password: testPassword }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ message: 'Login successful.' });
    const cookies = response.headers.getSetCookie();
    expect(cookies).toHaveLength(2);
    expect(cookies).toEqual(expect.arrayContaining([
      expect.stringMatching(/^access_token=.+;.*HttpOnly/),
      expect.stringMatching(/^refresh_token=.+;.*HttpOnly/),
    ]));
    const cookie = cookies.map((value) => value.split(';')[0]).join('; ');
    // Prove this is a usable authenticated session, rather than an arbitrary Cookie header.
    const me = await request(identity.url, '/api/auth/me', { headers: { Cookie: cookie } });
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({ user: { id: userId, role: 'USER', status: 'ACTIVE' } });
    expect(identityPrisma.session.create).toHaveBeenCalledTimes(1);
    return cookie;
  }

  function download(cookie?: string, id = asset.id): Promise<Response> {
    return request(catalog.url, `/api/assets/${id}/download`, {
      headers: cookie ? { Cookie: cookie } : {},
    });
  }

  async function expectFile(response: Response): Promise<void> {
    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(fixtureBytes);
  }

  async function count(cookie?: string): Promise<number> {
    const response = await request(catalog.url, `/api/assets/${asset.id}`, {
      headers: cookie ? { Cookie: cookie } : {},
    });
    expect(response.status).toBe(200);
    const view = await response.json() as AssetView;
    expect(view.id).toBe(asset.id);
    expect(Number.isInteger(view.downloadCount)).toBe(true);
    return view.downloadCount;
  }

  function expectPersistedIncrement(initial: number, increment: number): void {
    expect(assets.get(asset.id)?.downloadCount).toBe(initial + increment);
    expect(catalogPrisma.asset.update).toHaveBeenCalledTimes(increment);
    expect(catalogPrisma.asset.update).toHaveBeenCalledWith({
      where: { id: asset.id }, data: { downloadCount: { increment: 1 } },
    });
    expect(S3Client.prototype.send).toHaveBeenCalledTimes(increment);
  }

  it('TC-01: returns the expected file to a guest without authentication', async () => {
    await expectFile(await download());
    expect(identityPrisma.session.create).not.toHaveBeenCalled();
  });

  it('TC-02: returns the expected file using a registered user login session', async () => {
    await expectFile(await download(await login()));
  });

  it('TC-03: increases the guest download counter by exactly 1', async () => {
    const initial = await count();
    expect(catalogPrisma.asset.update).not.toHaveBeenCalled();
    await expectFile(await download());
    expect(await count()).toBe(initial + 1);
    expectPersistedIncrement(initial, 1);
  });

  it('TC-04: increases the registered user download counter by exactly 1', async () => {
    const cookie = await login();
    const initial = await count(cookie);
    expect(catalogPrisma.asset.update).not.toHaveBeenCalled();
    await expectFile(await download(cookie));
    expect(await count(cookie)).toBe(initial + 1);
    expectPersistedIncrement(initial, 1);
  });

  it.each(['guest', 'registered user'])('TC-05: three downloads as %s increase the counter by exactly 3', async (visitor) => {
    const cookie = visitor === 'guest' ? undefined : await login();
    const initial = await count(cookie);
    for (let i = 0; i < 3; i++) await expectFile(await download(cookie));
    expect(await count(cookie)).toBe(initial + 3);
    expectPersistedIncrement(initial, 3);
  });

  it.each(['malformed', 'nonexistent'])('TC-06: a %s asset ID returns JSON 404 without downloading or incrementing', async (kind) => {
    const initial = await count();
    catalogPrisma.asset.findUnique.mockClear();
    const response = await download(undefined, kind === 'malformed' ? 'invalid-asset-id' : randomUUID());
    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({ error: 'Asset not found' });
    expect(response.headers.get('content-disposition')).toBeNull();
    expect(catalogPrisma.asset.findUnique).toHaveBeenCalledTimes(kind === 'malformed' ? 0 : 1);
    expect(S3Client.prototype.send).not.toHaveBeenCalled();
    expect(catalogPrisma.asset.update).not.toHaveBeenCalled();
    expect(await count()).toBe(initial);
    expect(assets.get(asset.id)?.downloadCount).toBe(initial);
  });

  it('TC-07: returns fixture bytes with attachment filename, length and nosniff headers', async () => {
    const response = await download();
    expect(response.headers.get('content-disposition')).toBe(`attachment; filename="${fixtureFileName}"`);
    expect(response.headers.get('content-length')).toBe(String(fixtureBytes.length));
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    await expectFile(response);
  });
});
