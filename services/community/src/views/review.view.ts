import type { Review } from '../generated/prisma/client';

// What the client sees (AM review/list). authorName comes from identity: null when the user no longer exists or
// identity did not answer.
export interface ReviewView {
  id: string;
  assetId: string;
  authorId: string;
  authorName: string | null;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export function toReviewView(review: Review, usernames: ReadonlyMap<string, string>): ReviewView {
  return {
    id: review.id,
    assetId: review.assetId,
    authorId: review.authorId,
    authorName: usernames.get(review.authorId) ?? null,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt.toISOString(),
  };
}
