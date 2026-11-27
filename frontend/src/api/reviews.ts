import { apiGet, apiPost } from './client'

// Mirrors ReviewView in services/community/src/views/review.view.ts.
export type Review = {
  id: string
  assetId: string
  authorId: string
  authorName: string | null
  rating: number
  comment: string | null
  createdAt: string
}

export type ReviewPage = { items: Review[]; page: number; pageSize: number; total: number }

type ReviewListResponse = {
  itemList: Review[]
  pageInfo: { pageIndex: number; pageSize: number; total: number }
}

// The create answer adds the asset's new average (README, Recenze).
export type CreatedReview = Review & { averageRating: number | null; reviewCount: number }

const PAGE_SIZE = 20

export function listReviews(assetId: string, page = 1, signal?: AbortSignal): Promise<ReviewPage> {
  const query = new URLSearchParams({
    pageIndex: String(Math.max(0, page - 1)),
    pageSize: String(PAGE_SIZE),
  })
  return apiGet<ReviewListResponse>(`/assets/${encodeURIComponent(assetId)}/reviews?${query}`, signal).then((response) => ({
    items: response.itemList,
    page: response.pageInfo.pageIndex + 1,
    pageSize: response.pageInfo.pageSize,
    total: response.pageInfo.total,
  }))
}

// comment is optional: an empty string is stored as no comment.
export function createReview(assetId: string, rating: number, comment: string): Promise<CreatedReview> {
  const trimmed = comment.trim()
  return apiPost<CreatedReview>(`/assets/${encodeURIComponent(assetId)}/reviews`, {
    rating,
    comment: trimmed || null,
  })
}
