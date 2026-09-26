import { useContext, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiRequest } from "../api.js";
import CartContext from "../context/CartContext.js";
import AuthContext from "../context/AuthContext.js";

function ProductDetail() {
  const { id } = useParams();
  const { addToCart } = useContext(CartContext);
  const { user } = useContext(AuthContext);
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [added, setAdded] = useState(false);
  const [reviewRating, setReviewRating] = useState("5");
  const [sentiment, setSentiment] = useState("good");
  const [reviewError, setReviewError] = useState("");
  const [reviewSuccess, setReviewSuccess] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    let active = true;

    apiRequest(`/products/${id}`)
      .then((data) => {
        if (active) setProduct(data);
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
  }, [id]);

  async function submitReview(event) {
    event.preventDefault();
    setReviewError("");
    setReviewSuccess("");
    setSubmittingReview(true);

    try {
      const updatedProduct = await apiRequest(`/products/${id}/reviews`, {
        method: "POST",
        token: user.token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: Number(reviewRating), sentiment }),
      });
      setProduct(updatedProduct);
      setReviewSuccess("Your review has been saved.");
    } catch (requestError) {
      setReviewError(requestError.message);
    } finally {
      setSubmittingReview(false);
    }
  }

  if (loading) return <main className="mx-auto min-h-[60vh] max-w-7xl px-4 py-16 text-center">Loading product…</main>;
  if (error || !product) {
    return (
      <main className="mx-auto min-h-[60vh] max-w-7xl px-4 py-16 text-center">
        <p className="mb-5 text-gray-700">{error || "Product not found."}</p>
        <Link className="font-semibold text-brand-700 hover:text-brand-900" to="/shop">Back to shop</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-[60vh] max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <Link className="mb-8 inline-block font-medium text-brand-700 hover:text-brand-900" to="/shop">Back to shop</Link>
      <div className="grid gap-10 rounded-2xl bg-white p-6 shadow-sm md:grid-cols-2 md:p-10">
        <div className="flex min-h-72 items-center justify-center overflow-hidden rounded-xl bg-gray-50">
          <img className="max-h-112 w-full object-contain" src={product.imageUrls} alt={product.name} />
        </div>
        <div className="flex flex-col items-start justify-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand-700">{product.category}</p>
          <h1 className="text-3xl font-bold text-gray-900">{product.name}</h1>
          <p className="mt-4 text-2xl font-semibold text-gray-900">
            {Number(product.price).toLocaleString("en-IN", { style: "currency", currency: "INR" })}
          </p>
          <p className="mt-3 text-sm font-medium text-amber-700">
            {product.numReviews > 0 ? `${product.rating} / 5 from ${product.numReviews} customer review${product.numReviews === 1 ? "" : "s"}` : "No customer reviews yet"}
          </p>
          <p className="mt-5 leading-7 text-gray-600">{product.description}</p>
          <p className={`mt-5 text-sm ${product.stock > 0 ? "text-green-700" : "text-red-700"}`}>
            {product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}
          </p>
          <button
            className="mt-7 rounded-lg bg-brand-700 px-6 py-3 font-semibold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-gray-400"
            type="button"
            disabled={product.stock < 1}
            onClick={() => {
              addToCart(product);
              setAdded(true);
            }}
          >
            {added ? "Added to cart" : "Add to cart"}
          </button>
        </div>
      </div>

      <section className="mt-10 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
        <h2 className="text-2xl font-semibold text-gray-900">Customer reviews</h2>
        {user ? (
          <form className="mt-6 grid gap-4 rounded-xl bg-gray-50 p-5 sm:grid-cols-3 sm:items-end" onSubmit={submitReview}>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="review-rating">Your rating</label>
              <select id="review-rating" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5" value={reviewRating} onChange={(event) => setReviewRating(event.target.value)}>
                {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} star{value === 1 ? "" : "s"}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="review-sentiment">How is this product?</label>
              <select id="review-sentiment" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5" value={sentiment} onChange={(event) => setSentiment(event.target.value)}>
                <option value="good">Good</option>
                <option value="average">Average</option>
                <option value="bad">Bad</option>
              </select>
            </div>
            <button className="rounded-lg bg-brand-700 px-5 py-2.5 font-semibold text-white hover:bg-brand-800 disabled:cursor-wait disabled:opacity-60" type="submit" disabled={submittingReview}>
              {submittingReview ? "Saving…" : "Submit review"}
            </button>
            {reviewError && <p className="text-sm text-red-700 sm:col-span-3" role="alert">{reviewError}</p>}
            {reviewSuccess && <p className="text-sm text-green-700 sm:col-span-3" role="status">{reviewSuccess}</p>}
          </form>
        ) : (
          <p className="mt-4 text-gray-600"><Link className="font-semibold text-brand-700 hover:text-brand-900" to="/login" state={{ from: `/product/${id}` }}>Sign in</Link> to rate this product.</p>
        )}

        <div className="mt-8 space-y-4">
          {product.reviews?.length ? product.reviews.map((review) => (
            <article className="rounded-xl border border-gray-200 p-4" key={review._id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-gray-900">{review.name}</p>
                <p className="font-medium text-amber-700">{review.rating} / 5 stars</p>
              </div>
              <p className="mt-2 text-sm text-gray-600">{review.sentiment === "good" ? "Good" : review.sentiment === "average" ? "Average" : "Bad"} product</p>
            </article>
          )) : <p className="text-gray-600">Be the first customer to review this product.</p>}
        </div>
      </section>
    </main>
  );
}

export default ProductDetail;
