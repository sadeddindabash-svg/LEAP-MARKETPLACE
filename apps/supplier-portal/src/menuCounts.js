import { API_BASE_URL } from "./auth";

/**
 * The numbers beside Orders, Returns and Messages in the side menu (GET /supplier-counts/me). Quiet: a failed load keeps what is shown.
 * Opening Messages marks Leap's messages as read (POST /supplier-counts/me/messages-read), so its number goes away.
 */
async function call(method, url, token) {
  const res = await fetch(`${API_BASE_URL}${url}`, { method, headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`menu counts: ${res.status}`);
  return res.json();
}
export const fetchMenuCounts = (token) => call("GET", "/supplier-counts/me", token);
export const markMenuMessagesRead = (token) => call("POST", "/supplier-counts/me/messages-read", token);

/** The number (and its colour and hover text) for one menu item, or null when nothing is waiting. */
export function menuBadge(counts, id, lang) {
  if (!counts) return null;
  const zh = lang === "zh";
  let n = 0; let late = 0; let tip = "";
  if (id === "orders") {
    n = counts.orders ? counts.orders.waiting : 0;
    late = counts.orders ? counts.orders.late : 0;
    tip = zh ? `${n} 个订单待接单或发货` : `${n} to accept or ship`;
    if (late > 0) tip += zh ? ` · ${late} 个已超时` : ` · ${late} late`;
  } else if (id === "returns") {
    n = counts.returns || 0;
    tip = zh ? `${n} 个退货待处理` : `${n} ${n === 1 ? "return" : "returns"} to answer`;
  } else if (id === "messages") {
    n = counts.messages || 0;
    tip = zh ? `${n} 条来自 Leap 的新消息` : `${n} new ${n === 1 ? "message" : "messages"} from Leap`;
  } else return null;
  if (!n) return null;
  return { text: n > 99 ? "99+" : String(n), late: late > 0, tip };
}
