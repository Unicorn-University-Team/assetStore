import { prisma } from '../db/prisma';
import type { Collection } from '../generated/prisma/client';

export type { Collection };

export const CollectionModel = {
  create(data: { ownerId: string; name: string; description: string }) {
    return prisma.collection.create({ data });
  },

  // Newest first; the id breaks ties so the order is always the same.
  listByOwner(ownerId: string) {
    return prisma.collection.findMany({ where: { ownerId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
  },

  get (data : {collectionId: string, pageIndex: number, pageSize: number}){
    return prisma.collection.findUnique({
      where: {id: data.collectionId},
      include: {assets : {
        skip: data.pageIndex * data.pageSize,
        take: data.pageSize,
        orderBy: [{addedAt: 'asc'}, {assetId: 'asc'}]
      },
  }})
  },

  count(collectionId : string){
    return prisma.collectionAsset.count({
      where: {collectionId}
    })
  }
};
