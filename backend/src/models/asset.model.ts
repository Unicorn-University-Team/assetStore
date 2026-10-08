import { randomUUID } from 'node:crypto';

export interface Asset {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export type AssetInput = Pick<Asset, 'name'>;

const assets = new Map<string, Asset>();

export const AssetModel = {
  findAll(): Asset[] {
    return [...assets.values()];
  },

  findById(id: string): Asset | undefined {
    return assets.get(id);
  },

  create(input: AssetInput): Asset {
    const now = new Date();
    const asset: Asset = { id: randomUUID(), name: input.name, createdAt: now, updatedAt: now };
    assets.set(asset.id, asset);
    return asset;
  },

  update(id: string, input: AssetInput): Asset | undefined {
    const asset = assets.get(id);
    if (!asset) return undefined;

    asset.name = input.name;
    asset.updatedAt = new Date();
    return asset;
  },

  remove(id: string): boolean {
    return assets.delete(id);
  },
};
