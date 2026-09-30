import { useContext, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiRequest } from "../api.js";
import CartContext from "../context/CartContext.js";
import { ProductDetailSkeleton } from "../components/Skeletons.jsx";
import ProductReviews from "../components/ProductReviews.jsx";
import { overallRating, reviewCountLabel } from "../data/reviews.js";

function ProductDetail() {
  const { id } = useParams();
  const { addToCart } = useContext(CartContext);
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [added, setAdded] = useState(false);

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

  if (loading) return <ProductDetailSkeleton />;
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
          <a className="mt-3 text-sm font-medium text-amber-700 hover:text-amber-900" href="#reviews-heading">
            {product.numReviews > 0 ? `Rated ${overallRating(product.ratingCounts).label} · ${reviewCountLabel(product.numReviews)}` : "No customer reviews yet"}
          </a>
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

      <ProductReviews
        key={product._id}
        productId={product._id}
        initialSummary={{ total: product.numReviews || 0, counts: product.ratingCounts || {} }}
        onSummaryChange={(summary) => setProduct((current) => ({ ...current, numReviews: summary.total, ratingCounts: summary.counts }))}
      />
    </main>
  );
}

export default ProductDetail;
