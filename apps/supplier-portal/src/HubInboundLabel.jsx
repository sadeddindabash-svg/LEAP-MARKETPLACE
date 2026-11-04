import React, { useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { API_BASE_URL } from "./auth";
import { useLang } from "./langContext";
import { useSupplier } from "./supplierContext";

// The supplier -> hub label (confirmed with the person via mockup): a 4×4 in (100×100 mm) SQUARE, smaller than the buyer's 4×6 in delivery
// label so the hub's label covers it completely, with a striped border and "HUB USE ONLY · NOT A DELIVERY LABEL" in English, Chinese and
// Arabic, so a delivery driver never takes it for the delivery label. No buyer details on it.
// The QR opens API_BASE_URL/h/<hub shipment>: the hub's scanner reads the number at the end and opens the parcel; any other phone gets a page
// saying "this is not the delivery label" (services/api/src/modules/hubCode/page.js).
export const hubCodeUrl = (hubShipmentId) => `${String(API_BASE_URL).replace(/\/$/, "")}/h/${hubShipmentId}`;

const TEXT = {
  zh: { hint: "打印此标签（10×10 厘米）并贴在包裹上。质检中心到货扫码；之后会用派送标签将其覆盖。", print: "打印标签" },
  en: { hint: "Print this label (10×10 cm) and stick it on the parcel. The hub scans it on arrival, then covers it with the delivery label.", print: "Print label" },
};

// a striped (warning-tape) frame, drawn as SVG so it prints even when the browser does not print backgrounds
function Stripes() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0 }} aria-hidden="true">
      <defs><pattern id="hub-stripes" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2.5" height="5" fill="#000" /></pattern></defs>
      <rect width="100" height="100" fill="#fff" /><rect width="100" height="100" fill="url(#hub-stripes)" />
    </svg>
  );
}

function Label({ order, supplierName, px }) {
  const s = px / 384;      // the label is drawn at 384 px (4 in at 96 dpi) and scaled
  const f = (n) => `${n * s}px`;
  const zh = { fontFamily: "'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif" };
  const ar = { fontFamily: "'Noto Sans Arabic', 'Segoe UI', Tahoma, sans-serif", direction: "rtl", unicodeBidi: "isolate" };
  const k = { fontSize: f(8.5), color: "#555", letterSpacing: "0.06em", fontWeight: 700 };
  return (
    <div className="hub-label" style={{ position: "relative", width: px, height: px, background: "#fff", color: "#000", fontFamily: "Inter, Arial, sans-serif", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact", boxSizing: "border-box" }}>
      <Stripes />
      <div style={{ position: "absolute", inset: f(13), background: "#fff", display: "flex", flexDirection: "column" }}>
        <div style={{ background: "#000", color: "#fff", textAlign: "center", padding: `${f(5)} ${f(6)}`, fontWeight: 900, fontSize: f(10.5), lineHeight: 1.35, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
          HUB USE ONLY · NOT A DELIVERY LABEL<br /><span style={zh}>仅限质检中心 · 非派送标签</span> · <span style={ar}>ليس ملصق توصيل</span>
        </div>
        <div style={{ padding: `${f(8)} ${f(10)} ${f(4)}` }}>
          <div style={k}>SHIP TO · <span style={zh}>收件</span></div>
          <div style={{ fontSize: f(12.5), fontWeight: 800, lineHeight: 1.25 }}>{order.hubName || "Leap inspection hub"}</div>
          {order.hubAddress && <div style={{ ...zh, fontSize: f(10.5), fontWeight: 700, lineHeight: 1.35, whiteSpace: "pre-line" }}>{order.hubAddress}</div>}
          <div style={{ ...k, marginTop: f(4) }}>FROM · <span style={zh}>发件</span> <b style={{ ...zh, color: "#000", fontSize: f(10) }}>{supplierName}</b></div>
        </div>
        <div style={{ flex: 1, minHeight: 0, display: "flex", gap: f(10), alignItems: "center", padding: `0 ${f(10)}` }}>
          <QRCodeSVG value={hubCodeUrl(order.hubShipmentId)} size={Math.round(148 * s)} level="M" marginSize={0} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 900, fontSize: f(13), lineHeight: 1.15 }}>SCAN AT<br />THE HUB</div>
            <div style={{ ...zh, fontWeight: 800, fontSize: f(13) }}>质检中心扫码收货</div>
            <div style={{ fontWeight: 800, fontSize: f(15), marginTop: f(8), wordBreak: "break-all" }}>{order.orderId}</div>
            {order.trackingNumber && <div style={{ fontSize: f(9.5), fontWeight: 700 }}><span style={zh}>运单号</span> {order.trackingNumber}</div>}
          </div>
        </div>
        <div style={{ borderTop: `${f(2)} solid #000`, padding: `${f(5)} ${f(8)}`, textAlign: "center", fontSize: f(9), fontWeight: 800, lineHeight: 1.35 }}>
          COVER WITH THE DELIVERY LABEL BEFORE SHIPPING<br /><span style={zh}>发货前请用派送标签完全覆盖此标签</span>
        </div>
      </div>
    </div>
  );
}

export default function HubInboundLabel({ order }) {
  const { lang } = useLang();
  const x = TEXT[lang] || TEXT.en;
  const supplier = useSupplier() || {};
  const supplierName = (supplier.profile && supplier.profile.name) || "";
  const printRef = useRef(null);

  const print = () => {
    if (!printRef.current) return;
    const w = window.open("", "_blank", "width=480,height=520");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${String(order.orderId).replace(/[<>&"]/g, "")}</title>
      <style>@page { size: 4in 4in; margin: 0 } html, body { margin: 0; padding: 0 } * { -webkit-print-color-adjust: exact; print-color-adjust: exact }</style>
      </head><body>${printRef.current.innerHTML}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);      // fonts and the QR are in place first
  };

  return (
    <div data-testid="hub-inbound-label" style={{ padding: 16 }}>
      <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 12, lineHeight: 1.5 }}>{x.hint}</div>
      <div style={{ display: "flex", justifyContent: "center" }}><Label order={order} supplierName={supplierName} px={300} /></div>
      {/* the print copy: the real size, 4 in */}
      <div ref={printRef} style={{ position: "absolute", left: -10000, top: 0 }} aria-hidden="true"><Label order={order} supplierName={supplierName} px={384} /></div>
      <button type="button" onClick={print}
        style={{ width: "100%", marginTop: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: 11, borderRadius: 8, border: "1px solid #E4E6EA", background: "#fff", color: "#14171C", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
        🖨 {x.print}
      </button>
    </div>
  );
}
