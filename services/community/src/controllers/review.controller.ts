import type { Request, Response } from 'express';
import { HttpError } from '@assetstore/shared';
import { CatalogClient } from '../clients/catalog.client';
import { IdentityClient } from '../clients/identity.client';
import { Prisma } from '../generated/prisma/client';
import { ReviewModel } from '../models/review.model';
import { toReviewView } from '../views/review.view';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COMMENT_MAX_LENGTH = 2000;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// Whole number from the query string. max = null means no upper limit.
function readInteger(field: string, value: unknown, min: number, max: number | null, fallback: number): number {
  if (value === undefined) return fallback;
  const number = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(number) || number < min || (max !== null && number > max)) {
    const range = max === null ? `>= ${min}` : `from ${min} to ${max}`;
    throw new HttpError(400, `"${field}" must be an integer ${range}`);
  }
  return number;
}

// Whole number of stars from 1 to 5 (the same rule as CHECK "review_rating_check").
function readRating(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 5) {
    throw new HttpError(400, '"rating" must be a whole number from 1 to 5');
  }
  return value;
}

// The comment is optional: missing, null or only spaces = no comment (null).
function readComment(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new HttpError(400, '"comment" must be a string');
  const comment = value.trim();
  if (comment.length > COMMENT_MAX_LENGTH) {
    throw new HttpError(400, `"comment" must be at most ${COMMENT_MAX_LENGTH} characters`);
  }
  return comment === '' ? null : comment;
}

export const ReviewController = {
  // AM review/list, GET /api/assets/:assetId/reviews?pageIndex=&pageSize= (no login): newest first. Like the AM
  // algorithm, it does not ask catalog whether the asset exists: an unknown asset simply has no reviews.
  async list(req: Request<{ assetId: string }>, res: Response) {
    const assetId = req.params.assetId.toLowerCase();
    if (!UUID.test(assetId)) throw new HttpError(400, '"assetId" must be a UUID');
    const pageIndex = readInteger('pageIndex', req.query.pageIndex, 0, null, 0);
    const pageSize = readInteger('pageSize', req.query.pageSize, 1, MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE);
    const { items, total } = await ReviewModel.findPageByAsset({ assetId, pageIndex, pageSize });

    // One identity call for the whole page; names are only for display.
    const usernames = await IdentityClient.usernames(items.map((review) => review.authorId));
    res.json({ itemList: items.map((review) => toReviewView(review, usernames)), pageInfo: { pageIndex, pageSize, total } });
  },

  // US-4, POST /api/assets/:assetId/reviews: { rating, comment? }. Any logged-in user except the asset's owner,
  // one review per user and asset.
  async create(req: Request<{ assetId: string }>, res: Response) {
    const authorId: string = res.locals.userId;
    const body = (req.body ?? {}) as { rating?: unknown; comment?: unknown };
    const rating = readRating(body.rating);
    const comment = readComment(body.comment);

    const assetId = req.params.assetId.toLowerCase();
    const asset = UUID.test(assetId) ? (await CatalogClient.assetSummaries([assetId])).get(assetId) : undefined;
    if (!asset) throw new HttpError(404, 'Asset not found');
    if (asset.ownerId === authorId) throw new HttpError(403, 'You cannot review your own asset');

    let review;
    try {
      review = await ReviewModel.create({ assetId, authorId, rating, comment });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new HttpError(409, 'You have already reviewed this asset');
      }
      throw error;
    }

    // Names are only for display: when identity does not answer, authorName is null.
    const [summary, usernames] = await Promise.all([
      ReviewModel.ratingSummary(assetId),
      IdentityClient.usernames([authorId]),
    ]);
    res.status(201).json({
      id: review.id,
      assetId: review.assetId,
      authorId: review.authorId,
      authorName: usernames.get(authorId) ?? null,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt,
      averageRating: summary.averageRating,
      reviewCount: summary.reviewCount,
    });
  },
};
