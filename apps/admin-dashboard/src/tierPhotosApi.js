import { API_BASE_URL, SessionExpiredError } from "./auth";

// The loyalty tiers and their photos (services/api: GET /pricing/loyalty-tiers, PUT|DELETE /loyalty-tier-photos/:id, migration 125).
async function answer(response) {
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}
/** [{ id, name, nameAr, photoUrl, ... }] in the tiers' own order. */
export async function fetchTiers() {
  const data = await answer(await fetch(`${API_BASE_URL}/pricing/loyalty-tiers`));
  const list = Array.isArray(data) ? data : data.tiers || [];
  return list.map((t) => ({ ...t, photoUrl: t.photoUrl ?? null }));
}
/** Sends the cropped 600 x 600 photo (a Blob) for one tier. Returns { id, photoUrl }. */
export async function uploadTierPhoto(token, id, blob) {
  const form = new FormData();
  form.append("image", blob, `tier-${id}.jpg`);
  return answer(await fetch(`${API_BASE_URL}/loyalty-tier-photos/${encodeURIComponent(id)}`, { method: "PUT", headers: { Authorization: `Bearer ${token}` }, body: form }));
}
export async function removeTierPhoto(token, id) {
  return answer(await fetch(`${API_BASE_URL}/loyalty-tier-photos/${encodeURIComponent(id)}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }));
}
/** A stored photo address as the browser needs it (the server keeps "/uploads/..", cloud pictures are full addresses). */
export const pictureSrc = (url) => (!url ? null : /^https?:\/\//.test(url) ? url : `${API_BASE_URL}${url}`);
