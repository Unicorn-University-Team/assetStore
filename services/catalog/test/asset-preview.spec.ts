import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { Readable } from 'node:stream';
import { importPKCS8, SignJWT } from 'jose';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { assets, catalogPrisma, privateKeyPem, seedAsset } from './helpers/us2-data';

// AM asset/create, asset/update and asset/preview: the separate preview image. The real Express app runs; the
// database is the small double of us-2-permissions.spec.ts and S3 is a Map (FileStorage replaced).
vi.mock('../src/config/env', async () => ({ env: (await import('./helpers/us2-data.js')).testEnv }));
vi.mock('../src/db/prisma', async () => ({ prisma: (await import('./helpers/us2-data.js')).catalogPrisma }));
vi.mock('../src/clients/identity.client', async () => ({
  IdentityClient: {
    ...(await import('./helpers/us2-data.js')).identityClient,
    status: async () => 'ACTIVE',
  },
}));
// asset/delete step 5 asks community to delete the reviews, collection links and reports (#54); not part of this test.
vi.mock('../src/clients/community.client', () => ({
  CommunityClient: { ratings: async () => new Map(), deleteAssetContent: async () => undefined },
}));
const stored = vi.hoisted(() => new Map<string, Buffer>());
vi.mock('../src/storage/file-storage', () => ({
  FileStorage: {
    upload: (key: string, body: Readable) => {
      const chunks: Buffer[] = [];
      let aborted = false;
      const done = new Promise<void>((resolve, reject) => {
        body.on('data', (chunk: Buffer) => chunks.push(chunk));
        body.on('end', () => (aborted ? reject(new Error('aborted')) : (stored.set(key, Buffer.concat(chunks)), resolve())));
        body.on('error', reject);
      });
      return { done: () => done, abort: async () => { aborted = true; } };
    },
    download: async (key: string) => {
      const bytes = stored.get(key);
      if (!bytes) throw Object.assign(new Error('missing'), { name: 'NoSuchKey' });
      const { Readable: R } = await import('node:stream');
      return R.from([bytes]);
    },
    remove: vi.fn(async (key: string) => { stored.delete(key); }),
    check: async () => undefined,
  },
}));

import { app } from '../src/app';
import { FileStorage } from '../src/storage/file-storage';

Object.assign(catalogPrisma.asset, { aggregate: vi.fn(async () => ({ _sum: { fileSize: 0 } })) });

