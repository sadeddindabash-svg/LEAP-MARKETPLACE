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

async function authedMutate(method, path, token, body) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
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

// Real supplier detail view (new) -- closes a real gap: there was no
// way to view a single specific supplier's real profile + real
// product listings at all before this.
export function fetchSupplierById(token, supplierId) {
  return authedGet(`/supplier/${supplierId}`, token);
}

export function fetchModerationQueue(token) {
  return authedGet("/catalog/moderation-queue", token);
}

export async function moderateProduct(token, productId, action, translation = {}) {
  const response = await fetch(`${API_BASE_URL}/catalog/products/${productId}/moderate`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, nameEn: translation.nameEn, descriptionEn: translation.descriptionEn, nameAr: translation.nameAr, descriptionAr: translation.descriptionAr }),
  });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

// Real bulk approve/reject (new) -- see catalog/routes.js's real
// bulk-moderate endpoint for why bulk approve still requires a real
// reviewed translation per item, and why this is best-effort
// (per-item results) rather than all-or-nothing.
export async function bulkModerateProducts(token, items) {
  const response = await fetch(`${API_BASE_URL}/catalog/products/bulk-moderate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ items }),
  });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

export function fetchTickets(token) {
  return authedGet("/support/tickets", token);
}

export function fetchTicketById(token, ticketId) {
  return authedGet(`/support/tickets/${ticketId}`, token);
}

export async function replyToTicket(token, ticketId, message) {
  const response = await fetch(`${API_BASE_URL}/support/tickets/${ticketId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message }),
  });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

