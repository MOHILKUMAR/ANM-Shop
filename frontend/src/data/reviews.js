// The three ratings a customer can give, best first (the order the dropdown and breakdown use).
export const RATING_OPTIONS = [
  { value: "excellent", label: "Excellent", badge: "bg-green-50 text-green-800", bar: "bg-green-500" },
  { value: "good", label: "Good", badge: "bg-amber-50 text-amber-800", bar: "bg-amber-400" },
  { value: "bad", label: "Bad", badge: "bg-red-50 text-red-700", bar: "bg-red-400" },
];

export const ratingOption = (value) => RATING_OPTIONS.find((option) => option.value === value) || RATING_OPTIONS[1];

export const COMMENT_MIN = 10;
export const COMMENT_MAX = 1000;

// The overall verdict for a product, e.g. "Excellent" from mostly excellent reviews, using
// bad = 1, good = 2, excellent = 3 and rounding the average. Null with no reviews.
export function overallRating(counts = {}) {
  const bad = counts.bad || 0;
  const good = counts.good || 0;
  const excellent = counts.excellent || 0;
  const total = bad + good + excellent;
  if (!total) return null;
  const average = (bad + good * 2 + excellent * 3) / total;
  return ratingOption(average >= 2.5 ? "excellent" : average >= 1.5 ? "good" : "bad");
}

export const reviewCountLabel = (total) => `${total} review${total === 1 ? "" : "s"}`;
