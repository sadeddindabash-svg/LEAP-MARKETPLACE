import { API_BASE_URL, SessionExpiredError } from "./auth";

// The four pictures of the home page tiles (see services/api/src/modules/platform-settings/homePictures.js).
export const SLOTS = ["parts", "brands", "models", "countries"];

async function answer(response) {
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}
export async function fetchHomePictures() {
  return (await answer(await fetch(`${API_BASE_URL}/platform-settings/home-pictures`))).pictures;
}
/** Sends the cropped 600 x 600 picture (a Blob) for one slot. Returns { slot, url, pictures }. */
export async function uploadHomePicture(token, slot, blob) {
  const form = new FormData();
  form.append("image", blob, `${slot}.jpg`);
  return answer(await fetch(`${API_BASE_URL}/platform-settings/home-pictures/${slot}`, { method: "PUT", headers: { Authorization: `Bearer ${token}` }, body: form }));
}
export async function removeHomePicture(token, slot) {
  return answer(await fetch(`${API_BASE_URL}/platform-settings/home-pictures/${slot}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }));
}
/** A stored picture address as the browser needs it (the server keeps "/uploads/..", cloud pictures are full addresses). */
export const pictureSrc = (url) => (!url ? null : /^https?:\/\//.test(url) ? url : `${API_BASE_URL}${url}`);