export async function updateTicketStatus(token, ticketId, status) {
  const response = await fetch(`${API_BASE_URL}/support/tickets/${ticketId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status }),
  });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

export function fetchReturnCases(token) {
  return authedGet("/returns", token);
}

export function fetchOverview(token) {
  return authedGet("/overview", token);
}

export function fetchReturnCaseById(token, caseId) {
  return authedGet(`/returns/${caseId}`, token);
}

export function replyToReturnCaseBuyer(token, caseId, message) {
  return authedMutate("POST", `/returns/${caseId}/buyer-messages`, token, { message });
}

export function replyToReturnCaseSupplier(token, caseId, message) {
  return authedMutate("POST", `/returns/${caseId}/supplier-messages`, token, { message });
}

export function updateReturnCaseStatus(token, caseId, status) {
  return authedMutate("PATCH", `/returns/${caseId}`, token, { status });
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

// ---------------- Fitment cascade management (Brand -> Model -> Generation -> Engine/Transmission) ----------------
// GETs are public (no auth needed to browse), but every write below is admin-only.

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

async function fitmentMutate(method, path, token, body) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  if (response.status === 204) return null;
  const data = await response.json();
  if (!response.ok) throw new Error(data.debugMessage || data.error || `Request failed (${response.status})`);
  return data;
}

export const createBrand = (token, name, nameAr, photoUrl) => fitmentMutate("POST", "/fitment/brands", token, { name, nameAr, photoUrl });
export const deleteBrand = (token, id) => fitmentMutate("DELETE", `/fitment/brands/${id}`, token);
export const createModel = (token, brandId, name, nameAr, photoUrl) => fitmentMutate("POST", `/fitment/brands/${brandId}/models`, token, { name, nameAr, photoUrl });
export const deleteModel = (token, id) => fitmentMutate("DELETE", `/fitment/models/${id}`, token);
export const updateModelPhoto = (token, id, photoUrl) => fitmentMutate("PATCH", `/fitment/models/${id}/photo`, token, { photoUrl });

// Real, new -- edit the name fields of any of the 7 levels, at any
// time. Photo/id/sortOrder are unaffected by these -- each stays on
// its own separate endpoint.
export const updateCategory = (token, id, nameEn, nameAr) => fitmentMutate("PATCH", `/catalog/categories/${id}`, token, { nameEn, nameAr });
export const updatePart = (token, id, nameEn, nameAr) => fitmentMutate("PATCH", `/catalog/parts/${id}`, token, { nameEn, nameAr });
export const updateBrand = (token, id, name, nameAr) => fitmentMutate("PATCH", `/fitment/brands/${id}`, token, { name, nameAr });
export const updateModel = (token, id, name, nameAr) => fitmentMutate("PATCH", `/fitment/models/${id}`, token, { name, nameAr });
export const updateGeneration = (token, id, name, yearStart, yearEnd) => fitmentMutate("PATCH", `/fitment/generations/${id}`, token, { name, yearStart, yearEnd });
export const updateEngine = (token, id, name) => fitmentMutate("PATCH", `/fitment/engines/${id}`, token, { name });
export const updateTransmission = (token, id, name) => fitmentMutate("PATCH", `/fitment/transmissions/${id}`, token, { name });
export const createGeneration = (token, modelId, name, yearStart, yearEnd) =>
  fitmentMutate("POST", `/fitment/models/${modelId}/generations`, token, { name, yearStart, yearEnd });
export const deleteGeneration = (token, id) => fitmentMutate("DELETE", `/fitment/generations/${id}`, token);
export const createEngine = (token, generationId, name) => fitmentMutate("POST", `/fitment/generations/${generationId}/engines`, token, { name });
export const deleteEngine = (token, id) => fitmentMutate("DELETE", `/fitment/engines/${id}`, token);
export const createTransmission = (token, generationId, name) => fitmentMutate("POST", `/fitment/generations/${generationId}/transmissions`, token, { name });
export const deleteTransmission = (token, id) => fitmentMutate("DELETE", `/fitment/transmissions/${id}`, token);

// ---------------- Inspection hubs (new — Supplier -> Hub -> Buyer) ----------------

export async function fetchHubLocations() {
  const response = await fetch(`${API_BASE_URL}/hub/locations`);
  if (!response.ok) throw new Error(`Failed to load hubs (${response.status})`);
  return response.json();
}

export const createHubLocation = (token, name, region, address) => fitmentMutate("POST", "/hub/locations", token, { name, region, address });
export const deleteHubLocation = (token, id) => fitmentMutate("DELETE", `/hub/locations/${id}`, token);
export const assignHubToSubOrder = (token, subOrderId, hubId) => fitmentMutate("PATCH", `/hub/assign/${subOrderId}`, token, { hubId });

// ---------------- Pricing engine (new — real Leap/Bank/Shipping/etc. fee equation) ----------------

export async function fetchFeeComponents(token) {
  const response = await fetch(`${API_BASE_URL}/pricing/fee-components`, { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  if (!response.ok) throw new Error(`Failed to load fee components (${response.status})`);
  return response.json();
}

export const createFeeComponent = (token, name, type, value, sortOrder) => fitmentMutate("POST", "/pricing/fee-components", token, { name, type, value, sortOrder });
export const updateFeeComponent = (token, id, updates) => fitmentMutate("PATCH", `/pricing/fee-components/${id}`, token, updates);
export const deleteFeeComponent = (token, id) => fitmentMutate("DELETE", `/pricing/fee-components/${id}`, token);
export const moveFeeComponent = (token, id, direction) => fitmentMutate("POST", `/pricing/fee-components/${id}/move`, token, { direction });

export async function fetchFxRate(token) {
  const response = await fetch(`${API_BASE_URL}/pricing/fx-rate`, { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  if (!response.ok) throw new Error(`Failed to load FX rate (${response.status})`);
  return response.json();
}

export const updateFxRate = (token, pair, rate) => fitmentMutate("PATCH", "/pricing/fx-rate", token, { pair, rate });

// Real automatic/manual FX rate mode toggle (migration 028).
export async function fetchFxRateMode(token) {
  const response = await fetch(`${API_BASE_URL}/pricing/fx-rate-mode`, { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  if (!response.ok) throw new Error(`Failed to load FX rate mode (${response.status})`);
  return response.json();
}

export const updateFxRateMode = (token, mode) => fitmentMutate("PATCH", "/pricing/fx-rate-mode", token, { mode });

export async function previewPricing(token, { supplierCostCny, weightKg, lengthCm, widthCm, heightCm }) {
  const response = await fetch(`${API_BASE_URL}/pricing/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ supplierCostCny, weightKg, lengthCm, widthCm, heightCm }),
  });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

