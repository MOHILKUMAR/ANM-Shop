import { useEffect, useState } from "react";
import { apiRequest } from "./api.js";

// The shop's categories ({ name, description, icon }) in display order, loaded once and shared
// by every page. refreshCategories() reloads them after an admin changes one.
let cached = null;
let pending = null;
const listeners = new Set();

function load() {
  pending ??= apiRequest("/categories")
    .then((list) => {
      cached = Array.isArray(list) ? list : [];
      listeners.forEach((listener) => listener({ categories: cached, loading: false, error: "" }));
      return cached;
    })
    .catch((error) => {
      listeners.forEach((listener) => listener({ categories: cached || [], loading: false, error: error.message }));
      throw error;
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}

export function refreshCategories() {
  cached = null;
  return load().catch(() => []);
}

export function useCategories() {
  const [state, setState] = useState(() => ({ categories: cached || [], loading: !cached, error: "" }));

  useEffect(() => {
    listeners.add(setState);
    if (!cached) load().catch(() => {});
    return () => listeners.delete(setState);
  }, []);

  return state;
}
