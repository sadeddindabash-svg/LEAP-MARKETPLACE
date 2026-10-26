import { API_BASE_URL, SessionExpiredError } from "./auth";

// The home page banner (see services/api/src/modules/platform-settings/homeBanner.js). Every call returns what the server now stores: { mode, slides, limits } (and the slide that was changed, when there is one).
const BASE = `${API_BASE_URL}/platform-settings/home-banner`;
async function answer(response) {
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}
const json = (method, token, path, body) => fetch(`${BASE}${path}`, { method, headers: { Authorization: `Bearer ${token}`, ...(body !== undefined ? { "Content-Type": "application/json" } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined }).then(answer);

export const fetchBannerAdmin = (token) => json("GET", token, "/admin");
export const setBannerMode = (token, mode) => json("PUT", token, "/mode", { mode });
export const addBannerSlide = (token, fields = {}) => json("POST", token, "/slides", fields);
export const saveBannerSlide = (token, id, fields) => json("PUT", token, `/slides/${encodeURIComponent(id)}`, fields);
export const removeBannerSlide = (token, id) => json("DELETE", token, `/slides/${encodeURIComponent(id)}`);
export const reorderBannerSlides = (token, ids) => json("PUT", token, "/order", { ids });
/** Sends the cropped 1250 x 500 photo (a Blob) for one language ("en" or "ar") of one slide. */
export async function uploadBannerPhoto(token, id, lang, blob) {
  const form = new FormData();
  form.append("image", blob, `banner-${lang}.jpg`);
  return answer(await fetch(`${BASE}/slides/${encodeURIComponent(id)}/image/${lang}`, { method: "PUT", headers: { Authorization: `Bearer ${token}` }, body: form }));
}
export const removeBannerPhoto = (token, id, lang) => json("DELETE", token, `/slides/${encodeURIComponent(id)}/image/${lang}`);