describe('AM asset preview image', () => {
  let server: Server;
  let baseUrl: string;
  let key: Awaited<ReturnType<typeof importPKCS8>>;
  let ownerId: string;

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
    stored.clear();
    ownerId = randomUUID();
  });

  async function cookie(userId = ownerId): Promise<string> {
    const jwt = await new SignJWT({ role: 'USER' })
      .setProtectedHeader({ alg: 'RS256' })
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(key);
    return `access_token=${jwt}`;
  }

  function seedWithPreview(): string {
    const asset = seedAsset(ownerId);
    assets.set(asset.id, { ...assets.get(asset.id)!, previewKey: 'previews/old', previewContentType: 'image/png' } as never);
    stored.set(asset.fileKey, Buffer.from('model'));
    stored.set('previews/old', Buffer.from('old picture'));
    return asset.id;
  }

  async function publish(form: FormData): Promise<Response> {
    return fetch(`${baseUrl}/api/assets`, { method: 'POST', headers: { Cookie: await cookie() }, body: form });
  }

  function assetForm(preview?: Blob, previewName = 'cover.png'): FormData {
    const form = new FormData();
    form.set('name', 'Sword');
    form.set('type', '3d');
    form.set('file', new Blob(['o 1']), 'sword.obj');
    if (preview) form.set('preview', preview, previewName);
    return form;
  }

  it('asset/create without a preview is 400 and the uploaded file is removed again', async () => {
    const response = await publish(assetForm());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: '"preview" is required: a png, jpg, jpeg or webp image of at most 2 MB',
    });
    expect(stored.size).toBe(0);
  });

  it('asset/create with a preview that is not an image is 400 (invalidPreviewType)', async () => {
    const response = await publish(assetForm(new Blob(['<svg/>']), 'cover.svg'));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'A preview of type ".svg" is not allowed: use png, jpg, jpeg or webp',
    });
    expect(stored.size).toBe(0);
  });

  it('asset/create with a preview over 2 MB is 413 (previewTooLarge) and nothing stays in S3', async () => {
    const response = await publish(assetForm(new Blob([Buffer.alloc(2 * 1024 ** 2 + 1)])));
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: 'The preview is larger than 2 MB' });
    expect(stored.size).toBe(0);
  });

  it('asset/preview sends the stored image with its own content type, then 304 for the same ETag', async () => {
    const id = seedWithPreview();
    const response = await fetch(`${baseUrl}/api/assets/${id}/preview`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe('old picture');

    const again = await fetch(`${baseUrl}/api/assets/${id}/preview`, {
      headers: { 'If-None-Match': response.headers.get('etag') ?? '' },
    });
    expect(again.status).toBe(304);
  });

  it('asset/preview of an asset without a preview is 404', async () => {
    const id = seedAsset(ownerId).id;
    const response = await fetch(`${baseUrl}/api/assets/${id}/preview`);
    expect(response.status).toBe(404);
  });

  it('asset/get gives previewUrl = the asset/preview route', async () => {
    const id = seedWithPreview();
    const response = await fetch(`${baseUrl}/api/assets/${id}`);
    expect(await response.json()).toMatchObject({ previewUrl: `/api/assets/${id}/preview` });
  });

  it('asset/update with a new preview saves it and deletes the old one', async () => {
    const id = seedWithPreview();
    const form = new FormData();
    form.set('name', 'Medieval sword');
    form.set('preview', new Blob(['new picture']), 'cover.webp');
    const response = await fetch(`${baseUrl}/api/assets/${id}`, {
      method: 'PUT',
      headers: { Cookie: await cookie() },
      body: form,
    });
    expect(response.status).toBe(200);
    const saved = assets.get(id) as unknown as { previewKey: string; previewContentType: string; description: string };
    expect(saved.previewKey).toMatch(/^previews\//);
    expect(saved.previewKey).not.toBe('previews/old');
    expect(saved.previewContentType).toBe('image/webp');
    expect(saved.description).toBe('Original asset description');
    expect(stored.get(saved.previewKey)?.toString()).toBe('new picture');
    expect(stored.has('previews/old')).toBe(false);
  });

  it('asset/update that fails keeps the old preview and removes the new one', async () => {
    const id = seedWithPreview();
    const form = new FormData();
    form.set('name', '');
    form.set('preview', new Blob(['new picture']), 'cover.png');
    const response = await fetch(`${baseUrl}/api/assets/${id}`, {
      method: 'PUT',
      headers: { Cookie: await cookie() },
      body: form,
    });
    expect(response.status).toBe(400);
    expect([...stored.keys()].sort()).toEqual([assets.get(id)?.fileKey, 'previews/old'].sort());
  });

  it('asset/delete never deletes a preview that is the asset file itself (assets from before previews)', async () => {
    const seeded = seedAsset(ownerId);
    const asset = { ...assets.get(seeded.id)!, previewKey: seeded.fileKey, previewContentType: 'image/png' };
    assets.set(asset.id, asset as never);
    Object.assign(catalogPrisma.asset, {
      delete: vi.fn(async () => asset),
    });
    const response = await fetch(`${baseUrl}/api/assets/${asset.id}`, {
      method: 'DELETE',
      headers: { Cookie: await cookie() },
    });
    expect(response.status).toBe(204);
    expect(vi.mocked(FileStorage.remove).mock.calls).toEqual([[asset.fileKey]]);
  });
});
