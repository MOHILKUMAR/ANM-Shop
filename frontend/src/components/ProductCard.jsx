import { useContext, useState } from "react";
import { Link } from "react-router-dom";
import CartContext from "../context/CartContext.js";
import { overallRating, reviewCountLabel } from "../data/reviews.js";
import { productImage } from "../imageUrl.js";
import { formatInr } from "../money.js";

// `priority`: one of the first cards on screen, so its image loads first instead of lazily.
function ProductCard({ product, priority = false }) {
  const { addToCart } = useContext(CartContext);
  const [added, setAdded] = useState(false);
  const overall = product.numReviews > 0 ? overallRating(product.ratingCounts) : null;

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <Link className="flex h-56 items-center justify-center bg-gray-50 p-5" to={`/product/${product._id}`}>
        <img className="h-full w-full object-contain" src={productImage(product.imageUrls, 300)} alt={product.name} width="300" height="300" loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} decoding="async" />
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{product.category}</p>
        <Link className="mt-2 text-lg font-semibold text-gray-900 hover:text-brand-700" to={`/product/${product._id}`}>
          {product.name}
        </Link>
        {overall && (
          <p className="mt-1 text-xs font-medium text-amber-700">{overall.label} · {reviewCountLabel(product.numReviews)}</p>
        )}
        <p className="mt-2 line-clamp-2 flex-1 text-sm text-gray-600">{product.description}</p>
        <div className="mt-5 flex items-center justify-between gap-3">
          <span className="font-bold text-gray-900">
            {formatInr(product.price)}
          </span>
          <button
            className="rounded-lg bg-brand-700 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-gray-400"
            type="button"
            disabled={product.stock < 1}
            onClick={() => {
              addToCart(product);
              setAdded(true);
            }}
          >
            {product.stock < 1 ? "Sold out" : added ? "Added" : "Add to cart"}
          </button>
        </div>
      </div>
    </article>
  )
}

export default ProductCard
