import { prisma } from '../db/prisma';
import type { Asset } from '../generated/prisma/client';
import { AuditLogModel, diffFields } from './audit-log.model';

export type { Asset };

export const ASSET_TYPES = ['2d', '3d', 'map', 'sound', 'environment'] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

// Upload whitelist (spec, non-functional requirements). Lower case, without the dot.
export const ALLOWED_EXTENSIONS: ReadonlySet<string> = new Set([
  // 2D
  'png', 'jpg', 'jpeg', 'webp', 'gif', 'psd',
  // 3D
  'fbx', 'obj', 'mtl', 'gltf', 'glb', 'blend', 'stl', 'dae', '3ds',
  // sound
  'wav', 'mp3', 'ogg', 'flac',
  // maps, environments, bundles
  'zip', '7z', 'unitypackage', 'tmx',
]);

export type AssetInput = Pick<Asset, 'name' | 'description' | 'type' | 'fileKey' | 'fileName' | 'fileSize' | 'contentType'>;
export type AssetUpdate = Pick<Asset, 'name' | 'description'>;

export const AssetModel = {
  async findPage(options: { search: string; page: number; pageSize: number }) {
    const where = options.search ? { name: { contains: options.search, mode: 'insensitive' as const } } : {};
    const [items, total] = await prisma.$transaction([
      prisma.asset.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (options.page - 1) * options.pageSize,
        take: options.pageSize,
      }),
      prisma.asset.count({ where }),
    ]);
    return { items, total };
  },

  // Size of all stored files together, in bytes.
  async totalFileSize(): Promise<number> {
    const result = await prisma.asset.aggregate({ _sum: { fileSize: true } });
    return result._sum.fileSize ?? 0;
  },

  findById(id: string): Promise<Asset | null> {
    return prisma.asset.findUnique({ where: { id } });
  },

  // Creating, updating and deleting write an audit log entry in the same transaction:
  // if the entry cannot be written, the change is undone (AUDIT_LOG.md, section 4).
  create(input: AssetInput): Promise<Asset> {
    return prisma.$transaction(async (tx) => {
      const asset = await tx.asset.create({ data: input });
      await AuditLogModel.create(tx, { action: 'assetCreated', objectType: 'asset', objectId: asset.id });
      return asset;
    });
  },

  // An update that changes nothing is not logged.
  update(id: string, input: AssetUpdate): Promise<Asset | null> {
    return prisma.$transaction(async (tx) => {
      const before = await tx.asset.findUnique({ where: { id } });
      if (!before) return null;

      const after = await tx.asset.update({ where: { id }, data: input });
      const changes = diffFields(before, after, ['name', 'description']);
      if (Object.keys(changes).length > 0) {
        await AuditLogModel.create(tx, { action: 'assetUpdated', objectType: 'asset', objectId: id, changes });
      }
      return after;
    });
  },

  // Only the server changes downloadCount (spec, AST-4).
  async incrementDownloads(id: string): Promise<void> {
    await prisma.asset.update({ where: { id }, data: { downloadCount: { increment: 1 } } });
  },

  // Returns the deleted asset, so the caller can remove its file from S3 after the transaction:
  // if the audit log fails, the row comes back and the file must still be there.
  remove(id: string): Promise<Asset | null> {
    return prisma.$transaction(async (tx) => {
      const asset = await tx.asset.findUnique({ where: { id } });
      if (!asset) return null;
      await tx.asset.delete({ where: { id } });
      await AuditLogModel.create(tx, { action: 'assetDeleted', objectType: 'asset', objectId: id });
      return asset;
    });
  },
};
