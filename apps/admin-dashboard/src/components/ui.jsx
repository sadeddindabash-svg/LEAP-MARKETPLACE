import { Star, TrendingUp, TrendingDown } from "lucide-react";
import { C, body, disp, mono } from "../theme";

// Real, second step toward splitting App.jsx (see theme.js's own
// comment for the first step) -- these are the small, reusable,
// purely presentational primitives used across almost every page in
// this app: a plate-style ID chip, a status badge, a star rating, a
// KPI stat card, a bordered content card, and table header/cell
// helpers. No behavior change from extracting them here, just a real
// module boundary matching this file's own documented next-step
// ("split src/App.jsx into separate files under src/pages/ and
// src/components/").

export function PlateChip({ children, small }) {
  return (
    <span style={{
      ...mono, border: `1.5px solid ${C.ink}`, color: C.ink, display: "inline-flex", alignItems: "center",
      padding: small ? "2px 7px" : "4px 10px", borderRadius: 6, fontSize: small ? 10.5 : 12, fontWeight: 700,
      letterSpacing: "0.05em",
    }}>{children}</span>
  );
}

export function Badge({ label, color, bg }) {
  return <span style={{ ...body, background: bg, color, fontWeight: 700, fontSize: 11, padding: "4px 10px", borderRadius: 999, textTransform: "uppercase", letterSpacing: "0.02em", whiteSpace: "nowrap" }}>{label}</span>;
}

export function Stars({ rating }) {
  if (rating == null) return <span style={{ ...body, fontSize: 11.5, color: C.muted }}>—</span>;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <Star size={12} fill={C.amber} color={C.amber} />
      <span style={{ ...body, fontSize: 12, fontWeight: 600, color: C.ink }}>{rating}</span>
    </span>
  );
}

export function KpiCard({ label, value, delta, positive, icon: Icon }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: 16, flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <span style={{ ...body, fontSize: 11.5, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.03em" }}>{label}</span>
        <Icon size={16} color={C.muted} />
      </div>
      <div style={{ ...disp, fontSize: 28, fontWeight: 700, color: C.ink, marginBottom: 4 }}>{value}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {positive ? <TrendingUp size={13} color={C.gauge} /> : <TrendingDown size={13} color={C.red} />}
        <span style={{ ...body, fontSize: 12, fontWeight: 600, color: positive ? C.gauge : C.red }}>{delta}</span>
        <span style={{ ...body, fontSize: 11.5, color: C.muted }}>vs last week</span>
      </div>
    </div>
  );
}

export function Card({ title, action, children, style }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, overflow: "hidden", ...style }}>
      {title && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: `1px solid ${C.line}` }}>
          <span style={{ ...disp, fontSize: 16, fontWeight: 600, color: C.ink }}>{title}</span>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function Th({ children, align }) {
  return <th style={{ ...body, textAlign: align || "left", fontSize: 10.5, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.04em", padding: "10px 16px", borderBottom: `1px solid ${C.line}`, whiteSpace: "nowrap" }}>{children}</th>;
}

export function Td({ children, align, style }) {
  return <td style={{ ...body, fontSize: 13, color: C.ink, padding: "13px 16px", borderBottom: `1px solid ${C.line}`, textAlign: align || "left", ...style }}>{children}</td>;
}

// Real, new, shared confirmation dialog -- used for every real delete
// action across categories, parts, brands, models, generations,
// engines, and transmissions, so this exact same confirmation UI
// isn't rebuilt 7 separate times. Confirmed against a real rendered
// mockup before building this.
export function ConfirmDialog({ isOpen, title, message, onConfirm, onCancel }) {
  if (!isOpen) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={onCancel}>
      <div style={{ background: "#fff", borderRadius: 12, padding: 20, maxWidth: 340, width: "90%", boxShadow: "0 12px 32px rgba(0,0,0,0.2)" }} onClick={(e) => e.stopPropagation()}>
        <p style={{ ...disp, fontSize: 15, fontWeight: 700, color: C.ink, margin: "0 0 6px" }}>{title}</p>
        <p style={{ ...body, fontSize: 12.5, color: C.muted, margin: "0 0 16px" }}>{message || "This can't be undone."}</p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{ ...body, fontSize: 12.5, padding: "7px 14px", borderRadius: 8, border: `1px solid ${C.line}`, background: "none", cursor: "pointer" }}>Cancel</button>
          <button onClick={onConfirm} style={{ ...body, fontSize: 12.5, padding: "7px 14px", borderRadius: 8, border: "none", background: C.red, color: "#fff", fontWeight: 600, cursor: "pointer" }}>Delete</button>
        </div>
      </div>
    </div>
  );
}
