import { productImage } from "../imageUrl.js";

export const MAX_PHOTOS = 6;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // the server's upload limit per photo
const sizeLabel = (bytes) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

// The admin product form's photos: the ones already saved (when editing) and new files to
// upload. The first photo is the main one shown on cards, in the cart and on bills.
function ProductPhotos({ kept, onKeptChange, added, onAddedChange }) {
  const total = kept.length + added.length;

  function addFiles(event) {
    const files = [...(event.target.files || [])];
    onAddedChange([...added, ...files].slice(0, MAX_PHOTOS - kept.length));
    event.target.value = ""; // so the same file can be picked again after removing it
  }

  function makeMain(index) {
    onKeptChange([kept[index], ...kept.filter((_, position) => position !== index)]);
  }

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="product-images">Photos</label>
      <p className="mb-2 text-xs text-gray-500" id="product-images-hint">
        JPEG, PNG, or WebP, up to 5 MB each. Up to {MAX_PHOTOS} photos; the first is the main one.
      </p>

      {kept.length > 0 && (
        <ul className="mb-3 grid grid-cols-3 gap-2" aria-label="Current photos">
          {kept.map((url, index) => (
            <li className="relative rounded-lg border border-gray-200 bg-gray-50 p-1" key={url}>
              <img className="h-20 w-full rounded object-contain" src={productImage(url, 96)} alt={`Photo ${index + 1}`} width="96" height="80" loading="lazy" />
              {index === 0 && <span className="absolute left-1 top-1 rounded bg-brand-700 px-1.5 py-0.5 text-[10px] font-semibold text-white">Main</span>}
              <div className="mt-1 flex justify-between gap-1 text-[11px]">
                {index > 0 ? <button className="font-semibold text-brand-700 hover:underline" type="button" onClick={() => makeMain(index)}>Make main</button> : <span />}
                <button className="font-semibold text-red-700 hover:underline" type="button" onClick={() => onKeptChange(kept.filter((_, position) => position !== index))}>Remove</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {added.length > 0 && (
        <ul className="mb-3 space-y-1 text-sm" aria-label="Photos to upload">
          {added.map((file, index) => (
            <li className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-1.5" key={`${file.name}-${index}`}>
              <span className={`truncate ${file.size > MAX_PHOTO_BYTES ? "text-red-700" : "text-gray-700"}`}>
                {kept.length === 0 && index === 0 ? "Main: " : ""}{file.name} ({sizeLabel(file.size)}{file.size > MAX_PHOTO_BYTES ? ", too large" : ""})
              </span>
              <button className="shrink-0 text-xs font-semibold text-red-700 hover:underline" type="button" onClick={() => onAddedChange(added.filter((_, position) => position !== index))}>Remove</button>
            </li>
          ))}
        </ul>
      )}

      <input
        className="w-full text-sm text-gray-600 disabled:opacity-50"
        id="product-images"
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        aria-describedby="product-images-hint"
        disabled={total >= MAX_PHOTOS}
        onChange={addFiles}
      />
      <p className="mt-1 text-xs text-gray-500">{total} of {MAX_PHOTOS} photos</p>
    </div>
  );
}

export default ProductPhotos;
