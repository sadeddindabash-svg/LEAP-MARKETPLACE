import React, { useEffect, useState } from "react";
import { fetchIncomingReturns, markReturnReceivedAtHub, getStoredToken, SessionExpiredError } from "./auth";
import { useLang } from "./langContext";
import { useHub } from "./hubContext";
import HubConversations from "./HubConversations";      // patch-returns-conversations

// Returns coming back to this hub (patch-returns-flow, migration 146): the admin approved a buyer's return and told the buyer to send the part
// here, with the return code (the case id, RC-xxxx) on the parcel. When it arrives the hub presses Received: in good condition it goes back to
// stock; damaged, it does not. A refund that waits for the part goes out by itself.
const C = { ink: "#14171C", line: "#E4E6EA", card: "#FFFFFF", canvas: "#F5F6F8", muted: "#636B78", navy: "#0B3146", navyDeep: "#07202F", navySoft: "#1F5574",
  menuSoft: "#9FB4C3", gold: "#F9B317", onGold: "#0B3146", green: "#1E9D6B", greenBg: "#E3F4EC", greenInk: "#13714B", amberBg: "#FBF0DC", amberInk: "#8A5A12", red: "#C0362C", redBg: "#FAE6E4", redInk: "#A82E25" };
const body = { fontFamily: "'Manrope', 'Noto Sans SC', sans-serif" };
const mono = { fontFamily: "'JetBrains Mono', monospace" };

export const RETURNS_TEXT = {
  zh: {
    menu: "退货与沟通", title: "退货与沟通", sub: (n) => (n ? `${n} 个退货包裹待接收` : "暂无待接收的退货包裹"),
    help: "买家会把退货寄到本质检中心，包裹上写有退货编号（RC-xxxx）。收到后请核对商品并点击“已收到”。",
    search: "输入或扫描退货编号…", waiting: "待接收", received: "最近已收到", empty: "没有待接收的退货。",
    good: "已收到 · 完好，放回库存", damaged: "已收到 · 损坏", approved: (d) => `批准于 ${d}`, receivedAt: (d) => `收到于 ${d}`,
    restocked: (n) => `完好 · 已放回库存 ${n} 件`, wasDamaged: "损坏 · 未放回库存", order: "订单", supplier: "供应商", reason: "原因",
    reasons: { wrong_part: "发错商品", damaged: "商品损坏", doesnt_fit: "不适配车辆", not_as_described: "与描述不符", other: "其他" }, error: "操作失败：",
  },
  en: {
    menu: "Returns & messages", title: "Returns & messages", sub: (n) => (n ? `${n} returned ${n === 1 ? "parcel" : "parcels"} to receive` : "No returned parcels to receive"),
    help: "Buyers send their returns to this hub with the return code (RC-xxxx) on the parcel. When one arrives, check the part and press Received.",
    search: "Type or scan the return code…", waiting: "To receive", received: "Received lately", empty: "No returns to receive.",
    good: "Received · good, back to stock", damaged: "Received · damaged", approved: (d) => `approved ${d}`, receivedAt: (d) => `received ${d}`,
    restocked: (n) => `Good · ${n} back in stock`, wasDamaged: "Damaged · not restocked", order: "Order", supplier: "Supplier", reason: "Reason",
    reasons: { wrong_part: "Wrong part", damaged: "Arrived damaged", doesnt_fit: "Doesn't fit the car", not_as_described: "Not as described", other: "Other" }, error: "Could not save: ",
  },
};
const useText = () => { const { lang } = useLang(); return RETURNS_TEXT[lang] || RETURNS_TEXT.en; };

