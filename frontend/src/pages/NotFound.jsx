import { Link } from "react-router-dom";
import { usePageMeta } from "../usePageMeta.js";

// Shown for any address the app has no page for (Vercel sends every path to the app).
function NotFound() {
  usePageMeta({ title: "Page not found", noindex: true });
  return (
    <main className="mx-auto min-h-[60vh] max-w-3xl px-4 py-16 text-center">
      <p className="text-sm font-semibold uppercase tracking-wider text-brand-700">Error 404</p>
      <h1 className="mt-2 text-3xl font-bold text-gray-900">Page not found</h1>
      <p className="mt-3 text-gray-600">The link may be broken, or the page may have moved.</p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Link className="rounded-lg bg-brand-700 px-5 py-3 font-semibold text-white hover:bg-brand-800" to="/shop">Browse products</Link>
        <Link className="rounded-lg border border-gray-300 px-5 py-3 font-semibold text-gray-700 hover:bg-gray-50" to="/">Go to the home page</Link>
      </div>
    </main>
  );
}

export default NotFound;
