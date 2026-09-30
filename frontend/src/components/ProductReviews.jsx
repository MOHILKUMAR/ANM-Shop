import { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api.js";
import AuthContext from "../context/AuthContext.js";
import { ListSkeleton } from "./Skeletons.jsx";
import { COMMENT_MAX, COMMENT_MIN, RATING_OPTIONS, overallRating, ratingOption, reviewCountLabel } from "../data/reviews.js";

const day = (date) => new Date(date).toLocaleDateString("en-IN", { dateStyle: "medium" });

export function RatingBadge({ rating }) {
  const option = ratingOption(rating);
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${option.badge}`}>{option.label}</span>;
}

function RatingSummary({ summary }) {
  const overall = overallRating(summary.counts);
  if (!overall) return <p className="mt-2 text-gray-600">No reviews yet. Be the first to share what you think.</p>;

  return (
    <div className="mt-5 grid gap-6 sm:grid-cols-[12rem_1fr] sm:items-center">
      <div>
        <p className="text-sm text-gray-500">Customers rate it</p>
        <p className="mt-1 text-2xl font-bold text-gray-900">{overall.label}</p>
        <p className="text-sm text-gray-500">from {reviewCountLabel(summary.total)}</p>
      </div>
      <dl className="space-y-2">
        {RATING_OPTIONS.map((option) => {
          const count = summary.counts[option.value] || 0;
          const percent = summary.total ? Math.round((count / summary.total) * 100) : 0;
          return (
            <div className="grid grid-cols-[5.5rem_1fr_3rem] items-center gap-3 text-sm" key={option.value}>
              <dt className="text-gray-700">{option.label}</dt>
              <dd className="h-2.5 overflow-hidden rounded-full bg-gray-100" aria-hidden="true">
                <div className={`h-full rounded-full ${option.bar}`} style={{ width: `${percent}%` }} />
              </dd>
              <dd className="text-right text-gray-600">{count}</dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

// The signed-in customer's own review: write it, edit it, or delete it.
function ReviewForm({ productId, token, onChanged }) {
  const [mine, setMine] = useState(undefined); // undefined while loading, null when none
  const [rating, setRating] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    apiRequest(`/products/${productId}/reviews/mine`, { token })
      .then((data) => {
        if (!active) return;
        setMine(data.review);
        setRating(data.review?.rating || "");
        setComment(data.review?.comment || "");
      })
      .catch(() => {
        if (active) setMine(null);
      });
    return () => {
      active = false;
    };
  }, [productId, token]);

  const trimmed = comment.trim();
  const ready = Boolean(rating) && trimmed.length >= COMMENT_MIN && trimmed.length <= COMMENT_MAX;

  async function submit(event) {
    event.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await apiRequest(`/products/${productId}/reviews`, {
        method: "POST",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment: trimmed }),
      });
      setMine(result.review);
      setComment(result.review.comment);
      setNotice(result.message);
      onChanged(result.summary);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm("Delete your review of this product?")) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await apiRequest(`/products/${productId}/reviews/mine`, { method: "DELETE", token });
      setMine(null);
      setRating("");
      setComment("");
      setNotice(result.message);
      onChanged(result.summary);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  if (mine === undefined) return <ListSkeleton rows={1} label="Loading your review" />;

  return (
    <form className="space-y-4 rounded-xl bg-gray-50 p-5" onSubmit={submit}>
      <h3 className="font-semibold text-gray-900">{mine ? "Your review" : "Write a review"}</h3>
      {mine?.hidden && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          The shop has hidden your review, so other customers can't see it. You can still edit or delete it.
        </p>
      )}
      <div className="max-w-xs">
        <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="review-rating">How would you rate it?</label>
        <select id="review-rating" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 outline-none focus:border-brand-500" required value={rating} onChange={(event) => setRating(event.target.value)}>
          <option value="" disabled>Choose a rating</option>
          {[...RATING_OPTIONS].reverse().map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="review-comment">Your review</label>
        <textarea
          id="review-comment"
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 outline-none focus:border-brand-500"
          rows={4}
          required
          minLength={COMMENT_MIN}
          maxLength={COMMENT_MAX}
          placeholder="What did you like or dislike? How did it work for you?"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
        />
        <p className="mt-1 text-xs text-gray-500">
          {trimmed.length < COMMENT_MIN
            ? `At least ${COMMENT_MIN} characters (${COMMENT_MIN - trimmed.length} more).`
            : `${trimmed.length} / ${COMMENT_MAX} characters`}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button className="rounded-lg bg-brand-700 px-5 py-2.5 font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50" type="submit" disabled={!ready || busy}>
          {busy ? "Saving…" : mine ? "Update review" : "Submit review"}
        </button>
        {mine && (
          <button className="rounded-lg px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50" type="button" disabled={busy} onClick={remove}>
            Delete review
          </button>
        )}
        {!rating && <p className="text-sm text-gray-500">Choose Bad, Good, or Excellent to submit.</p>}
      </div>
      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
      {notice && <p className="text-sm text-green-700" role="status">{notice}</p>}
    </form>
  );
}

function ProductReviews({ productId, initialSummary, onSummaryChange }) {
  const { user } = useContext(AuthContext);
  const [summary, setSummary] = useState(initialSummary);
  const [reviews, setReviews] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiRequest(`/products/${productId}/reviews?page=${page}`)
      .then((data) => {
        if (!active) return;
        setReviews((current) => (page === 1 ? data.reviews : [...current, ...data.reviews]));
        setPagination(data.pagination);
        setSummary(data.summary);
        setError("");
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [productId, page, version]);

  function reviewChanged(nextSummary) {
    setSummary(nextSummary);
    onSummaryChange(nextSummary);
    // Show the latest reviews from the top, including this customer's.
    setLoading(true);
    setPage(1);
    setVersion((current) => current + 1);
  }

  function loadMore() {
    setLoading(true);
    setPage((current) => current + 1);
  }

  return (
    <section className="mt-10 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm md:p-8" aria-labelledby="reviews-heading">
      <h2 className="text-2xl font-semibold text-gray-900" id="reviews-heading">Customer reviews</h2>
      <RatingSummary summary={summary} />

      <div className="mt-8">
        {user ? (
          <ReviewForm key={user._id} productId={productId} token={user.token} onChanged={reviewChanged} />
        ) : (
          <p className="rounded-xl bg-gray-50 p-5 text-gray-600">
            <Link className="font-semibold text-brand-700 hover:text-brand-900" to="/login" state={{ from: `/product/${productId}` }}>Sign in</Link> to write a review.
          </p>
        )}
      </div>

      <div className="mt-8 space-y-4">
        {error && <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700" role="alert">{error}</p>}
        {reviews.map((review) => (
          <article className="rounded-xl border border-gray-200 p-5" key={review._id}>
            <div className="flex flex-wrap items-center gap-2">
              <RatingBadge rating={review.rating} />
              <p className="font-semibold text-gray-900">{review.name}</p>
              {review.verifiedBuyer && <span className="text-xs font-medium text-green-700">✓ Verified buyer</span>}
              <p className="ml-auto text-sm text-gray-500">
                {day(review.createdAt)}
                {new Date(review.updatedAt) - new Date(review.createdAt) > 60000 ? " (edited)" : ""}
              </p>
            </div>
            {review.comment && <p className="mt-3 whitespace-pre-line break-words leading-7 text-gray-700">{review.comment}</p>}
          </article>
        ))}
        {loading && <ListSkeleton rows={page === 1 ? 3 : 1} label="Loading reviews" />}
        {!loading && !error && reviews.length === 0 && summary.total > 0 && (
          <p className="text-gray-600">No reviews to show.</p>
        )}
        {!loading && pagination && page < pagination.pages && (
          <button className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50" type="button" onClick={loadMore}>
            Show more reviews ({pagination.total - reviews.length} more)
          </button>
        )}
      </div>
    </section>
  );
}

export default ProductReviews;
