import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { vi } from 'vitest';

// Standalone test state. No PostgreSQL or AWS connections are created.
const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
export const privateKeyPem = keys.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
export const publicKeyPem = keys.publicKey.export({ type: 'spki', format: 'pem' }).toString();

export const testEnv = {
  nodeEnv: 'test',
  port: 0,
  databaseUrl: 'postgresql://unused:unused@127.0.0.1:1/us2_unused',
  s3Bucket: 'us2-test-only',
  awsRegion: 'eu-central-1',
  maxUploadMb: 1,
  maxStorageGb: 1,
  internalKey: 'us2-test-only',
  identityUrl: 'http://127.0.0.1:1',
  jwtPublicKey: Buffer.from(publicKeyPem).toString('base64'),
};

export type TestAsset = {
  id: string;
  ownerId: string | null;
  name: string;
  description: string;
  type: string;
  fileKey: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  downloadCount: number;
  createdAt: Date;
  updatedAt: Date;
  tags: { tag: { name: string } }[];
};

export const assets = new Map<string, TestAsset>();
export const auditEntries: Array<Record<string, unknown>> = [];

function copy(asset: TestAsset): TestAsset {
  return {
    ...asset,
    tags: asset.tags.map((link) => ({ tag: { ...link.tag } })),
  };
}

const assetQueries = {
  findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
    const asset = assets.get(where.id);
    return asset ? copy(asset) : null;
  }),
  findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => {
    const asset = assets.get(where.id);
    if (!asset) throw new Error('Test asset not found');
    return copy(asset);
  }),
  updateMany: vi.fn(async ({ where, data }: { where: { id: string }; data: { name: string; description: string } }) => {
    const asset = assets.get(where.id);
    if (!asset) return { count: 0 };
    assets.set(where.id, { ...asset, ...data, updatedAt: new Date() });
    return { count: 1 };
  }),
};

const auditQuery = {
  create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
    auditEntries.push({ ...data });
    return { id: randomUUID(), ...data };
  }),
};

// Executes the production transaction callback using a small Prisma double.
// This does not simulate PostgreSQL transaction isolation or rollback failures.
export const catalogPrisma = {
  asset: assetQueries,
  auditLog: auditQuery,
  $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
    return callback({ asset: assetQueries, auditLog: auditQuery });
  }),
};

export const identityClient = {
  usernames: vi.fn(async (ids: (string | null)[]) => new Map(
    ids.filter((id): id is string => Boolean(id)).map((id) => [id, 'us2-test-owner']),
  )),
};

export function seedAsset(ownerId: string): TestAsset {
  const asset: TestAsset = {
    id: randomUUID(),
    ownerId,
    name: 'Medieval sword',
    description: 'Original asset description',
    type: '3d',
    fileKey: `assets/${randomUUID()}`,
    fileName: 'sword.glb',
    fileSize: 512,
    contentType: 'model/gltf-binary',
    downloadCount: 7,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    tags: [{ tag: { name: 'medieval' } }],
  };
  assets.set(asset.id, asset);
  return copy(asset);
}
