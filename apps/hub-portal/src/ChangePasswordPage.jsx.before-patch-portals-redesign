import React, { useState } from "react";
import { KeyRound } from "lucide-react";
import { changeMyPassword, getStoredToken } from "./auth";
import { useLang } from "./langContext";

// Shown BEFORE anything else when someone signed in with a TEMPORARY password (a new hub staff account, or one an admin reset): they must choose their
// own. The server clears the flag when the change is saved (migration 099); this screen is what makes them do it.
const C = {
  ink: "#14171C", canvas: "#F5F6F8", card: "#FFFFFF", line: "#E4E6EA",
  signal: "#E8622C", muted: "#6B7280", redBg: "#FBE7E5", red: "#C0362C",
};
const disp = { fontFamily: "'Barlow Condensed', sans-serif" };
const body = { fontFamily: "'Inter', sans-serif" };
const inputStyle = { width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 8, border: `1px solid ${C.line}`, marginBottom: 16, fontSize: 14, fontFamily: "inherit" };
const labelStyle = { fontSize: 12, fontWeight: 700, color: C.muted, display: "block", marginBottom: 6 };

export default function ChangePasswordPage({ onDone, onLogout }) {
  const { t, lang, toggle } = useLang();
  const p = t.changePassword;
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (next.length < 8) return setError(p.tooShort);
    if (next !== confirm) return setError(p.mismatch);
    if (next === current) return setError(p.same);
    setIsSaving(true);
    try {
      await changeMyPassword(getStoredToken(), current, next);
      onDone();
    } catch (err) {
      setError(err.message);
      setIsSaving(false);
    }
  };

  return (
    <div style={{ ...body, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: C.canvas }}>
      <form onSubmit={handleSubmit} style={{ width: 380, background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: 32 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: C.signal, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <KeyRound size={18} color="#fff" />
            </div>
            <div style={{ ...disp, fontSize: 22, fontWeight: 700, color: C.ink }}>{p.title}</div>
          </div>
          <button type="button" onClick={toggle} style={{ border: `1px solid ${C.line}`, borderRadius: 6, background: "none", fontSize: 11, fontWeight: 700, padding: "4px 8px", cursor: "pointer" }}>
            {lang === "zh" ? "EN" : "中文"}
          </button>
        </div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 22, lineHeight: 1.5 }}>{p.intro}</div>

        <label htmlFor="hub-current-password" style={labelStyle}>{p.current}</label>
        <input id="hub-current-password" type="password" required autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} style={inputStyle} />

        <label htmlFor="hub-new-password" style={labelStyle}>{p.newPassword}</label>
        <input id="hub-new-password" type="password" required autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} style={inputStyle} />

        <label htmlFor="hub-confirm-password" style={labelStyle}>{p.confirm}</label>
        <input id="hub-confirm-password" type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} style={{ ...inputStyle, marginBottom: 8 }} />

        {error && (
          <div role="alert" style={{ background: C.redBg, color: C.red, fontSize: 12.5, padding: "9px 11px", borderRadius: 8, marginBottom: 12 }}>{error}</div>
        )}

        <button type="submit" disabled={isSaving} style={{ width: "100%", padding: 13, borderRadius: 8, border: "none", background: C.signal, color: "#fff", fontWeight: 700, fontSize: 14, cursor: isSaving ? "default" : "pointer", opacity: isSaving ? 0.7 : 1, marginTop: 8 }}>
          {isSaving ? p.saving : p.submit}
        </button>
        <button type="button" onClick={onLogout} style={{ width: "100%", marginTop: 10, padding: 10, border: "none", background: "none", color: C.muted, fontSize: 12.5, cursor: "pointer" }}>{t.logout}</button>
      </form>
    </div>
  );
}
