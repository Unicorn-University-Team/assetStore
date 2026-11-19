import { prisma } from '../db/prisma';

export const ReviewModel = {
  // A second review of the same asset by the same user fails on the unique (authorId, assetId): Prisma P2002.
  create(data: { assetId: string; authorId: string; rating: number; comment: string | null }) {
    return prisma.review.create({ data });
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