// ---------------- Flagged shipments (new — the real answer to "where do I find a flagged issue") ----------------

export async function fetchFlaggedShipments(token) {
  const response = await fetch(`${API_BASE_URL}/hub/flagged`, { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  if (!response.ok) throw new Error(`Failed to load flagged shipments (${response.status})`);
  return response.json();
}

// ---------------- Product categories & parts (new — real reference lists a supplier picks from) ----------------

export async function fetchCategories() {
  const response = await fetch(`${API_BASE_URL}/catalog/categories`);
  if (!response.ok) throw new Error(`Failed to load categories (${response.status})`);
  return response.json();
}

export async function createCategory(token, id, nameEn, nameAr, photoUrl, sortOrder) {
  const response = await fetch(`${API_BASE_URL}/catalog/categories`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ id, nameEn, nameAr, photoUrl, sortOrder }),
  });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

// Real image upload (new) -- reuses the same shared, general-purpose
// POST /uploads/product-image endpoint suppliers/hub staff/buyers
// already use (now also admin, migration 046's own comment on the
// backend side), since the actual work (validate, save, return a URL)
// is identical regardless of what the photo is evidence of.
export async function uploadImage(token, file) {
  const formData = new FormData();
  formData.append("image", file);
  const response = await fetch(`${API_BASE_URL}/uploads/product-image`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Upload failed (${response.status})`);
  return data; // { url, width, height, storage }
}

export async function deleteCategory(token, id) {
  const response = await fetch(`${API_BASE_URL}/catalog/categories/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  if (response.status === 204) return null;
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

export async function fetchPartsForCategory(categoryId) {
  const response = await fetch(`${API_BASE_URL}/catalog/categories/${categoryId}/parts`);
  if (!response.ok) throw new Error(`Failed to load parts (${response.status})`);
  return response.json();
}

export async function createPart(token, categoryId, nameEn, nameAr, sortOrder, photoUrl) {
  const response = await fetch(`${API_BASE_URL}/catalog/categories/${categoryId}/parts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ nameEn, nameAr, sortOrder, photoUrl }),
  });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

// Real, new -- lets an admin replace a category's photo at any time,
// not just at creation.
export async function updateCategoryPhoto(token, id, photoUrl) {
  const response = await fetch(`${API_BASE_URL}/catalog/categories/${id}/photo`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ photoUrl }),
  });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

// Real, new -- same real capability as updateCategoryPhoto, for a part.
export async function updatePartPhoto(token, id, photoUrl) {
  const response = await fetch(`${API_BASE_URL}/catalog/parts/${id}/photo`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ photoUrl }),
  });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

// Real, new -- 7 reorder endpoints (categories, parts, and all 5
// vehicle data levels), plus brand photo editing. Same established
// fitmentMutate one-liner pattern already used for the proven
// fee-component move endpoint above.
export const moveCategory = (token, id, direction) => fitmentMutate("POST", `/catalog/categories/${id}/move`, token, { direction });
export const movePart = (token, id, direction) => fitmentMutate("POST", `/catalog/parts/${id}/move`, token, { direction });
export const moveBrand = (token, id, direction) => fitmentMutate("POST", `/fitment/brands/${id}/move`, token, { direction });
export const moveModel = (token, id, direction) => fitmentMutate("POST", `/fitment/models/${id}/move`, token, { direction });
export const moveGeneration = (token, id, direction) => fitmentMutate("POST", `/fitment/generations/${id}/move`, token, { direction });
export const moveEngine = (token, id, direction) => fitmentMutate("POST", `/fitment/engines/${id}/move`, token, { direction });
export const moveTransmission = (token, id, direction) => fitmentMutate("POST", `/fitment/transmissions/${id}/move`, token, { direction });
export const updateBrandPhoto = (token, id, photoUrl) => fitmentMutate("PATCH", `/fitment/brands/${id}/photo`, token, { photoUrl });

export async function deletePart(token, id) {
  const response = await fetch(`${API_BASE_URL}/catalog/parts/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  if (response.status === 204) return null;
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

// ---------------- Real supplier <-> platform messaging (new) ----------------
// Bidirectional auto-translation (Chinese <-> English) -- see
// services/api/src/modules/supplier-messages/translate.js for the full
// honest state of the translation integration itself.

export async function fetchSupplierMessagesInbox(token) {
  const response = await fetch(`${API_BASE_URL}/supplier-messages/admin`, { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  if (!response.ok) throw new Error(`Failed to load inbox (${response.status})`);
  return response.json();
}

export async function fetchSupplierMessageThread(token, supplierId) {
  const response = await fetch(`${API_BASE_URL}/supplier-messages/admin/${supplierId}`, { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  if (!response.ok) throw new Error(`Failed to load messages (${response.status})`);
  return response.json();
}

export async function sendSupplierMessage(token, supplierId, text) {
  const response = await fetch(`${API_BASE_URL}/supplier-messages/admin/${supplierId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ text }),
  });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

// ---------------- Real promo codes / promotions engine (new) ----------------
// Admin-created event/campaign codes, alongside real referral-generated
// codes -- same underlying system, see
// services/api/src/modules/promo-codes/routes.js.

export async function fetchPromoCodes(token) {
  const response = await fetch(`${API_BASE_URL}/promo-codes`, { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  if (!response.ok) throw new Error(`Failed to load promo codes (${response.status})`);
  return response.json();
}

export async function createPromoCode(token, payload) {
  const response = await fetch(`${API_BASE_URL}/promo-codes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

export async function updatePromoCode(token, code, updates) {
  const response = await fetch(`${API_BASE_URL}/promo-codes/${code}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(updates),
  });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

export async function deletePromoCode(token, code) {
  const response = await fetch(`${API_BASE_URL}/promo-codes/${code}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  if (response.status === 204) return null;
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

// ---------------- Real admin team & permissions (new, owner-only) ----------------
// See services/api/src/modules/admin-users/routes.js for the full real
// backend implementation.

export async function fetchAdminUsers(token) {
  const response = await fetch(`${API_BASE_URL}/admin-users`, { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  if (!response.ok) throw new Error(`Failed to load admin users (${response.status})`);
  return response.json();
}

export async function createAdminUser(token, payload) {
  const response = await fetch(`${API_BASE_URL}/admin-users`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

export async function updateAdminPermissions(token, id, allowedPages) {
  const response = await fetch(`${API_BASE_URL}/admin-users/${id}/permissions`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ allowedPages }),
  });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

export async function deleteAdminUser(token, id) {
  const response = await fetch(`${API_BASE_URL}/admin-users/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  if (response.status === 204) return null;
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

// ---------------- Real payouts + return window (new) ----------------
// See services/api/src/modules/payouts/routes.js and
// services/api/src/modules/platform-settings/routes.js for the full
// real backend design.

export async function fetchPayoutsOwed(token) {
  const response = await fetch(`${API_BASE_URL}/payouts/owed`, { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  if (!response.ok) throw new Error(`Failed to load payouts owed (${response.status})`);
  return response.json();
}

// Real supplier payout method (migration 034) -- shown alongside the
// amount owed so an admin can actually see (or confirm the real
// absence of) where the money is supposed to go.
export async function fetchSupplierPayoutMethod(token, supplierId) {
  const response = await fetch(`${API_BASE_URL}/supplier/${supplierId}/payout-method`, { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  if (!response.ok) throw new Error(`Failed to load payout method (${response.status})`);
  return response.json();
}

export async function fetchPayoutHistory(token) {
  const response = await fetch(`${API_BASE_URL}/payouts`, { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  if (!response.ok) throw new Error(`Failed to load payout history (${response.status})`);
  return response.json();
}

export async function recordPayout(token, supplierId, notes) {
  const response = await fetch(`${API_BASE_URL}/payouts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ supplierId, notes }),
  });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

export async function fetchReturnWindow(token) {
  const response = await fetch(`${API_BASE_URL}/platform-settings/return-window`, { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  if (!response.ok) throw new Error(`Failed to load return window (${response.status})`);
  return response.json();
}

export async function updateReturnWindow(token, returnWindowDays) {
  const response = await fetch(`${API_BASE_URL}/platform-settings/return-window`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ returnWindowDays }),
  });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

export async function fetchReceiptFooter(token) {
  const response = await fetch(`${API_BASE_URL}/platform-settings/receipt-footer`, { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  if (!response.ok) throw new Error(`Failed to load receipt footer (${response.status})`);
  return response.json();
}

export async function updateReceiptFooter(token, footerNoteEn, footerNoteAr) {
  const response = await fetch(`${API_BASE_URL}/platform-settings/receipt-footer`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ footerNoteEn, footerNoteAr }),
  });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

// Real "send test email" (new) -- lets an admin verify real SMTP
// configuration works without waiting for a real customer event
// (order, shipment, payout) to trigger a real transactional email
// first.
export async function sendTestEmail(token) {
  const response = await fetch(`${API_BASE_URL}/platform-settings/test-email`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

export async function updateCategoryCommission(token, categoryId, commissionPercent) {
  const response = await fetch(`${API_BASE_URL}/catalog/categories/${categoryId}/commission`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ commissionPercent }),
  });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

// ---------------- Real product reviews (new) ----------------
// See services/api/src/modules/reviews/routes.js for the full real
// backend design.

export async function fetchPendingReviews(token) {
  const response = await fetch(`${API_BASE_URL}/reviews/pending`, { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  if (!response.ok) throw new Error(`Failed to load pending reviews (${response.status})`);
  return response.json();
}

export async function moderateReview(token, reviewId, action) {
  const response = await fetch(`${API_BASE_URL}/reviews/${reviewId}/moderate`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action }),
  });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

// Real review flagging/reporting (migration 033).
export async function fetchFlaggedReviews(token) {
  const response = await fetch(`${API_BASE_URL}/reviews/flagged`, { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  if (!response.ok) throw new Error(`Failed to load flagged reviews (${response.status})`);
  return response.json();
}

export async function dismissReviewFlags(token, reviewId) {
  const response = await fetch(`${API_BASE_URL}/reviews/${reviewId}/dismiss-flags`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

export async function fetchRequireVerifiedPurchase(token) {
  const response = await fetch(`${API_BASE_URL}/platform-settings/require-verified-purchase-for-reviews`, { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  if (!response.ok) throw new Error(`Failed to load setting (${response.status})`);
  return response.json();
}

export async function updateRequireVerifiedPurchase(token, requireVerifiedPurchase) {
  const response = await fetch(`${API_BASE_URL}/platform-settings/require-verified-purchase-for-reviews`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ requireVerifiedPurchase }),
  });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

// Real audit log of admin actions (migration 036) -- owner-only.
export async function fetchAuditLog(token, { action, startDate, endDate } = {}) {
  const params = new URLSearchParams();
  if (action) params.set('action', action);
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);
  const qs = params.toString();
  const response = await fetch(`${API_BASE_URL}/admin/audit-log${qs ? `?${qs}` : ''}`, { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  if (!response.ok) throw new Error(`Failed to load audit log (${response.status})`);
  return response.json();
}

// Real supplier analytics -- an admin picks any one real supplier to
// view (confirmed scope: not a platform-wide aggregate).
export async function fetchSupplierAnalytics(token, supplierId) {
  const response = await fetch(`${API_BASE_URL}/supplier/${supplierId}/analytics`, { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Failed to load supplier analytics (${response.status})`);
  }
  return response.json();
}

// Real hub workload/capacity dashboard (migration 042).
export async function fetchHubWorkload(token) {
  const response = await fetch(`${API_BASE_URL}/hub/workload`, { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Failed to load hub workload (${response.status})`);
  }
  return response.json();
}

export async function updateHubCapacity(token, hubId, dailyCapacity) {
  const response = await fetch(`${API_BASE_URL}/hub/locations/${hubId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ dailyCapacity }),
  });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Failed to update capacity (${response.status})`);
  return data;
}

// Real hub performance metrics -- average time per stage transition.
export async function fetchHubPerformance(token) {
  const response = await fetch(`${API_BASE_URL}/hub/performance`, { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Failed to load hub performance (${response.status})`);
  }
  return response.json();
}

// ---------------- Real global search (new — closes a real gap: the TopBar's search box was 100% decorative before this) ----------------

export async function searchAdmin(token, query) {
  const response = await fetch(`${API_BASE_URL}/admin/search?q=${encodeURIComponent(query)}`, { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  if (!response.ok) throw new Error(`Search failed (${response.status})`);
  return response.json();
}

// Real, new -- payment methods, per-country activation. All reuse the
// same real fitmentMutate helper already used for categories/fitment.
export const fetchPaymentMethods = (token) => fitmentMutate("GET", "/payment-methods", token);
export const fetchAvailableCountries = (token) => fitmentMutate("GET", "/payment-methods/available-countries", token);
export const fetchAvailableProviders = (token) => fitmentMutate("GET", "/payment-methods/available-providers", token);
export const createPaymentMethod = (token, nameEn, nameAr, photoUrl, providerId) => fitmentMutate("POST", "/payment-methods", token, { nameEn, nameAr, photoUrl, providerId });
export const updatePaymentMethod = (token, id, nameEn, nameAr, providerId) => fitmentMutate("PATCH", `/payment-methods/${id}`, token, { nameEn, nameAr, providerId });
export const updatePaymentMethodPhoto = (token, id, photoUrl) => fitmentMutate("PATCH", `/payment-methods/${id}/photo`, token, { photoUrl });
export const movePaymentMethod = (token, id, direction) => fitmentMutate("POST", `/payment-methods/${id}/move`, token, { direction });
export const activatePaymentMethodCountry = (token, id, countryCode) => fitmentMutate("POST", `/payment-methods/${id}/countries/${countryCode}`, token);
export const deactivatePaymentMethodCountry = (token, id, countryCode) => fitmentMutate("DELETE", `/payment-methods/${id}/countries/${countryCode}`, token);
export const deletePaymentMethod = (token, id) => fitmentMutate("DELETE", `/payment-methods/${id}`, token);
export const setPaymentMethodActive = (token, id, isActive) => fitmentMutate("PATCH", `/payment-methods/${id}/active`, token, { isActive });
export const bulkSetPaymentMethodCountries = (token, id, action) => fitmentMutate("POST", `/payment-methods/${id}/countries-bulk`, token, { action });

// Real, new -- payment provider credentials (the real "set up page"
// system, separate from payment_methods' own display/catalog layer).
export const fetchPaymentProviders = (token) => fitmentMutate("GET", "/payment-providers", token);
export const savePaymentProviderCredentials = (token, providerId, values) => fitmentMutate("PUT", `/payment-providers/${providerId}`, token, values);
export const deletePaymentProviderCredentials = (token, providerId) => fitmentMutate("DELETE", `/payment-providers/${providerId}`, token);
