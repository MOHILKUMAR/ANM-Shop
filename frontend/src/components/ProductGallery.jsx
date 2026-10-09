import { useState } from "react";
import { productImage } from "../imageUrl.js";

// The product page's photos: a large view and, when there is more than one, thumbnails to
// switch between them. Products from before galleries have only `imageUrls`.
function ProductGallery({ product }) {
  const photos = product.images?.length ? product.images : [product.imageUrls].filter(Boolean);
  const [selected, setSelected] = useState(0);
  const current = photos[selected] || photos[0];

  return (
    <div>
      <div className="flex min-h-72 items-center justify-center overflow-hidden rounded-xl bg-gray-50">
        <img
          className="max-h-112 w-full object-contain"
          src={productImage(current, 560)}
          alt={photos.length > 1 ? `${product.name}, photo ${selected + 1} of ${photos.length}` : product.name}
          width="560"
          height="448"
          fetchPriority={selected === 0 ? "high" : "auto"}
          decoding="async"
        />
      </div>
      {photos.length > 1 && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Product photos">
          {photos.map((url, index) => (
            <li key={url}>
              <button
                className={`block rounded-lg border-2 bg-gray-50 p-0.5 ${index === selected ? "border-brand-600" : "border-transparent hover:border-gray-300"}`}
                type="button"
                aria-label={`Show photo ${index + 1}`}
                aria-pressed={index === selected}
                onClick={() => setSelected(index)}
              >
                <img className="h-16 w-16 rounded-md object-contain" src={productImage(url, 64)} alt="" width="64" height="64" loading="lazy" decoding="async" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default ProductGallery;