/** The returns of this hub, read again every 15 seconds (quietly); `count` = still to receive, for the menu. */
export function useIncomingReturns() {
  const { onSessionExpired } = useHub();
  const [list, setList] = useState(null);
  const load = () => fetchIncomingReturns(getStoredToken())
    .then((l) => setList((cur) => (JSON.stringify(cur) === JSON.stringify(l) ? cur : l)))
    .catch((err) => { if (err instanceof SessionExpiredError) onSessionExpired(); });
  useEffect(() => {
    load();
    const timer = setInterval(() => { if (!document.hidden) load(); }, 15000);
    return () => clearInterval(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return { list, reload: load, count: (list || []).filter((r) => !r.receivedAt).length };
}

export default function HubReturns({ returns, conversations }) {
  const x = useText();
  const { lang } = useLang();
  const { onSessionExpired } = useHub();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const list = returns.list || [];
  const match = (r) => !q.trim() || `${r.id} ${r.orderId}`.toLowerCase().includes(q.trim().toLowerCase());
  const waiting = list.filter((r) => !r.receivedAt && match(r));
  const done = list.filter((r) => r.receivedAt && match(r));
  const day = (d) => new Date(d).toLocaleDateString(lang === "zh" ? "zh-CN" : "en-GB");

  const receive = async (id, condition) => {
    setBusy(id + condition); setError(null);
    try { await markReturnReceivedAtHub(getStoredToken(), id, condition); await returns.reload(); }
    catch (err) { if (err instanceof SessionExpiredError) return onSessionExpired(); setError(x.error + err.message); }
    finally { setBusy(null); }
  };
  const card = (r) => (
    <div key={r.id} data-testid="hub-return" style={{ ...body, background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: 16, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", boxShadow: "0 1px 2px rgba(11,49,70,0.06)" }}>
      <div style={{ flex: "1 1 300px", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ ...mono, fontSize: 14, fontWeight: 700, color: C.navy, border: `1.5px solid ${C.navy}`, borderRadius: 6, padding: "2px 8px" }}>{r.id}</span>
          <span style={{ fontSize: 12, color: C.muted }}>{x.order} <span style={mono}>{r.orderId}</span> · {r.receivedAt ? x.receivedAt(day(r.receivedAt)) : x.approved(day(r.approvedAt))}</span>
        </div>
        <div style={{ fontSize: 14, fontWeight: 800, color: C.ink, marginTop: 8 }}>{(r.items || []).map((i) => `${i.name} × ${i.quantity}`).join(", ")}</div>
        <div style={{ fontSize: 12.5, color: C.muted, marginTop: 3 }}>{x.supplier}: {r.supplierName} · {x.reason}: {r.reasonCode ? x.reasons[r.reasonCode] : r.reason}</div>
      </div>
      {r.receivedAt ? (
        <span style={{ fontSize: 12.5, fontWeight: 800, borderRadius: 999, padding: "5px 12px", background: r.receivedCondition === "good" ? C.greenBg : C.amberBg, color: r.receivedCondition === "good" ? C.greenInk : C.amberInk }}>
          {r.receivedCondition === "good" ? x.restocked(r.restockedQty || 0) : x.wasDamaged}
        </span>
      ) : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" disabled={Boolean(busy)} onClick={() => receive(r.id, "good")} style={{ ...body, height: 40, padding: "0 16px", borderRadius: 10, border: "none", background: C.gold, color: C.onGold, fontWeight: 800, fontSize: 13, cursor: busy ? "default" : "pointer", opacity: busy === r.id + "good" ? 0.6 : 1, boxShadow: "0 1px 0 rgba(255,255,255,0.45) inset, 0 2px 4px rgba(227,159,12,0.35)" }}>✓ {x.good}</button>
          <button type="button" disabled={Boolean(busy)} onClick={() => receive(r.id, "damaged")} style={{ ...body, height: 40, padding: "0 16px", borderRadius: 10, border: `1px solid #CFD4DB`, background: "#fff", color: C.ink, fontWeight: 700, fontSize: 13, cursor: busy ? "default" : "pointer", opacity: busy === r.id + "damaged" ? 0.6 : 1 }}>{x.damaged}</button>
        </div>
      )}
    </div>
  );
  return (
    <div style={{ ...body, minHeight: "100%" }}>
      <div data-leap-header="" style={{ background: `linear-gradient(120deg, ${C.navyDeep} 0%, ${C.navy} 55%, ${C.navySoft} 130%)`, padding: "24px 32px 26px" }}>
        <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: C.gold, marginBottom: 6 }}>LEAP · {x.menu}</div>
        <div style={{ fontWeight: 800, fontSize: 28, lineHeight: "34px", letterSpacing: "-0.02em", color: "#fff" }}>{x.title}</div>
        <div style={{ fontSize: 13, color: C.menuSoft, marginTop: 4 }}>{x.sub(returns.count)}</div>
      </div>
      <div style={{ padding: "18px 24px", display: "flex", flexDirection: "column", gap: 12, maxWidth: 1100 }}>
        {conversations && <HubConversations data={conversations} />}
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>{x.help}</div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={x.search} aria-label={x.search} style={{ ...body, height: 42, maxWidth: 420, padding: "0 14px", borderRadius: 10, border: `1px solid #CFD4DB`, fontSize: 13.5, background: "#fff" }} />
        {error && <div role="alert" style={{ fontSize: 13, color: C.redInk, background: C.redBg, borderRadius: 10, padding: "10px 14px" }}>{error}</div>}
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted, marginTop: 6 }}>{x.waiting} · {waiting.length}</div>
        {waiting.length === 0 ? <div style={{ fontSize: 13, color: C.muted, padding: "18px 0" }}>{x.empty}</div> : waiting.map(card)}
        {done.length > 0 && <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted, marginTop: 12 }}>{x.received}</div>}
        {done.map(card)}
      </div>
    </div>
  );
}
