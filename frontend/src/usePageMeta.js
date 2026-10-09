import { useEffect } from "react";

const SITE_NAME = "ANM-Shop";
export const DEFAULT_TITLE = "ANM-Shop – Skincare, Makeup & Haircare Online in India";
export const DEFAULT_DESCRIPTION = "Shop skincare, makeup, haircare, and body essentials at ANM-Shop. Secure Razorpay checkout, free shipping on orders above ₹499, and easy returns.";
const DEFAULT_IMAGE = "/og-image.png";

// Updates a tag from index.html in place, or adds it (and returns a function that removes it).
function setHeadTag(tag, match, attribute, value) {
  const selector = `${tag}[${match[0]}="${match[1]}"]`;
  let element = document.head.querySelector(selector);
  const added = !element;
  if (added) {
    element = document.createElement(tag);
    element.setAttribute(match[0], match[1]);
    document.head.appendChild(element);
  }
  element.setAttribute(attribute, value);
  return added ? () => element.remove() : () => {};
}

// Sets the browser title, search description, and link-preview tags for the current page.
// `title` is the page's own name ("Skincare"), shown as "Skincare | ANM-Shop"; leave it out
// for the home page. Private pages (cart, account, admin…) pass `noindex`.
export function usePageMeta({ title, description = DEFAULT_DESCRIPTION, image = DEFAULT_IMAGE, path, noindex = false }) {
  useEffect(() => {
    const fullTitle = title ? `${title} | ${SITE_NAME}` : DEFAULT_TITLE;
    const url = new URL(path ?? window.location.pathname, window.location.origin).href;
    const imageUrl = new URL(image, window.location.origin).href;
    const text = description.replace(/\s+/g, " ").trim().slice(0, 160);

    document.title = fullTitle;
    const cleanups = [
      setHeadTag("meta", ["name", "description"], "content", text),
      setHeadTag("link", ["rel", "canonical"], "href", url),
      setHeadTag("meta", ["property", "og:title"], "content", fullTitle),
      setHeadTag("meta", ["property", "og:description"], "content", text),
      setHeadTag("meta", ["property", "og:url"], "content", url),
      setHeadTag("meta", ["property", "og:image"], "content", imageUrl),
      setHeadTag("meta", ["name", "twitter:title"], "content", fullTitle),
      setHeadTag("meta", ["name", "twitter:description"], "content", text),
      setHeadTag("meta", ["name", "twitter:image"], "content", imageUrl),
    ];
    if (noindex) cleanups.push(setHeadTag("meta", ["name", "robots"], "content", "noindex"));
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [title, description, image, path, noindex]);
}
