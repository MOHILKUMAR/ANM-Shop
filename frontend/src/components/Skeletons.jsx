// Loading placeholders shaped like the content they stand in for, so the page doesn't jump
// when data arrives. Each group announces itself once to screen readers.

export function Shimmer({ className = "" }) {
  return <div className={`shimmer ${className}`} aria-hidden="true" />;
}

function LoadingRegion({ label, className = "", children }) {
  return (
    <div className={className} role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

const repeat = (count) => Array.from({ length: count }, (_, index) => index);

// Mirrors ProductCard.
function ProductCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex h-56 items-center justify-center bg-gray-50 p-5">
        <Shimmer className="h-full w-full" />
      </div>
      <div className="flex flex-1 flex-col p-5">
        <Shimmer className="h-3 w-24" />
        <Shimmer className="mt-3 h-5 w-3/4" />
        <Shimmer className="mt-3 h-3 w-full" />
        <Shimmer className="mt-2 h-3 w-5/6" />
        <div className="mt-5 flex items-center justify-between gap-3">
          <Shimmer className="h-5 w-20" />
          <Shimmer className="h-9 w-28" />
        </div>
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }) {
  return (
    <LoadingRegion label="Loading products" className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {repeat(count).map((index) => <ProductCardSkeleton key={index} />)}
    </LoadingRegion>
  );
}

// Mirrors the ProductDetail layout: image on the left, details on the right. A full screen tall,
// so the footer starts out of view instead of jumping down when the (taller) product arrives.
export function ProductDetailSkeleton() {
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <LoadingRegion label="Loading product">
        <Shimmer className="mb-8 h-5 w-28" />
        <div className="grid gap-10 rounded-2xl bg-white p-6 shadow-sm md:grid-cols-2 md:p-10">
          <Shimmer className="min-h-72 w-full rounded-xl" />
          <div className="flex flex-col justify-center">
            <Shimmer className="h-4 w-28" />
            <Shimmer className="mt-4 h-8 w-4/5" />
            <Shimmer className="mt-5 h-7 w-32" />
            <Shimmer className="mt-4 h-4 w-48" />
            <Shimmer className="mt-6 h-4 w-full" />
            <Shimmer className="mt-2 h-4 w-full" />
            <Shimmer className="mt-2 h-4 w-2/3" />
            <Shimmer className="mt-6 h-4 w-24" />
            <Shimmer className="mt-7 h-12 w-40" />
          </div>
        </div>
      </LoadingRegion>
    </main>
  );
}

// Mirrors the admin summary tiles.
export function StatTilesSkeleton({ count = 7 }) {
  return (
    <LoadingRegion label="Loading store analytics" className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {repeat(count).map((index) => (
        <div className="rounded-xl border border-gray-200 bg-white p-5" key={index}>
          <Shimmer className="h-4 w-24" />
          <Shimmer className="mt-3 h-7 w-20" />
        </div>
      ))}
    </LoadingRegion>
  );
}

// Mirrors the admin product and order rows.
export function ListSkeleton({ rows = 5, label = "Loading", withThumbnail = false }) {
  return (
    <LoadingRegion label={label} className="space-y-3">
      {repeat(rows).map((index) => (
        <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4" key={index}>
          {withThumbnail && <Shimmer className="h-16 w-16 shrink-0" />}
          <div className="min-w-0 flex-1">
            <Shimmer className="h-4 w-2/5" />
            <Shimmer className="mt-2 h-3 w-3/5" />
          </div>
          <Shimmer className="h-8 w-20 shrink-0" />
        </div>
      ))}
    </LoadingRegion>
  );
}

export function TableSkeleton({ rows = 8, columns = 6, label = "Loading" }) {
  return (
    <LoadingRegion label={label} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="flex gap-4 border-b border-gray-200 p-4">
        {repeat(columns).map((index) => <Shimmer className="h-3 flex-1" key={index} />)}
      </div>
      {repeat(rows).map((row) => (
        <div className="flex gap-4 border-b border-gray-100 p-4 last:border-b-0" key={row}>
          {repeat(columns).map((index) => <Shimmer className={`h-4 flex-1 ${index === 1 ? "min-w-24" : ""}`} key={index} />)}
        </div>
      ))}
    </LoadingRegion>
  );
}
