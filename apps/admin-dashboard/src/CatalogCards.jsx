import React, { useEffect, useRef, useState } from "react";
import { MoreHorizontal, ChevronLeft, ChevronRight } from "lucide-react";
import { C, body, mono } from "./theme";

// patch-categories-redesign: the small pieces the Categories and Parts cards share -- a "..." menu (closes on a click outside or Escape),
// the order arrows, a labelled input with its language tag, and the card styles.
export const cardStyle = { position: "relative", background: "#fff", border: `1px solid ${C.line}`, borderRadius: 14, boxShadow: "0 1px 2px rgba(11,49,70,0.05)", display: "flex", flexDirection: "column" };
const itemStyle = { ...body, display: "flex", alignItems: "center", gap: 9, width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 7, border: "none", background: "none", fontSize: 13, fontWeight: 700, color: C.ink, cursor: "pointer", textAlign: "left" };

// items: [{ label, icon, onClick } | { label, icon, onFile } | { label, icon, onClick, danger }]
export function CardMenu({ items, label = "Options" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown); document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return (
    <div ref={ref} onClick={(e) => e.stopPropagation()} style={{ position: "absolute", right: 10, top: 10, zIndex: open ? 30 : 2 }}>
      <button type="button" onClick={() => setOpen(!open)} aria-label={label} aria-haspopup="menu" aria-expanded={open}
        style={{ width: 30, height: 30, borderRadius: 9, border: `1px solid ${C.line}`, background: open ? C.navy : "rgba(255,255,255,0.95)", color: open ? "#fff" : C.ink, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, boxShadow: "0 1px 3px rgba(0,0,0,0.12)" }}>
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div role="menu" style={{ position: "absolute", right: 0, top: 36, minWidth: 190, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 10, boxShadow: "0 10px 28px rgba(7,32,47,0.18)", padding: 5 }}>
          {items.map((it, n) => (
            <React.Fragment key={it.label}>
              {it.danger && n > 0 && <div style={{ height: 1, background: C.line, margin: "4px 2px" }} />}
              {it.onFile ? (
                <label role="menuitem" style={itemStyle}>
                  {it.icon} {it.label}
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { setOpen(false); it.onFile(e.target.files?.[0]); }} style={{ display: "none" }} />
                </label>
              ) : (
                <button type="button" role="menuitem" onClick={() => { setOpen(false); it.onClick(); }} style={{ ...itemStyle, color: it.danger ? C.red : C.ink }}>{it.icon} {it.label}</button>
              )}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

export function OrderArrows({ onMove, isFirst, isLast }) {
  return (
    <span onClick={(e) => e.stopPropagation()} style={{ display: "inline-flex", gap: 4 }}>
      {[["up", ChevronLeft, "Move up", isFirst], ["down", ChevronRight, "Move down", isLast]].map(([dir, Icon, title, off]) => (
        <button key={dir} type="button" onClick={() => onMove(dir)} disabled={off} title={title} aria-label={title}
          style={{ width: 26, height: 26, borderRadius: 7, border: `1px solid ${C.line}`, background: "#fff", cursor: off ? "default" : "pointer", opacity: off ? 0.3 : 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
          <Icon size={14} color={C.ink} />
        </button>
      ))}
    </span>
  );
}

export function TagInput({ tag, label, value, onChange, placeholder, rtl = false, width = null, ariaLabel, inputMode, suffix }) {
  return (
    <label style={{ display: "block", flex: width ? `0 0 ${width}px` : "1 1 170px", minWidth: 0 }}>
      <span style={{ ...body, display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 700, color: C.muted, marginBottom: 4 }}>
        {tag && <span style={{ ...mono, fontSize: 9.5, fontWeight: 800, color: "#fff", background: C.navy, borderRadius: 4, padding: "1px 5px" }}>{tag}</span>}{label}
      </span>
      <span style={{ position: "relative", display: "block" }}>
        <input aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} dir={rtl ? "rtl" : "ltr"} inputMode={inputMode}
          style={{ ...body, width: "100%", boxSizing: "border-box", height: 40, border: `1px solid ${C.line}`, borderRadius: 10, padding: suffix ? "0 36px 0 12px" : "0 12px", fontSize: 13, color: C.ink, background: "#fff", outline: "none" }} />
        {suffix && <span style={{ ...body, position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)", fontSize: 11.5, fontWeight: 700, color: C.muted, pointerEvents: "none" }}>{suffix}</span>}
      </span>
    </label>
  );
}
