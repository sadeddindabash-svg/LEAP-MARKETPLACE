// Points at services/api. Override at build time with
// VITE_API_BASE_URL=https://your-deployed-api npm run build
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const TOKEN_STORAGE_KEY = "leap_supplier_token";

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

// ---------------- Supplier-facing endpoints (SUP-001–022) ----------------

export function fetchMySupplierProfile(token) {
  return authedGet("/supplier/me", token);
}

export function fetchMyProducts(token) {
  return authedGet("/supplier/me/products", token);
}

export function createProduct(token, product) {
  return authedMutate("POST", "/supplier/me/products", token, product);
}

// ---------------- Structured fitment cascade (Brand -> Model -> Generation -> Engine/Transmission) ----------------

export async function fetchBrands() {
  const response = await fetch(`${API_BASE_URL}/fitment/brands`);
  if (!response.ok) throw new Error(`Failed to load brands (${response.status})`);
  return response.json();
}

export async function fetchModelsForBrand(brandId) {
  const response = await fetch(`${API_BASE_URL}/fitment/brands/${brandId}/models`);
  if (!response.ok) throw new Error(`Failed to load models (${response.status})`);
  return response.json();
}

export async function fetchGenerationsForModel(modelId) {
  const response = await fetch(`${API_BASE_URL}/fitment/models/${modelId}/generations`);
  if (!response.ok) throw new Error(`Failed to load generations (${response.status})`);
  return response.json();
}

export async function fetchEnginesForGeneration(generationId) {
  const response = await fetch(`${API_BASE_URL}/fitment/generations/${generationId}/engines`);
  if (!response.ok) throw new Error(`Failed to load engines (${response.status})`);
  return response.json();
}

export async function fetchTransmissionsForGeneration(generationId) {
  const response = await fetch(`${API_BASE_URL}/fitment/generations/${generationId}/transmissions`);
  if (!response.ok) throw new Error(`Failed to load transmissions (${response.status})`);
  return response.json();
}

// ---------------- Product image upload ----------------
// Real upload to the backend's local-disk storage (see
// services/api/src/modules/uploads/routes.js for the honest note about
// why it's local disk, not real object storage, for now).

export async function uploadProductImage(token, file) {
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

export function updateProduct(token, productId, updates) {
  return authedMutate("PATCH", `/supplier/me/products/${productId}`, token, updates);
}

// Real bulk price update (new) -- closes a real gap: there was no way
// to adjust multiple real products' prices at once before this, only
// one at a time via EditProductModal above.
export function bulkUpdateProductPrices(token, productIds, adjustmentType, adjustmentValue) {
  return authedMutate("PATCH", "/supplier/me/products/bulk-price-update", token, { productIds, adjustmentType, adjustmentValue });
}

export function fetchMyOrders(token) {
  return authedGet("/supplier/me/orders", token);
}

export function fetchMyOverview(token) {
  return authedGet("/supplier/me/overview", token);
}

export function updateSubOrder(token, subOrderId, updates) {
  return authedMutate("PATCH", `/supplier/me/orders/${subOrderId}`, token, updates);
}

export function fetchMyReturnCases(token) {
  return authedGet("/returns/supplier/me", token);
}

export function fetchMyReturnCaseById(token, caseId) {
  return authedGet(`/returns/supplier/me/${caseId}`, token);
}

export function replyToReturnCase(token, caseId, message) {
  return authedMutate("POST", `/returns/supplier/me/${caseId}/messages`, token, { message });
}

// ---------------- Real category + part reference lists (new) ----------------
// A supplier now picks a real Part from a real list scoped to the
// Category they picked, per the confirmed requirement, rather than
// typing free text — these are public (no auth) since the mobile app
// reads them too.

export async function fetchCategories() {
  const response = await fetch(`${API_BASE_URL}/catalog/categories`);
  if (!response.ok) throw new Error(`Failed to load categories (${response.status})`);
  return response.json();
}

export async function fetchPartsForCategory(categoryId) {
  const response = await fetch(`${API_BASE_URL}/catalog/categories/${categoryId}/parts`);
  if (!response.ok) throw new Error(`Failed to load parts (${response.status})`);
  return response.json();
}

// ---------------- Real supplier <-> platform messaging (new) ----------------
// Bidirectional auto-translation (Chinese <-> English) -- see
// services/api/src/modules/supplier-messages/translate.js for the full
// honest state of the translation integration itself.

export function fetchMyMessages(token) {
  return authedGet("/supplier-messages/me", token);
}

// Real supplier payout method (migration 034).
export function fetchMyPayoutMethod(token) {
  return authedGet("/supplier/me/payout-method", token);
}

export function updateMyPayoutMethod(token, { bankName, accountNumber, accountHolderName }) {
  return authedMutate("PUT", "/supplier/me/payout-method", token, { bankName, accountNumber, accountHolderName });
}

export function sendMyMessage(token, text) {
  return authedMutate("POST", "/supplier-messages/me", token, { text });
}

// ---------------- Real notifications (new) ----------------
// Triggered by real order changes and message/ticket replies -- see
// services/api/src/modules/notifications/ for the 4 real trigger
// points. The SAME real endpoints the buyer mobile app uses -- a
// supplier is a real user (role='supplier'), scoped to their own
// req.user.sub the same way, no separate backend needed.

export function fetchMyNotifications(token) {
  return authedGet("/notifications/me", token);
}

export async function fetchUnreadNotificationCount(token) {
  const data = await authedGet("/notifications/me/unread-count", token);
  return data.count;
}

export function markNotificationRead(token, id) {
  return authedMutate("PATCH", `/notifications/me/${id}/read`, token, {});
}

// authedMutate always parses the response as JSON, but this real
// endpoint returns 204 No Content (an empty body) -- calling
// response.json() on that would throw. A dedicated function, not
// authedMutate, matching how a 204 is handled elsewhere in this project.
export async function markAllNotificationsRead(token) {
  const response = await fetch(`${API_BASE_URL}/notifications/me/read-all`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  if (response.status !== 204) throw new Error(`Request failed (${response.status})`);
}

// ---------------- Real bulk product import (new) ----------------
// See services/api/src/modules/supplier/routes.js for the full real
// backend design.

export async function bulkImportProducts(token, payload) {
  const response = await fetch(`${API_BASE_URL}/supplier/me/products/bulk-import`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

export async function fetchMyDrafts(token) {
  const response = await fetch(`${API_BASE_URL}/supplier/me/products/drafts`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  if (!response.ok) throw new Error(`Failed to load drafts (${response.status})`);
  return response.json();
}

export async function completeDraftProduct(token, productId, payload) {
  const response = await fetch(`${API_BASE_URL}/supplier/me/products/${productId}/complete`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}
