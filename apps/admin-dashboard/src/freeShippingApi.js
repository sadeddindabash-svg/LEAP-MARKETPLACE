import { API_BASE_URL, SessionExpiredError } from "./auth";

// The free-shipping limit and the fee below it (see services/api/src/modules/platform-settings/freeShipping.js). Every call returns what the server now stores: { enabled, thresholdUsd, feeUsd, limits }.
const BASE = `${API_BASE_URL}/platform-settings/free-shipping`;
async function answer(response) {
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

export const fetchFreeShippingAdmin = (token) => fetch(`${BASE}/admin`, { headers: { Authorization: `Bearer ${token}` } }).then(answer);
/** Saves { enabled, thresholdUsd, feeUsd } (numbers, in US dollars). The server checks them again and says what is wrong in plain words. */
export const saveFreeShipping = (token, { enabled, thresholdUsd, feeUsd }) =>
  fetch(BASE, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ enabled, thresholdUsd, feeUsd }) }).then(answer);
