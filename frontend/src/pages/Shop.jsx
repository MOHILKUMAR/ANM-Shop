import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiRequest } from "../api.js";
import ProductCard from "../components/ProductCard.jsx";
import { ProductGridSkeleton, Shimmer } from "../components/Skeletons.jsx";

function Shop() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const category = searchParams.get("category") || "";
  const page = Number(searchParams.get("page")) || 1;

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      const query = new URLSearchParams({ page: String(page), limit: "24" });
      if (search.trim()) query.set("search", search.trim());
      if (category) query.set("category", category);

      apiRequest(`/products?${query.toString()}`)
        .then((data) => {
          if (!active) return;
          setProducts(Array.isArray(data.items) ? data.items : []);
          setCategories(Array.isArray(data.categories) ? data.categories : []);
          setPagination(data.pagination || { page: 1, pages: 1, total: 0 });
          setError("");
        })
        .catch((requestError) => {
          if (active) setError(requestError.message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, search ? 250 : 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [search, category, page]);

  function changeCategory(nextCategory) {
    setLoading(true);
    setSearchParams(nextCategory ? { category: nextCategory } : {});
  }

  function changePage(nextPage) {
    setLoading(true);
    const nextParams = new URLSearchParams(searchParams);
    if (nextPage > 1) nextParams.set("page", String(nextPage));
    else nextParams.delete("page");
    setSearchParams(nextParams);
  }

  return (
    <main className="mx-auto min-h-[60vh] max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-brand-700">ANM-Shop beauty edit</p>
          <h1 className="text-3xl font-bold text-gray-900">Beauty for your everyday rituals</h1>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="sr-only" htmlFor="product-search">Search products</label>
          <input
            id="product-search"
            className="rounded-lg border border-gray-300 px-4 py-2.5 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            type="search"
            placeholder="Search skincare, makeup, haircare..."
            value={search}
            onChange={(event) => {
              setLoading(true);
              setSearch(event.target.value);
              if (page !== 1) changePage(1);
            }}
          />
          <label className="sr-only" htmlFor="product-category">Filter by category</label>
          <select
            id="product-category"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            value={category}
            onChange={(event) => changeCategory(event.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
      </div>

      {loading
        ? <Shimmer className="mb-4 h-5 w-24" />
        : <p className="mb-4 text-sm text-gray-500">{pagination.total} product{pagination.total === 1 ? "" : "s"}</p>}
      {loading && <ProductGridSkeleton />}
      {!loading && error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <h2 className="font-semibold">Couldn’t load the store</h2>
          <p className="mt-1">{error}. Make sure the backend is running and has products.</p>
        </div>
      )}
      {!loading && !error && products.length === 0 && (
        <p className="rounded-xl bg-gray-100 p-8 text-center text-gray-600">
          {pagination.total ? "No products match those filters." : "No products are available yet."}
        </p>
      )}
      {!loading && !error && products.length > 0 && (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => <ProductCard key={product._id} product={product} />)}
          </div>
          {pagination.pages > 1 && (
            <nav className="mt-10 flex items-center justify-center gap-4" aria-label="Product pages">
              <button className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium disabled:opacity-40" type="button" disabled={page <= 1 || loading} onClick={() => changePage(page - 1)}>Previous</button>
              <span className="text-sm text-gray-600">Page {page} of {pagination.pages}</span>
              <button className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium disabled:opacity-40" type="button" disabled={page >= pagination.pages || loading} onClick={() => changePage(page + 1)}>Next</button>
            </nav>
          )}
        </>
      )}
    </main>
  );
}

export default Shop;
