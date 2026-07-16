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
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

export const createBrand = (token, name) => fitmentMutate("POST", "/fitment/brands", token, { name });
export const deleteBrand = (token, id) => fitmentMutate("DELETE", `/fitment/brands/${id}`, token);
export const createModel = (token, brandId, name) => fitmentMutate("POST", `/fitment/brands/${brandId}/models`, token, { name });
export const deleteModel = (token, id) => fitmentMutate("DELETE", `/fitment/models/${id}`, token);
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

export async function fetchFxRate(token) {
  const response = await fetch(`${API_BASE_URL}/pricing/fx-rate`, { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  if (!response.ok) throw new Error(`Failed to load FX rate (${response.status})`);
  return response.json();
}

export const updateFxRate = (token, pair, rate) => fitmentMutate("PATCH", "/pricing/fx-rate", token, { pair, rate });

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

export async function createCategory(token, id, nameEn, nameAr, sortOrder) {
  const response = await fetch(`${API_BASE_URL}/catalog/categories`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ id, nameEn, nameAr, sortOrder }),
  });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
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

export async function createPart(token, categoryId, nameEn, nameAr, sortOrder) {
  const response = await fetch(`${API_BASE_URL}/catalog/categories/${categoryId}/parts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ nameEn, nameAr, sortOrder }),
  });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

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
