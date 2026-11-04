import React, { useState } from "react";
import { API_BASE_URL, SessionExpiredError } from "./auth";
import { useLang } from "./langContext";

// The delivery address label, the same PDF the hub app shares (GET /hub/me/shipments/:id/address-label, made by the server from the ENGLISH
// address). "Print" opens the print window for it; "Download" saves it.
const C = { ink: "#14171C", line: "#E4E6EA", signal: "#E8622C", muted: "#6B7280" };
const body = { fontFamily: "'Inter', sans-serif" };
const TEXT = {
  zh: { print: "打印地址标签", download: "下载 PDF", preparing: "准备中…" },
  en: { print: "Print address label", download: "Download PDF", preparing: "Preparing…" },
};

async function fetchLabel(token, shipmentId) {
  const response = await fetch(`${API_BASE_URL}/hub/me/shipments/${encodeURIComponent(shipmentId)}/address-label`, { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 401) throw new SessionExpiredError("Your session has expired. Please log in again.");
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return URL.createObjectURL(await response.blob());
}

export default function AddressLabelButtons({ shipmentId, orderId, token, onError, onSessionExpired }) {
  const { lang } = useLang();
  const x = TEXT[lang] || TEXT.en;
  const [busy, setBusy] = useState(null);      // "print" | "download" while the PDF is being made

  const run = async (which) => {
    setBusy(which); onError && onError(null);
    try {
      const url = await fetchLabel(token, shipmentId);
      if (which === "download") {
        const a = document.createElement("a");
        a.href = url; a.download = `LEAP-address-${orderId || shipmentId}.pdf`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } else {
        // the PDF in a hidden frame, then the browser's print window for it; if the browser will not print a frame, the PDF opens in a new tab
        const frame = document.createElement("iframe");
        frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
        frame.src = url;
        frame.onload = () => {
          try { frame.contentWindow.focus(); frame.contentWindow.print(); } catch { window.open(url, "_blank"); }
          setTimeout(() => { frame.remove(); URL.revokeObjectURL(url); }, 60000);
        };
        document.body.appendChild(frame);
      }
    } catch (err) {
      if (err instanceof SessionExpiredError) return onSessionExpired && onSessionExpired();
      onError && onError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const button = (primary) => ({
    ...body, flex: 1, height: 40, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, fontWeight: 700, fontSize: 13,
    cursor: busy ? "default" : "pointer", background: "#fff", border: primary ? `1.5px solid ${C.signal}` : `1px solid ${C.line}`, color: primary ? C.signal : C.ink, opacity: busy ? 0.7 : 1,
  });
  return (
    <div data-testid="address-label-buttons" style={{ display: "flex", gap: 8, marginTop: 14 }}>
      <button type="button" disabled={!!busy} onClick={() => run("print")} style={button(true)}>🖨 {busy === "print" ? x.preparing : x.print}</button>
      <button type="button" disabled={!!busy} onClick={() => run("download")} style={button(false)}>⬇ {busy === "download" ? x.preparing : x.download}</button>
    </div>
  );
}
