import React from "react";
import { C, body } from "./theme";
import { summarizeFitment, formatRanges } from "./fitmentSummary";

// The top of the "Vehicle fitment" card: what the part fits, one line per model with its years, and the totals; or, with no fitment at all, that buyers see the part as universal (fits every vehicle).
export default function FitmentSummary({ fitment }) {
  const rows = Array.isArray(fitment) ? fitment : [];
  if (rows.length === 0) {
    return <div data-testid="fitment-summary" style={{ ...body, fontSize: 12.5, color: C.muted, background: "#F4F6F8", border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 12px", marginBottom: 14 }}>No vehicle fitment entered: buyers see this part as <b>universal (fits all vehicles)</b>.</div>;
  }
  const { groups, models, vehicles } = summarizeFitment(rows);
  return (
    <div data-testid="fitment-summary" style={{ ...body, background: "#F4F6F8", border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 12px", marginBottom: 14 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: C.ink, marginBottom: 6 }}>Summary: {vehicles} {vehicles === 1 ? "vehicle" : "vehicles"}{models > 0 ? ` · ${models} ${models === 1 ? "model" : "models"}` : ""}</div>
      <div style={{ maxHeight: 180, overflowY: "auto" }}>
        {groups.map((g) => (
          <div key={g.name} data-testid="fitment-summary-line" style={{ display: "flex", justifyContent: "space-between", gap: 16, fontSize: 12.5, color: C.ink, padding: "2px 0" }}>
            <span style={{ fontWeight: 600 }}>{g.name}</span>
            <span style={{ color: C.muted }}>{formatRanges(g.ranges)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
