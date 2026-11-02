import { C, disp, mono, useBodyFont } from "../theme";

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
    <span style={{ ...mono, border: `1.5px solid ${C.ink}`, color: C.ink, display: "inline-flex", alignItems: "center", padding: small ? "2px 7px" : "4px 10px", borderRadius: 6, fontSize: small ? 10.5 : 12, fontWeight: 700, letterSpacing: "0.04em" }}>{children}</span>
  );
}

export function Badge({ label, statusKey }) {
  const [color, bg] = STATUS_COLOR[statusKey] || [C.muted, "#EEEFF1"];
  const font = useBodyFont();
  return <span style={{ ...font, background: bg, color, fontWeight: 700, fontSize: 11.5, padding: "4px 10px", borderRadius: 999, whiteSpace: "nowrap" }}>{label}</span>;
}

export function KpiCard({ label, value, sub, icon: Icon, accent }) {
  const font = useBodyFont();
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: 16, flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <span style={{ ...font, fontSize: 12, fontWeight: 700, color: C.muted }}>{label}</span>
        <Icon size={16} color={accent || C.muted} />
      </div>
      <div style={{ ...disp, fontSize: 27, fontWeight: 700, color: C.ink, marginBottom: 4 }}>{value}</div>
      <div style={{ ...font, fontSize: 11.5, color: C.muted }}>{sub}</div>
    </div>
  );
}

export function Card({ title, action, children, style }) {
  const font = useBodyFont();
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, overflow: "hidden", ...style }}>
      {title && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: `1px solid ${C.line}` }}>
          <span style={{ ...font, fontSize: 15.5, fontWeight: 700, color: C.ink }}>{title}</span>
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
