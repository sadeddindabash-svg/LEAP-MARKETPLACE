import React, { useEffect, useState } from "react";
// LEAP portals design, the same as the admin portal (patch-portals-redesign)
import { fetchMyShipments, getStoredToken, SessionExpiredError } from "./auth";
import { useLang } from "./langContext";
import { useHub } from "./hubContext";

// The hub portal's new frame (design A + B + C, confirmed with the person via mockup):
//   the side menu (A)  Board · Shipments · Shipping costs · Flagged · Delivered · Settings, with numbers
//   Board (C)          one column per step; late or blocked parcels stand out; a card opens the parcel in Shipments
//   Shipments (B)      the list on the left, the open parcel on the right with its 7 steps (the list and the parcel are App.jsx's own screens)
const C = { ink: "#14171C", line: "#E4E6EA", card: "#FFFFFF", canvas: "#F5F6F8", muted: "#636B78", navy: "#0B3146", navyDeep: "#07202F", navySoft: "#1F5574", menuText: "#9FB4C3", menuSoft: "#9FB4C3",
  menuLine: "rgba(255,255,255,0.12)", active: "#07202F", gold: "#F9B317", onGold: "#0B3146", red: "#C0362C", green: "#1E9D6B", orange: "#F9B317" };
const body = { fontFamily: "'Manrope', 'Noto Sans SC', sans-serif" };
const DAY = 24 * 3600 * 1000;
const LATE_AFTER_DAYS = 3;      // a parcel waiting at the same step this long is shown in red

export const HUB_TEXT = {
  zh: {
    brand: "Leap Auto Parts", hub: "质检中心", menu: { board: "看板", shipments: "包裹", shippingCosts: "运费", flagged: "已标记", delivered: "已送达", returns: "退货与沟通", settings: "设置" },
    boardTitle: "看板", boardSub: (n, a) => `共 ${n} 个包裹${a ? ` · ${a} 个需要处理` : ""}`, scan: "扫描包裹", searchHint: "扫码或按订单、供应商、运单号搜索…",
    cols: { awaiting_receipt: "待接收", received: "已接收", opened: "已开箱", inspected: "已质检", packed: "已打包", shipped_to_buyer: "已发货" },
    more: (n) => `还有 ${n} 个`, days: (n) => (n < 1 ? "今天" : `${Math.floor(n)} 天`), late: "已等待较久", flagged: "已标记",
    steps: ["已接收", "已开箱", "已质检", "已打包", "运费", "已发货", "已送达"], pick: "从左侧列表选择一个包裹，或扫描包裹上的二维码。", logout: "退出登录",
  },
  en: {
    brand: "Leap Auto Parts", hub: "Inspection hub", menu: { board: "Board", shipments: "Shipments", shippingCosts: "Shipping costs", flagged: "Flagged", delivered: "Delivered", returns: "Returns & messages", settings: "Settings" },
    boardTitle: "Board", boardSub: (n, a) => `${n} parcels${a ? ` · ${a} need attention` : ""}`, scan: "Scan parcel", searchHint: "Scan or search by order, supplier, tracking…",
    cols: { awaiting_receipt: "Awaiting receipt", received: "Received", opened: "Opened", inspected: "Inspected", packed: "Packed", shipped_to_buyer: "Shipped" },
    more: (n) => `+${n} more`, days: (n) => (n < 1 ? "today" : `${Math.floor(n)} ${Math.floor(n) === 1 ? "day" : "days"}`), late: "waiting long", flagged: "Flagged",
    steps: ["Received", "Opened", "Inspected", "Packed", "Shipping cost", "Shipped", "Delivered"], pick: "Pick a parcel from the list, or scan the QR on the parcel.", logout: "Log out",
  },
};
const useText = () => { const { lang } = useLang(); return HUB_TEXT[lang] || HUB_TEXT.en; };

const IN_PROGRESS = ["received", "opened", "inspected", "packed"];
const FLAGGED = ["flagged", "returned_to_supplier", "discarded_at_hub"];
const waitedDays = (s) => (Date.now() - new Date(s.updatedAt || s.createdAt).getTime()) / DAY;
const isLate = (s) => ["awaiting_receipt", ...IN_PROGRESS].includes(s.status) && waitedDays(s) >= LATE_AFTER_DAYS;

