import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ApiError } from '../api/client'
import { createReview, listReviews, type Review } from '../api/reviews'
import { useAuth } from '../auth/auth-context'
import InlineError from './InlineError'

const COMMENT_MAX = 2000

type AssetReviewsProps = {
  assetId: string
  ownerId: string | null
  averageRating: number | null
  reviewCount: number
  onSummary: (averageRating: number | null, reviewCount: number) => void
}

function initial(name: string | null): string {
  const first = Array.from((name ?? '').trim())[0]
  return first ? first.toLocaleUpperCase() : '?'
}

function Stars({ value }: { value: number }) {
  const filled = Math.round(value)
  return (
    <span className="review-stars" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => <span key={star} className={star <= filled ? 'is-on' : undefined}>★</span>)}
    </span>
  )
}

function StarPicker({ value, disabled, onChange }: { value: number; disabled: boolean; onChange: (rating: number) => void }) {
  const [hover, setHover] = useState(0)
  const shown = hover || value
  return (
    <div className="star-input" role="radiogroup" aria-required="true" aria-labelledby="review-rating-label">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} ${star === 1 ? 'star' : 'stars'}`}
          className={star <= shown ? 'is-on' : undefined}
          disabled={disabled}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          onFocus={() => setHover(star)}
          onBlur={() => setHover(0)}
          onClick={() => onChange(star)}
        >
          ★
        </button>
      ))}
    </div>
  )
}

function reviewDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function AssetReviews({ assetId, ownerId, averageRating, reviewCount, onSummary }: AssetReviewsProps) {
  const { user, status } = useAuth()
  const location = useLocation()
  const [reviews, setReviews] = useState<Review[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(reviewCount)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [retryKey, setRetryKey] = useState(0)

  const mine = user ? reviews.some((review) => review.authorId === user.id) : false
  const isOwner = Boolean(user && user.id === ownerId)
  const showForm = status !== 'loading' && !isOwner && !mine && !done

  useEffect(() => {
    const controller = new AbortController()
    listReviews(assetId, 1, controller.signal)
      .then((result) => {
        setReviews(result.items)
        setPage(1)
        setTotal(result.total)
        setLoadError('')
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return
        setLoadError(cause instanceof Error ? cause.message : 'Could not load the reviews.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [assetId, retryKey])

  async function showMore() {
    const nextPage = page + 1
    setBusy(true)
    try {
      const result = await listReviews(assetId, nextPage)
      setReviews((current) => {
        const seen = new Set(current.map((review) => review.id))
        return [...current, ...result.items.filter((review) => !seen.has(review.id))]
      })
      setPage(nextPage)
      setTotal(result.total)
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : 'Could not load the reviews.')
    } finally {
      setBusy(false)
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || rating < 1) return
    setBusy(true)
    setFormError('')
    try {
      const created = await createReview(assetId, rating, comment)
      setReviews((current) => current.some((review) => review.id === created.id) ? current : [created, ...current])
      setTotal(created.reviewCount)
      onSummary(created.averageRating, created.reviewCount)
      setRating(0)
      setComment('')
      setDone(true)
    } catch (cause) {
      if (cause instanceof ApiError && (cause.status === 409 || cause.status === 403)) {
        setDone(true)
        setFormError(cause.message)
        return
      }
      setFormError(cause instanceof Error ? cause.message : 'The review could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="asset-reviews">
      {reviewCount > 0 && averageRating != null ? (
        <div className="review-summary">
          <p className="review-average">{averageRating.toFixed(1)}</p>
          <div>
            <Stars value={averageRating} />
            <p>{reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}</p>
          </div>
        </div>
      ) : (
        <p className="review-empty">No reviews yet.</p>
      )}

      {showForm && !user && (
        <p className="review-note">
          <Link to="/login" state={{ from: location.pathname }}>Log in</Link> to review this asset.
        </p>
      )}
      {showForm && user && (
        <form className="review-form" onSubmit={(event) => { void submit(event) }}>
          <h3>Write a review</h3>
          {formError && <InlineError message={formError} />}
          <p className="review-label" id="review-rating-label">Rating <span className="required-mark" aria-hidden="true">*</span></p>
          <StarPicker value={rating} disabled={busy} onChange={setRating} />
          <label htmlFor="review-comment">Comment</label>
          <textarea
            id="review-comment"
            value={comment}
            maxLength={COMMENT_MAX}
            rows={3}
            disabled={busy}
            placeholder="What was it like to use this asset?"
            onChange={(event) => setComment(event.target.value)}
          />
          <div className="review-form-actions">
            <button type="submit" className="button button-primary" disabled={busy || rating < 1}>
              {busy ? 'Submitting…' : 'Submit'}
            </button>
          </div>
        </form>
      )}
      {done && !formError && <p className="review-note" role="status">Your review was saved.</p>}
      {done && formError && <InlineError message={formError} />}

      {loading && <p className="review-note" role="status">Loading reviews…</p>}
      {!loading && loadError && (
        <div>
          <InlineError message={loadError} />
          <button type="button" className="button button-secondary" onClick={() => { setLoading(true); setRetryKey((value) => value + 1) }}>Try again</button>
        </div>
      )}
      {reviews.length > 0 && (
        <ul className="review-list">
          {reviews.map((review) => (
            <li className="review-item" key={review.id}>
              <span className="review-avatar" aria-hidden="true">{initial(review.authorName)}</span>
              <div>
                <div className="review-meta">
                  <strong>{review.authorName ?? 'Unknown'}</strong>
                  <Stars value={review.rating} />
                  <time dateTime={review.createdAt}>{reviewDate(review.createdAt)}</time>
                </div>
                {review.comment && <p className="review-comment">{review.comment}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {reviews.length < total && (
        <button type="button" className="button button-secondary review-more" disabled={busy} onClick={() => { void showMore() }}>
          {busy ? 'Loading…' : 'Show more reviews'}
        </button>
      )}
    </div>
  )
}
