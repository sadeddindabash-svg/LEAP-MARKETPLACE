// Points at services/api. Override at build time with
// VITE_API_BASE_URL=https://your-deployed-api npm run build
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const TOKEN_STORAGE_KEY = "leap_hub_token";

export function saveToken(token) {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}
export function getStoredToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export class SessionExpiredError extends Error {}

export async function login(email, password) {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Login failed");
  return data; // { token, user }
}

export async function getCurrentUser(token) {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Session expired or invalid");
  return response.json();
}

async function authedGet(path, token) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

async function authedMutate(method, path, token, body) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

// ---------------- Hub staff endpoints (SUP/ADM new — inspection hubs) ----------------

export function fetchMyShipments(token) {
  return authedGet("/hub/me/shipments", token);
}

export function fetchMyShipmentById(token, shipmentId) {
  return authedGet(`/hub/me/shipments/${shipmentId}`, token);
}

export function recordShipmentEvent(token, shipmentId, { step, notes, photos, trackingNumber }) {
  return authedMutate("POST", `/hub/me/shipments/${shipmentId}/events`, token, { step, notes, photos, trackingNumber });
}

// ---------------- Evidence photo upload ----------------
// Real upload to the backend's local-disk storage — same endpoint and
// honest limitation as the supplier portal's product photos (see
// services/api/src/modules/uploads/routes.js).

export async function uploadEvidencePhoto(token, file) {
  const formData = new FormData();
  formData.append("image", file);
  const response = await fetch(`${API_BASE_URL}/uploads/product-image`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Upload failed (${response.status})`);
  return data; // { url, width, height }
}
