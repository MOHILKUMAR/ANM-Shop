import { useEffect, useState } from "react";
import { apiRequest } from "../api.js";

// Pick products by searching the whole catalogue (not just the first page). `selected` holds
// { _id, name } so chosen products stay listed even when they are not in the results.
function ProductPicker({ token, selected, onChange, id = "product-picker" }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const term = query.trim();

  useEffect(() => {
    if (!term) return undefined;
    let active = true;
    const timer = setTimeout(() => {
      setSearching(true);
      apiRequest(`/products/manage?${new URLSearchParams({ search: term, limit: "20" })}`, { token })
        .then((result) => {
          if (active) setResults(result.items || []);
        })
        .catch(() => {
          if (active) setResults([]);
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [token, term]);

  const isSelected = (productId) => selected.some((product) => product._id === productId);
  const add = (product) => onChange([...selected, { _id: product._id, name: product.name }]);
  const remove = (productId) => onChange(selected.filter((product) => product._id !== productId));

  return (
    <div>
      {selected.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-2" aria-label="Selected products">
          {selected.map((product) => (
            <li className="flex items-center gap-1 rounded-full border border-brand-600 bg-brand-50 py-1 pl-3 pr-1 text-xs font-medium text-brand-800" key={product._id}>
              {product.name}
              <button className="rounded-full px-1.5 text-brand-700 hover:bg-brand-100" type="button" aria-label={`Remove ${product.name}`} onClick={() => remove(product._id)}>×</button>
            </li>
          ))}
        </ul>
      )}
      <input
        id={id}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand-500"
        type="search"
        maxLength={100}
        placeholder="Search products by name"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {term && (
        <ul className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white text-sm" aria-live="polite">
          {searching && <li className="px-3 py-2 text-gray-500">Searching…</li>}
          {!searching && results.length === 0 && <li className="px-3 py-2 text-gray-500">No products match “{term}”.</li>}
          {!searching && results.map((product) => (
            <li className="flex items-center justify-between gap-2 border-b border-gray-100 px-3 py-2 last:border-0" key={product._id}>
              <span className="min-w-0 truncate">{product.name} <span className="text-gray-400">· {product.category}</span></span>
              <button
                className="shrink-0 rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                type="button"
                disabled={isSelected(product._id)}
                onClick={() => add(product)}
              >
                {isSelected(product._id) ? "Added" : "Add"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default ProductPicker;
