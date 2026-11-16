import { useState, useEffect } from "react";
// LEAP portals design on every admin page (patch-admin-all-pages)
import { Star, TrendingUp, TrendingDown } from "lucide-react";
import { C, body, disp, mono, SHADOW } from "../theme";
import { CountUpText } from "./CountUp";      // the big numbers count up from 0

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
      ...mono, border: `1.5px solid ${C.navy}`, color: C.navy, background: C.card, display: "inline-flex", alignItems: "center",
      whiteSpace: "nowrap", padding: small ? "2px 7px" : "4px 10px", borderRadius: 6, fontSize: small ? 10.5 : 12, fontWeight: 700,
      letterSpacing: "0.05em",
    }}>{children}</span>
  );
}

// the status colour's darker text, so the word reads well on its tint
const BADGE_INK = { [C.amber]: C.amberInk, [C.gauge]: C.gaugeInk, [C.torque]: C.torqueInk, [C.red]: C.redInk };
export function Badge({ label, color, bg }) {
  const ink = BADGE_INK[color] || color;
  return (
    <span style={{ ...body, display: "inline-flex", alignItems: "center", gap: 6, background: bg, color: ink, fontWeight: 700, fontSize: 11.5, padding: "4px 10px", borderRadius: 999, whiteSpace: "nowrap" }}>
      <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: ink, flexShrink: 0 }} />
      {label}
    </span>
  );
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

