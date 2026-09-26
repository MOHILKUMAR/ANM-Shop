// In development the Vite proxy forwards "/api" to the backend (see vite.config.js).
// In production set VITE_API_URL to the deployed backend, e.g. https://api.example.com/api
const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";
const SERVER_DOWN_MESSAGE = "Cannot reach the server. Please make sure the backend is running and try again.";

export async function apiRequest(path, { token, headers = {}, ...options } = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    });
  } catch {
    const error = new Error(SERVER_DOWN_MESSAGE);
    error.status = 0;
    throw error;
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const fallback = response.status >= 500 && !data
      ? SERVER_DOWN_MESSAGE
      : "The request could not be completed.";
    const error = new Error(data?.message || fallback);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}
