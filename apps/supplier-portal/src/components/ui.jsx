import { C, disp, mono, useBodyFont, SHADOW } from "../theme";
// LEAP portals design, the same as the admin portal (patch-portals-redesign)
import { CountUpText } from "./CountUp";      // the big numbers count up from 0

// Real, second step toward splitting App.jsx (see theme.js's own
// comment for the first step, and the identical extraction already
// done for apps/admin-dashboard this session) -- these are the small,
// reusable, purely presentational primitives used across almost every
// page in this app. No behavior change from extracting them here, just
// a real module boundary matching this file's own documented
// next-step ("split src/App.jsx into separate files").

export const STATUS_COLOR = {
  active: [C.gauge, C.gaugeBg], translating: [C.amber, C.amberBg], inactive: [C.muted, "#EEEFF1"],
  pending: [C.amber, C.amberBg], preparing: [C.torque, C.torqueBg], shipped: [C.torque, C.torqueBg], delivered: [C.gauge, C.gaugeBg], dispute: [C.red, C.redBg],
  awaiting: [C.amber, C.amberBg], inProgress: [C.torque, C.torqueBg], in_progress: [C.torque, C.torqueBg],
  approved: [C.gauge, C.gaugeBg], rejected: [C.red, C.redBg], completed: [C.gauge, C.gaugeBg],
  paid: [C.gauge, C.gaugeBg], calculating: [C.muted, "#EEEFF1"],
};

export function PlateChip({ children, small }) {
  return (
    <span style={{ ...mono, border: `1.5px solid ${C.navy}`, color: C.navy, background: C.card, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", padding: small ? "2px 7px" : "4px 10px", borderRadius: 6, fontSize: small ? 10.5 : 12, fontWeight: 700, letterSpacing: "0.04em" }}>{children}</span>
  );
}

export function Badge({ label, statusKey }) {
  const [color, bg] = STATUS_COLOR[statusKey] || [C.muted, "#EEEFF1"];
  const font = useBodyFont();
  const ink = { [C.amber]: C.amberInk, [C.gauge]: C.gaugeInk, [C.torque]: C.torqueInk, [C.red]: C.redInk }[color] || color;
  return (
    <span style={{ ...font, display: "inline-flex", alignItems: "center", gap: 6, background: bg, color: ink, fontWeight: 700, fontSize: 11.5, padding: "4px 10px", borderRadius: 999, whiteSpace: "nowrap" }}>
      <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: ink, flexShrink: 0 }} />
      {label}
    </span>
  );
}

export function KpiCard({ label, value, sub, icon: Icon, accent, navy = false }) {
  const font = useBodyFont();
  return (
    <div style={{ position: "relative", overflow: "hidden", background: navy ? `linear-gradient(135deg, ${C.navyDeep}, ${C.navy} 55%, ${C.navySoft})` : C.card, border: `1px solid ${navy ? C.navyDeep : C.line}`, borderRadius: 14, padding: 20, flex: 1, minWidth: 0, boxShadow: navy ? SHADOW.navyRaised : SHADOW.card }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <span style={{ ...font, fontSize: 12, fontWeight: 800, letterSpacing: "0.04em", color: navy ? C.signal : C.muted }}>{label}</span>
        <Icon size={16} color={navy ? C.signal : accent || C.muted} />
      </div>
      <div style={{ ...mono, fontSize: 27, fontWeight: 700, letterSpacing: "-0.02em", color: navy ? "#fff" : C.ink, marginBottom: 4, fontVariantNumeric: "tabular-nums" }}>{typeof value === "string" ? <CountUpText text={value} /> : value}</div>
      <div style={{ ...font, fontSize: 12, fontWeight: 600, color: navy ? C.onNavyMuted : C.muted }}>{sub}</div>
    </div>
  );
}

export function Card({ title, action, children, style }) {
  const font = useBodyFont();
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, overflow: "auto", boxShadow: SHADOW.card, ...style }}>
      {title && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: `1px solid ${C.line}`, background: "linear-gradient(180deg, #FFFFFF, #FBFCFD)" }}>
          <span style={{ ...font, display: "inline-flex", alignItems: "center", gap: 10, fontSize: 16, fontWeight: 800, color: C.ink }}>
            <span aria-hidden="true" style={{ width: 4, height: 18, borderRadius: 4, background: C.signal, flexShrink: 0 }} />
            {title}
          </span>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function Th({ children, align }) {
  const font = useBodyFont();
  return <th style={{ ...font, textAlign: align || "left", fontSize: 11.5, fontWeight: 700, color: C.muted, padding: "10px 16px", borderBottom: `1px solid ${C.line}`, whiteSpace: "nowrap" }}>{children}</th>;
}

export function Td({ children, align, style }) {
  const font = useBodyFont();
  return <td style={{ ...font, fontSize: 13, color: C.ink, padding: "13px 16px", borderBottom: `1px solid ${C.line}`, textAlign: align || "left", ...style }}>{children}</td>;
}
