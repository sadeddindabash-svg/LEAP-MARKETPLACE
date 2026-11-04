import { API_BASE_URL, SessionExpiredError } from "./auth";

// Financial -> Profits (services/api: GET /profits?period=day|week|month|quarter|year&date=YYYY-MM-DD; see services/api/src/modules/profits/service.js).
export async function fetchProfits(token, period, date) {
  const query = new URLSearchParams({ period, ...(date ? { date } : {}) });
  const response = await fetch(`${API_BASE_URL}/profits?${query}`, { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

/** The day `steps` periods away from `day` (YYYY-MM-DD): the arrows step a whole period (a week = 7 days, a quarter = 3 months). */
export function shiftDate(day, period, steps) {
  const d = new Date(`${day}T00:00:00Z`);
  if (period === "day") d.setUTCDate(d.getUTCDate() + steps);
  else if (period === "week") d.setUTCDate(d.getUTCDate() + 7 * steps);
  else { d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + steps * (period === "quarter" ? 3 : period === "year" ? 12 : 1)); }
  return d.toISOString().slice(0, 10);
}

export const money = (n) => `${n < 0 ? "−" : ""}$${Math.abs(Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const moneyShort = (n) => `${n < 0 ? "−" : ""}$${Math.abs(Number(n) || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
