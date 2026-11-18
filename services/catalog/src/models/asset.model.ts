import { HttpError } from '@assetstore/shared';
import { prisma } from '../db/prisma';
import type { Asset, Prisma } from '../generated/prisma/client';
import { AuditLogModel, diffFields } from './audit-log.model';
import { escapeLike } from '../utils/escapeLike';
import { TagModel } from './tag.model';

export type { Asset };

// Every asset the model returns comes with the names of its tags (AssetView.tagList).
const withTags = { tags: { select: { tag: { select: { name: true } } } } } as const;
export type AssetWithTags = Prisma.AssetGetPayload<{ include: typeof withTags }>;

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

export type Actor = { id: string; role: 'USER' | 'ADMIN' };

function canEdit(asset: Asset, actor: Actor): boolean {
  return asset.ownerId !== null && asset.ownerId === actor.id;
}

function canDelete(asset: Asset, actor: Actor): boolean {
  return canEdit(asset, actor) || actor.role === 'ADMIN';
}

export const AssetModel = {
  // Newest first (AM asset/list); id breaks ties so that paging never repeats or skips an asset.
  // ownerId = null lists everybody's assets.
  async findPage(options: { name: string; ownerId: string | null; pageIndex: number; pageSize: number }) {
    const where = {
      ...(options.name ? { name: { contains: escapeLike(options.name), mode: 'insensitive' as const } } : {}),
      ...(options.ownerId ? { ownerId: options.ownerId } : {}),
    };
    const [items, total] = await prisma.$transaction([
      prisma.asset.findMany({
        where,
        include: withTags,
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

  // Name and owner only, for other services (GET /internal/assets).
  findSummaries(ids: string[]) {
    return prisma.asset.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, ownerId: true } });
  },

  findById(id: string): Promise<AssetWithTags | null> {
    return prisma.asset.findUnique({ where: { id }, include: withTags });
  },

  // US-1.1: links the asset to exactly these tags (normalized names, see normalizeTagList); missing tags are created.
  // In the caller's transaction, so a failure undoes the asset change too. Shared by create and, later, edit (US-2).
  async setTags(tx: Prisma.TransactionClient, assetId: string, names: string[]): Promise<void> {
    const tags = await TagModel.findOrCreate(tx, names);
    await tx.assetTag.deleteMany({ where: { assetId, tagId: { notIn: tags.map((tag) => tag.id) } } });
    await tx.assetTag.createMany({ data: tags.map((tag) => ({ assetId, tagId: tag.id })), skipDuplicates: true });
  },

  // Creating, updating and deleting write an audit log entry in the same transaction:
  // if the entry cannot be written, the change is undone (README, Audit log, rule 1).
  // The asset, its tags (new ones created) and the audit entry are saved together or not at all (US-1.1).
  create(input: AssetInput, tagNames: string[], actor: Actor): Promise<AssetWithTags> {
    return prisma.$transaction(async (tx) => {
      const asset = await tx.asset.create({ data: { ...input, ownerId: actor.id } });
      await AssetModel.setTags(tx, asset.id, tagNames);
      await AuditLogModel.create(tx, {
        action: 'assetCreated',
        objectType: 'asset',
        objectId: asset.id,
        actorId: actor.id,
      });
      return tx.asset.findUniqueOrThrow({ where: { id: asset.id }, include: withTags });
    });
  },

  // An update that changes nothing is not logged.
  update(id: string, input: AssetUpdate, actor: Actor): Promise<AssetWithTags | null> {
    return prisma.$transaction(async (tx) => {
      const before = await tx.asset.findUnique({ where: { id } });
      if (!before) return null;
      if (!canEdit(before, actor)) throw new HttpError(403, 'Only the owner can edit this asset');

      // updateMany, not update: an asset deleted in the meantime is a 404 (null), not an error.
      const { count } = await tx.asset.updateMany({ where: { id }, data: input });
      if (count === 0) return null;

      const after = await tx.asset.findUniqueOrThrow({ where: { id }, include: withTags });
      const changes = diffFields(before, after, ['name', 'description']);
      if (Object.keys(changes).length > 0) {
        await AuditLogModel.create(tx, {
          action: 'assetUpdated',
          objectType: 'asset',
          objectId: id,
          changes,
          actorId: actor.id,
        });
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
  remove(id: string, actor: Actor): Promise<Asset | null> {
    return prisma.$transaction(async (tx) => {
      const asset = await tx.asset.findUnique({ where: { id } });
      if (!asset) return null;
      if (!canDelete(asset, actor)) throw new HttpError(403, 'Only the owner or an admin can delete this asset');
      await tx.asset.delete({ where: { id } });
      await AuditLogModel.create(tx, { action: 'assetDeleted', objectType: 'asset', objectId: id, actorId: actor.id });
      return asset;
    });
  },
};
