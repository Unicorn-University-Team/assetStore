import { prisma } from '../db/prisma';

export interface DeletedAssetContent {
  reviews: number;
  collectionLinks: number;
  reports: number;
  keptReports: number;
}

// Everything community keeps about one asset. Catalog owns the asset; this service only reacts to its deletion.
export const AssetContentModel = {
  // US-3, AM asset/delete step 5 (review, collectionAsset and report DAO deleteByAsset), in one transaction:
  // the reviews and the collection links go, open and rejected reports go, resolved reports stay as moderation history
  // with assetId set to null and their copied assetName kept. Running it again for the same asset changes nothing.
  deleteByAsset(assetId: string): Promise<DeletedAssetContent> {
    return prisma.$transaction(async (tx) => {
      const reviews = await tx.review.deleteMany({ where: { assetId } });
      const collectionLinks = await tx.collectionAsset.deleteMany({ where: { assetId } });
      const reports = await tx.report.deleteMany({ where: { assetId, status: { in: ['open', 'rejected'] } } });
      const keptReports = await tx.report.updateMany({ where: { assetId, status: 'resolved' }, data: { assetId: null } });
      return {
        reviews: reviews.count,
        collectionLinks: collectionLinks.count,
        reports: reports.count,
        keptReports: keptReports.count,
      };
    });
  },
};
