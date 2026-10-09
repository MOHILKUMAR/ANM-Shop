// Product photos uploaded by admins are stored on Cloudinary at full size. Asking Cloudinary for
// f_auto (WebP or AVIF when the browser supports it), q_auto (a quality it picks), and the width
// the image is shown at turns a multi-megabyte photo into a few dozen kilobytes.
// `width` is in CSS pixels; twice that is requested so photos stay sharp on high-density screens.
// Other image URLs (like the placeholder catalogue images) are returned unchanged.
const UPLOAD_PATH = "/image/upload/";

export function productImage(url, width) {
  if (typeof url !== "string" || !url.startsWith("https://res.cloudinary.com/")) return url;
  const at = url.indexOf(UPLOAD_PATH);
  if (at === -1 || url.includes("/f_auto")) return url;
  const insertAt = at + UPLOAD_PATH.length;
  return `${url.slice(0, insertAt)}f_auto,q_auto,c_limit,w_${Math.round(width * 2)}/${url.slice(insertAt)}`;
}
