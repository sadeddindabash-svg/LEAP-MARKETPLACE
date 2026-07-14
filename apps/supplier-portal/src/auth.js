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
