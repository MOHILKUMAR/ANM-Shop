import { useSyncExternalStore } from "react";
import { apiRequest } from "./api.js";

// The shop's categories ({ name, description, icon }) in display order, loaded once and shared
// by every page. refreshCategories() reloads them after an admin changes one.
let state = { categories: [], loading: true, error: "" };
let loaded = false;
// The newest request; answers to older ones are ignored.
let latest = null;
const listeners = new Set();

function publish(next) {
  state = next;
  listeners.forEach((listener) => listener());
}

function load() {
  const request = apiRequest("/categories");
  latest = request;
  request
    .then(
      (list) => {
        if (request !== latest) return;
        loaded = true;
        publish({ categories: Array.isArray(list) ? list : [], loading: false, error: "" });
      },
      (error) => {
        // Keep showing the list we had.
        if (request === latest) publish({ ...state, loading: false, error: error.message });
      },
    )
    .finally(() => {
      if (latest === request) latest = null;
    });
  return request;
}

// Always asks again: a request already in flight may have been answered before the change.
export function refreshCategories() {
  return load().then(() => state.categories, () => state.categories);
}

function subscribe(listener) {
  listeners.add(listener);
  if (!loaded && !latest) load().catch(() => {});
  return () => listeners.delete(listener);
}

const getSnapshot = () => state;

export function useCategories() {
  return useSyncExternalStore(subscribe, getSnapshot);
}