export function KpiCard({ label, value, delta, positive, icon: Icon, navy = false, note = null, onClick = null }) {
  // navy: the headline number of a row (one per row), raised like the app's navy cards
  return (
    <div role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined} onClick={onClick || undefined} onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
      style={{ cursor: onClick ? "pointer" : "default", position: "relative", overflow: "hidden", background: navy ? `linear-gradient(135deg, ${C.navyDeep}, ${C.navy} 55%, ${C.navySoft})` : C.card, border: `1px solid ${navy ? C.navyDeep : C.line}`, borderRadius: 14, padding: 20, flex: 1, minWidth: 0, boxShadow: navy ? SHADOW.navyRaised : SHADOW.card }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <span style={{ ...body, fontSize: 11, fontWeight: 700, color: navy ? C.signal : C.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
        <Icon size={16} color={navy ? C.signal : C.muted} />
      </div>
      <div style={{ ...mono, fontSize: 28, fontWeight: 700, color: navy ? "#fff" : C.ink, marginBottom: 4, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{typeof value === "string" ? <CountUpText text={value} /> : value}</div>
      {note && <div style={{ ...body, fontSize: 12, fontWeight: 600, color: navy ? C.onNavyMuted : C.muted, marginTop: 2 }}>{note}</div>}
      {/* Only when a REAL change is given. Nothing used to pass one, so every card showed a red down-arrow and "vs last week" with no number, as if
          every figure had dropped. */}
      {delta !== undefined && delta !== null && delta !== "" && (
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {positive ? <TrendingUp size={13} color={C.gauge} /> : <TrendingDown size={13} color={C.red} />}
          <span style={{ ...body, fontSize: 12, fontWeight: 600, color: positive ? C.gauge : C.red }}>{delta}</span>
          <span style={{ ...body, fontSize: 11.5, color: C.muted }}>vs last week</span>
        </div>
      )}
    </div>
  );
}

export function Card({ title, action, children, style }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, overflow: "auto", boxShadow: SHADOW.card, ...style }}>
      {title && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: `1px solid ${C.line}`, background: "linear-gradient(180deg, #FFFFFF, #FBFCFD)" }}>
          <span style={{ ...disp, display: "inline-flex", alignItems: "center", gap: 10, fontSize: 16.5, fontWeight: 800, letterSpacing: "-0.01em", color: C.ink }}>
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
  return <th style={{ ...body, textAlign: align || "left", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", padding: "12px 18px", background: C.surfaceHigh, borderBottom: `1px solid ${C.line}`, whiteSpace: "nowrap" }}>{children}</th>;
}

export function Td({ children, align, style }) {
  return <td style={{ ...body, fontSize: 13.5, color: C.ink, padding: "14px 18px", borderBottom: `1px solid ${C.line}`, textAlign: align || "left", verticalAlign: "middle", ...style }}>{children}</td>;
}

// Real, new, shared confirmation dialog -- used for every real delete
// action across categories, parts, brands, models, generations,
// engines, and transmissions, so this exact same confirmation UI
// isn't rebuilt 7 separate times. Confirmed against a real rendered
// mockup before building this.
// confirmLabel defaults to "Delete" so every existing use is unchanged; pass another
// word (e.g. "Disable", "Reset password") for non-delete confirmations.
// `errorMessage` and `isSaving` are optional: a caller whose action can be REFUSED by the server passes them so the refusal is shown here and the
// button cannot be clicked twice. A caller that passes neither behaves exactly as before.
export function ConfirmDialog({ isOpen, title, message, onConfirm, onCancel, confirmLabel = "Delete", errorMessage, isSaving }) {
  if (!isOpen) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(7,32,47,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={onCancel}>
      <div style={{ background: "#fff", borderRadius: 14, padding: 24, maxWidth: 380, width: "90%", boxShadow: "0 12px 32px rgba(0,0,0,0.2)" }} onClick={(e) => e.stopPropagation()}>
        <p style={{ ...disp, fontSize: 15, fontWeight: 700, color: C.ink, margin: "0 0 6px" }}>{title}</p>
        <p style={{ ...body, fontSize: 12.5, color: C.muted, margin: "0 0 16px" }}>{message || "This can't be undone."}</p>
        {errorMessage && <p role="alert" style={{ ...body, fontSize: 12.5, color: C.red, margin: "-6px 0 14px" }}>{errorMessage}</p>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{ ...body, fontSize: 12.5, padding: "7px 14px", borderRadius: 8, border: `1px solid ${C.line}`, background: "none", cursor: "pointer" }}>Cancel</button>
          <button onClick={onConfirm} disabled={isSaving} style={{ ...body, fontSize: 12.5, padding: "7px 14px", borderRadius: 8, border: "none", background: C.red, color: "#fff", fontWeight: 600, cursor: isSaving ? "default" : "pointer", opacity: isSaving ? 0.6 : 1 }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// Real, new, shared edit dialog -- used across all 7 real levels
// (categories, parts, brands, models, generations, engines,
// transmissions), so this same real edit-form logic and styling
// isn't rebuilt 7 separate times. Confirmed against a real rendered
// mockup before building this.
//
// `fields` is a real array of { key, label, value, type?, dir?,
// required? } -- lets each of the 7 real callers configure exactly
// which inputs it needs (most need 1-2 text fields; generations need
// 3, including two real number fields for years).
export function EditDialog({ isOpen, title, fields, onSave, onCancel, errorMessage, isSaving }) {
  const [values, setValues] = useState({});

  // Real, deliberate -- resets local state to the real item's
  // current values every time a different real item opens for
  // editing (or the dialog re-opens), so stale values from whichever
  // real item was edited previously never leak into a new one.
  useEffect(() => {
    if (isOpen && fields) {
      const initial = {};
      fields.forEach((f) => { initial[f.key] = f.value ?? ""; });
      setValues(initial);
    }
  }, [isOpen, fields]);

  if (!isOpen) return null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(7,32,47,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={onCancel}>
      <div style={{ background: "#fff", borderRadius: 14, padding: 24, maxWidth: 380, width: "90%", boxShadow: "0 12px 32px rgba(0,0,0,0.2)" }} onClick={(e) => e.stopPropagation()}>
        <p style={{ ...disp, fontSize: 15, fontWeight: 700, color: C.ink, margin: "0 0 14px" }}>{title}</p>
        {(fields || []).map((f) => (
          <div key={f.key} style={{ marginBottom: 10 }}>
            <label style={{ ...body, fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>{f.label}</label>
            {f.options ? (
              <select
                value={values[f.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                style={{ ...body, width: "100%", boxSizing: "border-box", border: `1px solid ${C.line}`, borderRadius: 8, padding: "9px 11px", fontSize: 13, background: "#fff" }}
              >
                <option value="">{f.placeholder || "-- Not set --"}</option>
                {f.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            ) : (
              <input
                type={f.type || "text"}
                value={values[f.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                dir={f.dir}
                style={{ ...body, width: "100%", boxSizing: "border-box", border: `1px solid ${C.line}`, borderRadius: 8, padding: "9px 11px", fontSize: 13 }}
              />
            )}
          </div>
        ))}
        {/* Real, new -- shown here specifically because this dialog
            is a real, full-screen overlay: any error rendered in the
            page behind it (the normal, page-level error banner) would
            be completely hidden from the person while this is open,
            making a real save failure look exactly like "nothing
            happened" instead of a real, visible error. */}
        {errorMessage && (
          <p style={{ ...body, fontSize: 12, color: C.red, margin: "0 0 10px", padding: "8px 10px", background: "rgba(192,54,44,0.08)", borderRadius: 6 }}>{errorMessage}</p>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
          <button onClick={onCancel} style={{ ...body, fontSize: 12.5, padding: "7px 14px", borderRadius: 8, border: `1px solid ${C.line}`, background: "none", cursor: "pointer" }}>Cancel</button>
          <button disabled={isSaving} onClick={() => onSave(values)} style={{ ...body, fontSize: 12.5, padding: "7px 14px", borderRadius: 8, border: "none", background: isSaving ? "#D1D5DB" : C.signal, color: C.onSignal, fontWeight: 700, cursor: isSaving ? "default" : "pointer" }}>{isSaving ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}

// Click-to-enlarge photo, used for evidence photos (hub inspection and flag photos). The thumbnail opens
// a full-screen view; Escape, the close button, or a click outside the picture closes it; "Open original"
// opens the file itself in a new tab. Keyboard users can open it with Enter or Space.
export function EnlargeablePhoto({ src, alt = "", style }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <img
        src={src}
        alt={alt}
        role="button"
        tabIndex={0}
        title="Click to enlarge"
        onClick={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(true); } }}
        style={{ cursor: "zoom-in", ...style }}
      />
      {open && (
        <div
          role="dialog"
          aria-label="Photo"
          onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
        >
          <img
            src={src}
            alt={alt || "Enlarged photo"}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 8, background: "#111" }}
          />
          <button
            aria-label="Close"
            onClick={(e) => { e.stopPropagation(); setOpen(false); }}
            style={{ ...body, position: "absolute", top: 16, right: 16, width: 36, height: 36, borderRadius: 18, border: "none", background: "#fff", color: C.ink, fontSize: 20, lineHeight: "36px", cursor: "pointer" }}
          >
            ×
          </button>
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{ ...body, position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", padding: "8px 16px", borderRadius: 8, background: "#fff", color: C.ink, fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}
          >
            Open original
          </a>
        </div>
      )}
    </>
  );
}
