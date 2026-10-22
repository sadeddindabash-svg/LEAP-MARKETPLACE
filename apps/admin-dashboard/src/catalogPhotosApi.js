import { API_BASE_URL, SessionExpiredError } from "./auth";

// Categories > Photos (see services/api/src/modules/catalogPhotos/routes.js).
const BASE = `${API_BASE_URL}/catalog/admin/photos`;
async function answer(response) {
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}
const headers = (token, json) => ({ Authorization: `Bearer ${token}`, ...(json ? { "Content-Type": "application/json" } : {}) });
/** { sections, parts, totals, fallback } */
export const fetchCoverage = (token) => fetch(`${BASE}/coverage`, { headers: headers(token) }).then(answer);
export const fetchBatches = (token) => fetch(`${BASE}/batches`, { headers: headers(token) }).then(answer);
export const undoBatch = (token, id) => fetch(`${BASE}/batches/${encodeURIComponent(id)}/undo`, { method: "POST", headers: headers(token) }).then(answer);
export const saveFallback = (token, on) => fetch(`${BASE}/settings`, { method: "PUT", headers: headers(token, true), body: JSON.stringify({ fallback: on }) }).then(answer);
/** files: [{ name: "BRK-001.jpg", blob }] */
export function uploadPhotos(token, batchId, files, replace) {
  const form = new FormData(); form.append("batchId", batchId); if (replace) form.append("replace", "1");
  for (const f of files) form.append("images", f.blob, f.name);
  return fetch(`${BASE}/import`, { method: "POST", headers: headers(token), body: form }).then(answer);
}
/** The shot list as a file to save. */
export async function downloadShotList(token, missingOnly) {
  const response = await fetch(`${BASE}/shot-list.xlsx${missingOnly ? "?missingOnly=1" : ""}`, { headers: headers(token) });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || `Request failed (${response.status})`);
  const url = URL.createObjectURL(await response.blob()); const a = document.createElement("a");
  a.href = url; a.download = `Leap_Catalog_Shot_List${missingOnly ? "_missing" : ""}.xlsx`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
