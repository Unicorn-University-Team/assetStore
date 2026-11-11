import { prisma } from '../db/prisma';
import type { Asset } from '../generated/prisma/client';
import { AuditLogModel, diffFields } from './audit-log.model';
import { escapeLike } from '../utils/escapeLike';

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
  // Newest first (AM asset/list); id breaks ties so that paging never repeats or skips an asset.
  async findPage(options: { name: string; pageIndex: number; pageSize: number }) {
    const where = options.name ? { name: { contains: escapeLike(options.name), mode: 'insensitive' as const } } : {};
    const [items, total] = await prisma.$transaction([
      prisma.asset.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: options.pageIndex * options.pageSize,
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
  // if the entry cannot be written, the change is undone (README, Audit log, rule 1).
  create(input: AssetInput, actorId: string): Promise<Asset> {
    return prisma.$transaction(async (tx) => {
      const asset = await tx.asset.create({ data: input });
      await AuditLogModel.create(tx, { action: 'assetCreated', objectType: 'asset', objectId: asset.id, actorId });
      return asset;
    });
  },

  // An update that changes nothing is not logged.
  update(id: string, input: AssetUpdate, actorId: string): Promise<Asset | null> {
    return prisma.$transaction(async (tx) => {
      const before = await tx.asset.findUnique({ where: { id } });
      if (!before) return null;

      // updateMany, not update: an asset deleted in the meantime is a 404 (null), not an error.
      const { count } = await tx.asset.updateMany({ where: { id }, data: input });
      if (count === 0) return null;

      const after = await tx.asset.findUniqueOrThrow({ where: { id } });
      const changes = diffFields(before, after, ['name', 'description']);
      if (Object.keys(changes).length > 0) {
        await AuditLogModel.create(tx, { action: 'assetUpdated', objectType: 'asset', objectId: id, changes, actorId });
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
  remove(id: string, actorId: string): Promise<Asset | null> {
    return prisma.$transaction(async (tx) => {
      const asset = await tx.asset.findUnique({ where: { id } });
      if (!asset) return null;
      await tx.asset.delete({ where: { id } });
      await AuditLogModel.create(tx, { action: 'assetDeleted', objectType: 'asset', objectId: id, actorId });
      return asset;
    });
  },
};
