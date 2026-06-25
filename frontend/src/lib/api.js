const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "content-type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Request failed with ${response.status}`);
  }
  return payload;
}

export function createSearch(payload) {
  return request("/api/search", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function getResults(searchId) {
  return request(`/api/results/${searchId}`);
}

export function getProduct(productId) {
  return request(`/api/product/${productId}`);
}

export function getHistory() {
  return request("/api/history");
}

export function rerunAnalysis(searchId) {
  return request("/api/analyze", {
    method: "POST",
    body: JSON.stringify({ searchId })
  });
}

export { API_BASE };
