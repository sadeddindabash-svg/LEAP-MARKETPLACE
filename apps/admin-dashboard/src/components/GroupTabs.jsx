import React from "react";
import { C, body, mono } from "../theme";

/**
 * The row of sub-tabs above a grouped page (Financial: Payment Methods | Payment Providers | Payouts | Pricing, and so on). Purely presentational: the
 * shell decides which tabs exist (only the pages this admin may open) and what happens on a click.
 */
export default function GroupTabs({ label, tabs, activeId, onSelect }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, padding: "10px 28px 0", background: C.canvas, borderBottom: `1px solid ${C.line}` }}>
      <span style={{ ...mono, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted, padding: "0 14px 10px 0" }}>{label}</span>
      <div role="tablist" aria-label={label} style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {tabs.map((tab) => {
          const active = tab.id === activeId;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(tab.id)}
              style={{
                ...body, fontSize: 13, fontWeight: active ? 700 : 600, padding: "8px 14px", cursor: "pointer", background: "transparent", border: "none",
                color: active ? C.ink : C.muted, borderBottom: `3px solid ${active ? C.signal : "transparent"}`, marginBottom: -1,
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
