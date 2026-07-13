// Points at services/api. Override at build time with
// VITE_API_BASE_URL=https://your-deployed-api npm run build
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const TOKEN_STORAGE_KEY = "leap_admin_token";

export function saveToken(token) {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}
export function getStoredToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

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

/** Thrown when a request fails specifically because the token is missing/expired/invalid — lets callers distinguish "log in again" from other errors. */
export class SessionExpiredError extends Error {}

async function authedGet(path, token) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (response.status === 401) {
    throw new SessionExpiredError("Your session has expired. Please log in again.");
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

// Admins see every order (server-side scoping — see services/api/src/modules/order/routes.js).
export function fetchOrders(token) {
  return authedGet("/order", token);
}

export function fetchOrderById(token, orderId) {
  return authedGet(`/order/${orderId}`, token);
}

export function fetchSuppliers(token) {
  return authedGet("/supplier", token);
}

export async function verifySupplier(token, supplierId, status) {
  const response = await fetch(`${API_BASE_URL}/supplier/${supplierId}/verify`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status }),
  });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}
