import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { vi } from 'vitest';
import type { Asset } from '../../src/generated/prisma/client';
import type { User } from '../../../identity/src/generated/prisma/client';

// Imported only by tests. No environment files, database connections or AWS credentials are read.
const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
export const testEnv = {
  nodeEnv: 'test',
  port: 0,
  databaseUrl: 'postgresql://unused:unused@127.0.0.1:1/us9_unused',
  s3Bucket: 'us9-test-only',
  awsRegion: 'eu-central-1',
  maxUploadMb: 1,
  maxStorageGb: 1,
  internalKey: 'us9-test-only',
  cookieSecure: false,
  jwtPrivateKey: Buffer.from(keys.privateKey.export({ type: 'pkcs8', format: 'pem' })).toString('base64'),
  jwtPublicKey: Buffer.from(keys.publicKey.export({ type: 'spki', format: 'pem' })).toString('base64'),
};

export const fixtureBytes = readFileSync(join(__dirname, '../fixtures/triangle.obj'));
export const fixtureFileName = 'US-9 triangle.obj';
export const testPassword = 'US9-test-password-only';
export const assets = new Map<string, Asset>();
export const users = new Map<string, User>();

// Replace the Prisma boundary, retaining the production AssetModel and its increment expression.
// Copies on reads prevent tests from passing because of shared mutable response objects.
export const catalogPrisma = {
  asset: {
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
      const asset = assets.get(where.id);
      return asset ? { ...asset } : null;
    }),
    update: vi.fn(async ({ where, data }: {
      where: { id: string };
      data: { downloadCount: { increment: number } };
    }) => {
      const asset = assets.get(where.id);
      if (!asset) throw new Error('Test asset does not exist');
      const updated = { ...asset, downloadCount: asset.downloadCount + data.downloadCount.increment };
      assets.set(where.id, updated);
      return { ...updated };
    }),
  },
};

export const identityPrisma = {
  user: {
    findUnique: vi.fn(async ({ where }: { where: { email?: string; id?: string } }) => {
      const user = [...users.values()].find((candidate) =>
        where.id ? candidate.id === where.id : candidate.email === where.email);
      return user ? { ...user } : null;
    }),
  },
  session: {
    create: vi.fn(async ({ data }: { data: {
      userId: string; refreshTokenHash: string; expiresAt: Date;
    } }) => ({ id: randomUUID(), ...data, createdAt: new Date(), revokedAt: null })),
  },
};

export function seedAsset(): Asset {
  const asset: Asset = {
    id: randomUUID(),
    ownerId: null,
    name: 'US-9 triangle',
    description: 'An isolated downloadable test asset',
    type: '3d',
    fileKey: `assets/${randomUUID()}`,
    fileName: fixtureFileName,
    fileSize: fixtureBytes.length,
    contentType: 'application/octet-stream',
    previewKey: null,
    previewContentType: null,
    downloadCount: 7,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };
  assets.set(asset.id, asset);
  return { ...asset };
}
