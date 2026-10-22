// The server calls of the parts catalog screens (the server's modules/catalogImport, mounted at /catalog/admin): the Excel import, the health summary, undo, and editing every field of a
// category or a part. A refusal that comes with a full explanation (the file has problems) carries it in `error.payload`.
import { API_BASE_URL, SessionExpiredError } from "./auth";

const BASE = `${API_BASE_URL}/catalog/admin`;
const EXPIRED = "Your session has expired. Please log in again.";

async function call(method, path, token, body) {
  const response = await fetch(`${BASE}${path}`, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  if (response.status === 401) throw new SessionExpiredError(EXPIRED);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(data.error || `Request failed (${response.status})`); error.payload = data; throw error; }
  return data;
}
async function sendImport(path, token, file, mode, replace = null) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("mode", mode);
  if (replace && replace.on) {                                  // "make the catalog exactly this sheet" (the server asks for the typed sentence again)
    formData.append("removeOthers", "1"); formData.append("alsoProducts", replace.alsoProducts ? "1" : "0"); formData.append("confirm", replace.confirm || "");
  }
  const response = await fetch(`${BASE}/import/${path}`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData });
  if (response.status === 401) throw new SessionExpiredError(EXPIRED);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(data.error || `Request failed (${response.status})`); error.payload = data; throw error; }
  return data;
}

export const previewCatalogImport = (token, file, mode = "skip", replace = null) => sendImport("preview", token, file, mode, replace);
export const commitCatalogImport = (token, file, mode = "skip", replace = null) => sendImport("commit", token, file, mode, replace);
export async function downloadCatalogTemplate(token) {
  const response = await fetch(`${BASE}/import/template`, { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 401) throw new SessionExpiredError(EXPIRED);
  if (!response.ok) throw new Error(`Could not download the template (${response.status})`);
  return response.blob();
}
export const fetchCatalogHealth = (token) => call("GET", "/health", token);
export const fetchCatalogBatches = (token) => call("GET", "/import/batches", token);
export const undoCatalogBatch = (token, id) => call("POST", `/import/batches/${encodeURIComponent(id)}/undo`, token);
export const fetchAdminCategories = (token) => call("GET", "/categories", token);
export const fetchAdminParts = (token, categoryId) => call("GET", `/categories/${encodeURIComponent(categoryId)}/parts`, token);
export const editCategoryDetails = (token, id, fields) => call("PATCH", `/categories/${encodeURIComponent(id)}`, token, fields);
export const editPartDetails = (token, id, fields) => call("PATCH", `/parts/${encodeURIComponent(id)}`, token, fields);
export const reviewPartSizes = (token, ids) => call("POST", "/parts/review", token, { ids });
export const previewCatalogCleanup = (token, alsoProducts) => call("GET", `/cleanup/preview${alsoProducts ? "?alsoProducts=1" : ""}`, token);
export const commitCatalogCleanup = (token, fields) => call("POST", "/cleanup/commit", token, fields);
