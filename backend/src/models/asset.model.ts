import { prisma } from '../db/prisma';
import type { Asset } from '../generated/prisma/client';

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

  create(input: AssetInput): Promise<Asset> {
    return prisma.asset.create({ data: input });
  },

  async update(id: string, input: AssetUpdate): Promise<Asset | null> {
    const result = await prisma.asset.updateMany({ where: { id }, data: input });
    return result.count === 0 ? null : prisma.asset.findUnique({ where: { id } });
  },

  // Only the server changes downloadCount (spec, AST-4).
  async incrementDownloads(id: string): Promise<void> {
    await prisma.asset.update({ where: { id }, data: { downloadCount: { increment: 1 } } });
  },

  // Returns the deleted asset, so the caller can remove its file from S3.
  async remove(id: string): Promise<Asset | null> {
    const asset = await prisma.asset.findUnique({ where: { id } });
    if (!asset) return null;
    await prisma.asset.delete({ where: { id } });
    return asset;
  },
};
