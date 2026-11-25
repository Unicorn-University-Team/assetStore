import { generateKeyPairSync } from 'node:crypto';
import { Readable } from 'node:stream';
import { SignJWT, importPKCS8, importSPKI } from 'jose';
import { vi } from 'vitest';
import type { Asset } from '../../../catalog/src/generated/prisma/client';
import type { User } from '../../src/generated/prisma/client';

export type Role = 'USER' | 'ADMIN';
const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
const privatePem = keys.privateKey.export({ type: 'pkcs8', format: 'pem' });
const publicPem = keys.publicKey.export({ type: 'spki', format: 'pem' });
export const publicKey = importSPKI(publicPem.toString(), 'RS256');
const privateKey = importPKCS8(privatePem.toString(), 'RS256');
export const testEnv = {
  nodeEnv: 'test', port: 0, cookieSecure: false,
  databaseUrl: 'postgresql://unused:unused@127.0.0.1:1/auth3_unused',
  s3Bucket: 'auth3-unused', awsRegion: 'eu-central-1',
  maxUploadMb: 1, maxStorageGb: 1, internalKey: 'auth3-test',
  jwtPrivateKey: Buffer.from(privatePem).toString('base64'),
  jwtPublicKey: Buffer.from(publicPem).toString('base64'),
};
export const ids = {
  USER: '10000000-0000-4000-8000-000000000001',
  ADMIN: '10000000-0000-4000-8000-000000000002',
  asset: '10000000-0000-4000-8000-000000000003',
  registered: '10000000-0000-4000-8000-000000000004',
};
export const password = 'AUTH3-test-password-only';
export const fileBytes = Buffer.from('# AUTH-3 public asset\nv 0 0 0\n');
export const users = new Map<string, User>();
export const assets = new Map<string, Asset>();
export const sessions: unknown[] = [];
const timestamp = new Date('2026-01-01T00:00:00Z');

export function resetData(passwordHash: string): void {
  vi.clearAllMocks();
  users.clear(); assets.clear(); sessions.length = 0;
  for (const role of ['USER', 'ADMIN'] as const) {
    users.set(ids[role], {
      id: ids[role], username: `auth3-${role.toLowerCase()}`,
      email: `${role.toLowerCase()}@auth3.example.test`, passwordHash,
      role, status: 'ACTIVE', confirmedViolations: 0, suspendedAt: null, createdAt: timestamp, updatedAt: timestamp,
    });
  }
  assets.set(ids.asset, {
    id: ids.asset, ownerId: null, name: 'AUTH-3 public asset', description: '', type: '3d',
    fileKey: 'auth3/test-only', fileName: 'auth3.obj', fileSize: fileBytes.length,
    contentType: 'application/octet-stream', previewKey: null, previewContentType: null, downloadCount: 0,
    createdAt: timestamp, updatedAt: timestamp,
  });
}

export function snapshot() {
  return structuredClone({ users: [...users], assets: [...assets], sessions });
}

export function cookie(token: string): string {
  return `access_token=${token}`;
}

export async function token(payload: Record<string, unknown> = {}, expired = false): Promise<string> {
  return new SignJWT({ role: 'USER', ...payload })
    .setProtectedHeader({ alg: 'RS256' })
    .setSubject(typeof payload.sub === 'string' ? payload.sub : ids.USER)
    .setExpirationTime(expired ? 1 : Math.floor(Date.now() / 1000) + 3600)
    .sign(await privateKey);
}

// Rejected operations fail closed as well as being observable through spies.
const prohibited = () => { throw new Error('Unexpected protected infrastructure operation'); };
export const catalogDb = {
  asset: {
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
      const value = assets.get(where.id);
      return value ? { ...value } : null;
    }),
    findMany: vi.fn(async () => [...assets.values()].map((value) => ({ ...value }))),
    count: vi.fn(async () => assets.size),
    aggregate: vi.fn(prohibited), create: vi.fn(prohibited),
    updateMany: vi.fn(prohibited), delete: vi.fn(prohibited),
    update: vi.fn(async ({ where, data }: {
      where: { id: string }; data: { downloadCount: { increment: number } };
    }) => {
      const row = assets.get(where.id);
      if (!row) throw new Error('Missing test asset');
      const updated = { ...row, downloadCount: row.downloadCount + data.downloadCount.increment };
      assets.set(row.id, updated);
      return { ...updated };
    }),
  },
  auditLog: { create: vi.fn(prohibited) },
  $transaction: vi.fn(async (queries: Promise<unknown>[]) => {
    if (!Array.isArray(queries)) return prohibited();
    return Promise.all(queries);
  }),
};
export const identityDb = {
  user: {
    findFirst: vi.fn(async ({ where }: { where: { username: { equals: string; mode: 'insensitive' } } }) => {
      const user = [...users.values()].find((candidate) => candidate.username.toLowerCase() === where.username.equals.toLowerCase());
      return user ? { ...user } : null;
    }),
    findUnique: vi.fn(async ({ where, select }: {
      where: { id?: string; email?: string; username?: string };
      select?: Partial<Record<keyof User, boolean>>;
    }) => {
      const user = [...users.values()].find((candidate) =>
        where.id ? candidate.id === where.id : where.email ? candidate.email === where.email : candidate.username === where.username);
      if (!user) return null;
      return select ? Object.fromEntries(Object.entries(user).filter(([key]) => select[key as keyof User])) : { ...user };
    }),
    create: vi.fn(async ({ data }: { data: Pick<User, 'username' | 'email' | 'passwordHash'> }) => {
      const user: User = {
        ...data, id: ids.registered, role: 'USER', status: 'ACTIVE', confirmedViolations: 0, suspendedAt: null,
        createdAt: timestamp, updatedAt: timestamp,
      };
      users.set(user.id, user);
      return { ...user };
    }),
    update: vi.fn(prohibited), delete: vi.fn(prohibited),
  },
  session: {
    create: vi.fn(async ({ data }: { data: { userId: string; refreshTokenHash: string; expiresAt: Date } }) => {
      const session = { ...data, id: 'auth3-test-session', createdAt: timestamp, revokedAt: null };
      sessions.push(session);
      return session;
    }),
    updateMany: vi.fn(prohibited), delete: vi.fn(prohibited),
  },
};
export const storage = {
  download: vi.fn(async (key: string) => {
    if (key !== 'auth3/test-only') throw new Error('Unexpected storage key');
    return Readable.from([fileBytes]);
  }),
  upload: vi.fn(prohibited), remove: vi.fn(prohibited), check: vi.fn(prohibited),
};

export function infrastructureSpies() {
  return [
    ...Object.values(catalogDb.asset), catalogDb.auditLog.create, catalogDb.$transaction,
    ...Object.values(identityDb.user), ...Object.values(identityDb.session), ...Object.values(storage),
  ];
}
