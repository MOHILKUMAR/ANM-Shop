import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api.js";
import { ListSkeleton } from "./Skeletons.jsx";
import { RatingBadge } from "./ProductReviews.jsx";
import { RATING_OPTIONS } from "../data/reviews.js";

const day = (date) => new Date(date).toLocaleDateString("en-IN", { dateStyle: "medium" });
const statusTabs = [["all", "All"], ["visible", "Visible"], ["hidden", "Hidden"]];

function AdminReviews({ token }) {
  const [status, setStatus] = useState("all");
  const [rating, setRating] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [updatingId, setUpdatingId] = useState("");

  useEffect(() => {
    let active = true;
    const query = new URLSearchParams({ status, page: String(page) });
    if (rating) query.set("rating", rating);
    apiRequest(`/reviews?${query}`, { token })
      .then((result) => {
        if (!active) return;
        setData(result);
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
  }, [token, status, rating, page]);

  // Changing a filter starts again from the first page.
  function changeFilter(update) {
    setLoading(true);
    setNotice("");
    setPage(1);
    update();
  }

  function goToPage(next) {
    setLoading(true);
    setPage(next);
  }

  async function setHidden(review, hidden) {
    setUpdatingId(review._id);
    setError("");
    setNotice("");
    try {
      const result = await apiRequest(`/reviews/${review._id}`, {
        method: "PATCH",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hidden }),
      });
      setData((current) => ({
        ...current,
        reviews: current.reviews.map((item) => (item._id === review._id ? result.review : item)),
        counts: {
          ...current.counts,
          hidden: current.counts.hidden + (hidden ? 1 : -1),
          visible: current.counts.visible + (hidden ? -1 : 1),
        },
      }));
      setNotice(result.message);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setUpdatingId("");
    }
  }

  const counts = data?.counts;
  const pagination = data?.pagination;

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Product reviews</h2>
          <p className="mt-1 text-sm text-gray-500">Hidden reviews stay saved but disappear from the product page and its rating.</p>
        </div>
        <div>
          <label className="sr-only" htmlFor="review-rating-filter">Filter by rating</label>
          <select id="review-rating-filter" className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500" value={rating} onChange={(event) => changeFilter(() => setRating(event.target.value))}>
            <option value="">All ratings</option>
            {RATING_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
        {statusTabs.map(([value, label]) => (
          <button
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${status === value ? "bg-brand-700 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
            key={value}
            type="button"
            aria-pressed={status === value}
            onClick={() => changeFilter(() => setStatus(value))}
          >
            {label}{counts ? ` (${counts[value]})` : ""}
          </button>
        ))}
      </div>

      {notice && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800" role="status">{notice}</p>}
      {error && <p className="rounded-lg bg-red-50 p-4 text-red-700" role="alert">{error}</p>}
      {loading && <ListSkeleton rows={4} withThumbnail label="Loading reviews" />}
      {!loading && data && data.reviews.length === 0 && (
        <p className="rounded-xl bg-gray-50 p-6 text-gray-600">No reviews match these filters.</p>
      )}

      {!loading && data?.reviews.map((review) => (
        <article className={`flex flex-col gap-4 rounded-xl border bg-white p-4 sm:flex-row ${review.hidden ? "border-amber-300" : "border-gray-200"}`} key={review._id}>
          {review.product?.imageUrls
            ? <img className="h-16 w-16 shrink-0 rounded-lg bg-gray-50 object-contain" src={review.product.imageUrls} alt="" />
            : <div className="h-16 w-16 shrink-0 rounded-lg bg-gray-100" />}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <RatingBadge rating={review.rating} />
              {review.product
                ? <Link className="font-semibold text-gray-900 hover:text-brand-700" to={`/product/${review.product._id}`}>{review.product.name}</Link>
                : <span className="font-semibold text-gray-500">Deleted product</span>}
              {review.hidden && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">Hidden</span>}
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {review.user ? `${review.user.name} (${review.user.email})` : review.name}
              {review.verifiedBuyer ? " · Verified buyer" : ""} · {day(review.createdAt)}
            </p>
            {review.comment
              ? <p className="mt-2 whitespace-pre-line break-words text-sm text-gray-700">{review.comment}</p>
              : <p className="mt-2 text-sm italic text-gray-400">Rating only (from the old star ratings)</p>}
          </div>
          <div className="shrink-0">
            <button
              className={`rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50 ${review.hidden ? "text-brand-700 hover:bg-brand-50" : "text-red-600 hover:bg-red-50"}`}
              type="button"
              disabled={updatingId === review._id}
              onClick={() => setHidden(review, !review.hidden)}
            >
              {updatingId === review._id ? "Saving…" : review.hidden ? "Show" : "Hide"}
            </button>
          </div>
        </article>
      ))}

      {!loading && pagination?.pages > 1 && (
        <nav className="flex items-center justify-end gap-3 pt-3" aria-label="Review pages">
          <button className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-40" type="button" disabled={page <= 1} onClick={() => goToPage(page - 1)}>Previous</button>
          <span className="text-sm text-gray-600">Page {page} of {pagination.pages}</span>
          <button className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-40" type="button" disabled={page >= pagination.pages} onClick={() => goToPage(page + 1)}>Next</button>
        </nav>
      )}
    </section>
  );
}

export default AdminReviews;
