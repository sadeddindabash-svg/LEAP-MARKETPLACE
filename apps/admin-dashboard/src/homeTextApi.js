import { API_BASE_URL, SessionExpiredError } from "./auth";

// The editable texts of the storefront's home page (see services/api/src/modules/platform-settings/homeText.js).
async function answer(response) {
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}
/** { text: { topBar, headline, subheadline }, fonts: [...], sizes: [...] } */
export async function fetchHomeText() {
  return answer(await fetch(`${API_BASE_URL}/platform-settings/home-text`));
}
export async function saveHomeText(token, text) {
  return answer(await fetch(`${API_BASE_URL}/platform-settings/home-text`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(text) }));
}
