import { API_BASE_URL, SessionExpiredError } from "./auth";

// The storefront footer (see services/api/src/modules/platform-settings/footer.js): its texts, its social media icons and the six pages.
export const PAGE_KEYS = ["about", "terms", "delivery", "refund", "privacy", "cancellation"];
export const PAGE_NAMES = { about: "About us", terms: "Terms & Conditions", delivery: "Delivery & Shipping", refund: "Refund", privacy: "Privacy Policy", cancellation: "Cancellation" };
async function answer(response) {
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}
const send = (token, method, path, body) => fetch(`${API_BASE_URL}/platform-settings/footer${path}`, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body) }).then(answer);
/** { text, social, pages: { about: true|false, ... }, slugs } */
export const fetchFooter = () => fetch(`${API_BASE_URL}/platform-settings/footer`).then(answer);
export const saveFooterText = (token, text) => send(token, "PUT", "/text", text);
/** items: [{ id?, name, url }] in the order to show; returns { social } with an id for every item. */
export const saveSocial = (token, items) => send(token, "PUT", "/social", { items });
export const removeSocialIcon = (token, id) => send(token, "DELETE", `/social/${id}/icon`);
export async function uploadSocialIcon(token, id, blob) {
  const form = new FormData(); form.append("image", blob, "icon.png");
  return fetch(`${API_BASE_URL}/platform-settings/footer/social/${id}/icon`, { method: "PUT", headers: { Authorization: `Bearer ${token}` }, body: form }).then(answer);
}
/** { key, slug, title: {en, ar}, body: {en, ar}, updatedAt, hasContent } */
export const fetchPage = (key) => fetch(`${API_BASE_URL}/platform-settings/footer/pages/${key}`).then(answer);
export const savePage = (token, key, page) => send(token, "PUT", `/pages/${key}`, page);
