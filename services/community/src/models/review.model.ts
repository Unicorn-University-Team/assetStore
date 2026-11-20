import { prisma } from '../db/prisma';

export const ReviewModel = {
  // A second review of the same asset by the same user fails on the unique (authorId, assetId): Prisma P2002.
  create(data: { assetId: string; authorId: string; rating: number; comment: string | null }) {
    return prisma.review.create({ data });
  },

  // AM review DAO listByAsset: newest first; id breaks ties so that paging never repeats or skips a review.
  async findPageByAsset(options: { assetId: string; pageIndex: number; pageSize: number }) {
    const where = { assetId: options.assetId };
    const [items, total] = await prisma.$transaction([
      prisma.review.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: options.pageIndex * options.pageSize,
        take: options.pageSize,
      }),
      prisma.review.count({ where }),
    ]);
    return { items, total };
  },

  // Average stars rounded to one decimal place (null without reviews) and the number of reviews.
  async ratingSummary(assetId: string): Promise<{ averageRating: number | null; reviewCount: number }> {
    const summary = await prisma.review.aggregate({
      where: { assetId },
      _avg: { rating: true },
      _count: { _all: true },
    });
    const average = summary._avg.rating;
    return {
      averageRating: average === null ? null : Math.round(average * 10) / 10,
      reviewCount: summary._count._all,
    };
  },
};