/** The hub's shipments for the menu numbers and the board, read again every 5 seconds (quietly). */
export function useHubShipments() {
  const { onSessionExpired } = useHub();
  const [shipments, setShipments] = useState(null);
  useEffect(() => {
    let alive = true;
    const load = () => fetchMyShipments(getStoredToken())
      .then((list) => { if (alive) setShipments((cur) => (JSON.stringify(cur) === JSON.stringify(list) ? cur : list)); })
      .catch((err) => { if (err instanceof SessionExpiredError) onSessionExpired(); });
    load();
    const timer = setInterval(() => { if (!document.hidden) load(); }, 5000);
    return () => { alive = false; clearInterval(timer); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return shipments;
}

/** The numbers beside the menu items. */
export function menuCounts(shipments) {
  const list = shipments || [];
  return {
    shipments: list.filter((s) => s.status === "awaiting_receipt" || IN_PROGRESS.includes(s.status)).length,
    shippingCosts: list.filter((s) => s.status === "packed").length,
    flagged: list.filter((s) => s.status === "flagged" && !s.resolvedAt).length,      // returned / thrown away = the hub's part is done (patch-hub-flagged-done)
  };
}

function Count({ n, tone }) {
  if (!n) return null;
  const [bg, fg] = tone === "red" ? [C.red, "#fff"] : tone === "grey" ? ["#EEF0F3", C.ink] : [C.gold, C.onGold];
  return <span data-testid="menu-count" style={{ ...body, minWidth: 19, height: 19, padding: "0 5px", boxSizing: "border-box", borderRadius: 10, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: 800, background: bg, color: fg }}>{n}</span>;
}

const MENU_ITEMS = [["board", "▦"], ["shipments", "▤"], ["shippingCosts", "¥"], ["flagged", "⚑"], ["delivered", "✓"], ["returns", "↩"], ["settings", "⚙"]];      // returns: patch-returns-flow

export function HubMenu({ view, onSelect, counts, langToggle }) {
  const x = useText();
  const { currentUser, onLogout } = useHub();
  const tone = { shipments: "gold", shippingCosts: "gold", flagged: "red", returns: "gold" };
  return (
    <nav aria-label="Main menu" style={{ ...body, width: 224, flexShrink: 0, background: C.navy, color: C.menuText, padding: "16px 12px 14px", boxSizing: "border-box", display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "0 12px 16px 6px" }}>
        <span style={{ width: 38, height: 38, borderRadius: "50%", background: C.gold, color: C.onGold, boxShadow: "0 1px 0 rgba(255,255,255,0.45) inset, 0 2px 4px rgba(227,159,12,0.35)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 10, letterSpacing: "0.02em", flexShrink: 0 }}>LEAP</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 13.5, color: "#fff" }}>{x.brand}</div>
          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: C.gold, marginTop: 2 }}>{x.hub}</div>
        </div>
      </div>
      {MENU_ITEMS.map(([id, icon]) => {
        const on = view === id;
        return (
          <button key={id} type="button" onClick={() => onSelect(id)} aria-current={on ? "page" : undefined}
            style={{ ...body, display: "flex", alignItems: "center", gap: 12, height: 40, padding: "0 10px", margin: "1px 0", border: "none", borderRadius: 8, boxShadow: on ? `inset 4px 0 0 ${C.gold}` : "none", cursor: "pointer", textAlign: "left", fontSize: 13, fontWeight: on ? 700 : 500, background: on ? C.active : "transparent", color: on ? "#fff" : C.menuText }}>
            <span aria-hidden="true" style={{ width: 18, textAlign: "center", fontSize: 14 }}>{icon}</span>
            <span style={{ flex: 1 }}>{x.menu[id]}</span>
            <Count n={counts[id]} tone={tone[id]} />
          </button>
        );
      })}
      <div style={{ marginTop: "auto", padding: "12px 16px 0 14px", borderTop: `1px solid ${C.menuLine}` }}>
        <div style={{ color: "#fff", fontWeight: 700, fontSize: 12.5, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis" }}>{currentUser?.name || currentUser?.email}</div>
        <div style={{ fontSize: 11, marginBottom: 10, overflow: "hidden", textOverflow: "ellipsis" }}>{currentUser?.email}</div>
        <div style={{ marginBottom: 10 }}>{langToggle}</div>
        <button type="button" onClick={onLogout} style={{ ...body, width: "100%", height: 34, borderRadius: 9, border: `1px solid ${C.menuLine}`, background: "transparent", color: C.menuText, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{x.logout}</button>
      </div>
    </nav>
  );
}

const BOARD_COLS = ["awaiting_receipt", "received", "opened", "inspected", "packed", "shipped_to_buyer"];
const PER_COL = 8;

export function HubBoard({ shipments, onOpen, onScan }) {
  const x = useText();
  const list = shipments || [];
  const flagged = list.filter((s) => s.status === "flagged" && !s.resolvedAt);
  const attention = list.filter(isLate).length + flagged.length;
  return (
    <div style={{ ...body, display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <div data-leap-header="" style={{ position: "relative", background: `linear-gradient(120deg, ${C.navyDeep} 0%, ${C.navy} 55%, ${C.navySoft} 130%)`, padding: "24px 32px 26px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: C.gold, marginBottom: 6 }}>LEAP · {x.hub}</div>
          <div style={{ fontWeight: 800, fontSize: 28, lineHeight: "34px", letterSpacing: "-0.02em", color: "#fff" }}>{x.boardTitle}</div>
          <div style={{ fontSize: 13, color: C.menuSoft, marginTop: 4 }}>{x.boardSub(list.length, attention)}</div>
        </div>
        <button type="button" onClick={onScan} style={{ ...body, marginLeft: "auto", height: 40, padding: "0 18px", borderRadius: 10, border: "none", background: C.gold, color: C.onGold, fontWeight: 800, fontSize: 13, cursor: "pointer", boxShadow: "0 1px 0 rgba(255,255,255,0.45) inset, 0 2px 4px rgba(227,159,12,0.35), 0 6px 14px rgba(227,159,12,0.25)" }}>⌗ {x.scan}</button>
      </div>
      {flagged.length > 0 && (
        <div style={{ margin: "12px 16px 0", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", fontSize: 12.5 }}>
          <b style={{ color: C.red }}>⚑ {x.flagged}</b>
          {flagged.map((s) => <button key={s.id} type="button" onClick={() => onOpen(s.id)} style={{ ...body, border: `1px solid ${C.red}`, background: "#FBE7E5", color: C.red, borderRadius: 8, padding: "4px 9px", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{s.orderId}</button>)}
        </div>
      )}
      <div data-testid="hub-board" style={{ flex: 1, display: "grid", gridTemplateColumns: `repeat(${BOARD_COLS.length}, minmax(150px, 1fr))`, gap: 12, padding: "14px 16px", overflowX: "auto" }}>
        {BOARD_COLS.map((col) => {
          const cards = list.filter((s) => s.status === col).sort((a, b) => Number(isLate(b)) - Number(isLate(a)) || new Date(a.updatedAt) - new Date(b.updatedAt));
          return (
            <div key={col} style={{ background: "#EEF1F4", border: `1px solid ${C.line}`, borderRadius: 14, padding: 10, display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5, fontWeight: 800, color: C.ink, padding: "2px 2px 6px" }}>
                {x.cols[col]} <Count n={cards.length} tone={col === "shipped_to_buyer" ? "grey" : "gold"} />
              </div>
              {cards.slice(0, PER_COL).map((s) => {
                const late = isLate(s);
                return (
                  <button key={s.id} type="button" data-testid="board-card" onClick={() => onOpen(s.id)} title={late ? x.late : undefined}
                    style={{ ...body, textAlign: "left", background: C.card, border: `1px solid ${C.line}`, borderLeft: `4px solid ${late ? C.red : col === "shipped_to_buyer" ? C.line : C.gold}`, borderRadius: 10, padding: "10px 11px", cursor: "pointer", boxShadow: "0 1px 2px rgba(11,49,70,0.06), 0 4px 12px rgba(11,49,70,0.06)" }}>
                    <div style={{ fontWeight: 800, fontSize: 13, color: C.ink }}>{s.orderId}</div>
                    <div style={{ fontSize: 11, color: late ? C.red : C.muted, marginTop: 2, fontWeight: late ? 700 : 400 }}>{s.supplierName} · {x.days(waitedDays(s))}</div>
                  </button>
                );
              })}
              {cards.length > PER_COL && <div style={{ fontSize: 11.5, color: C.muted, textAlign: "center" }}>{x.more(cards.length - PER_COL)}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}


/** The 7 steps along the top of an open parcel. */
export function HubStepBar({ status }) {
  const x = useText();
  const order = ["awaiting_receipt", "received", "opened", "inspected", "packed", "shipped_to_buyer", "delivered"];
  const at = order.indexOf(status);
  if (at < 0) return null;      // flagged and the like: the page says what happened
  const doneCount = status === "packed" ? 4 : status === "shipped_to_buyer" ? 6 : status === "delivered" ? 7 : Math.max(0, at);
  return (
    <div data-testid="hub-step-bar" style={{ ...body, display: "flex", alignItems: "center", flexWrap: "wrap", rowGap: 8, gap: 6, padding: "10px 20px 12px", background: C.card, borderBottom: `1px solid ${C.line}` }}>
      {x.steps.map((label, i) => {
        const done = i < doneCount;
        const now = i === doneCount && status !== "delivered";
        return (
          <React.Fragment key={label}>
            {i > 0 && <span aria-hidden="true" style={{ flex: "1 0 10px", height: 2, background: done ? C.green : "#D1D5DB", minWidth: 10 }} />}
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", fontSize: 11.5, fontWeight: 700, color: done ? C.green : now ? C.ink : "#9CA3AF" }}>
              <span style={{ width: 20, height: 20, borderRadius: "50%", boxSizing: "border-box", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10.5,
                background: done ? C.green : "#fff", color: done ? "#fff" : now ? C.orange : "#9CA3AF", border: `2px solid ${done ? C.green : now ? C.orange : "#D1D5DB"}` }}>{done ? "✓" : i + 1}</span>
              {label}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
}

export function HubEmptyPane() {
  const x = useText();
  return <div style={{ ...body, height: "100%", minHeight: 300, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, fontSize: 13, padding: 30, textAlign: "center" }}>{x.pick}</div>;
}

/** What a scanned code (or a typed one) points to: the supplier label's link (/h/<id>), or a bare shipment number. */
export function shipmentIdFromScan(text) {
  const raw = String(text || "").trim();
  const m = raw.match(/\/h\/([A-Za-z0-9_-]+)\/?$/);
  if (m) return m[1];
  return /^\d+$/.test(raw) ? raw : null;
}
