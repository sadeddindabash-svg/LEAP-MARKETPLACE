import React, { useState } from "react";
// LEAP portals design on every admin page (patch-admin-all-pages)
import { Lock } from "lucide-react";
import { login } from "./auth";
import { FONT_IMPORT, C, disp, body } from "./theme";

export default function LoginPage({ onLoginSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const { token, user } = await login(email, password);
      if (user.role !== "admin") {
        setError("This account doesn't have admin access.");
        setIsSubmitting(false);
        return;
      }
      onLoginSuccess(token, user);
    } catch (err) {
      setError(err.message);
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <style>{FONT_IMPORT}</style>
      <div style={{ ...body, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: `radial-gradient(circle at 20% 10%, ${C.navySoft}, ${C.navy} 45%, ${C.navyDeep})` }}>
        <form onSubmit={handleSubmit} style={{ width: 360, background: C.card, border: `1px solid ${C.navyDeep}`, borderRadius: 16, padding: 32, boxShadow: "0 16px 40px rgba(0,0,0,0.35)" }}>
          {/* the logo, drawn like an engraving when the page opens (public/brand/leap-logo-animated.svg); the still logo if that file is missing */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
            <img src="/brand/leap-logo-animated.svg" alt="Leap Auto Parts" width={104} height={104} style={{ display: "block" }}
              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = "/brand/leap-logo.png"; }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div style={{ ...disp, fontSize: 24, fontWeight: 700, color: C.ink }}>Leap Auto Parts</div>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", color: C.onSignal, background: C.signal, borderRadius: 999, padding: "3px 8px" }}>ADMIN</span>
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 24 }}>Platform operations login</div>

          <label htmlFor="admin-email" style={{ fontSize: 12, fontWeight: 700, color: C.muted, display: "block", marginBottom: 6 }}>Email</label>
          <input
            id="admin-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.line}`, marginBottom: 16, fontSize: 13, fontFamily: "inherit" }}
          />

          <label htmlFor="admin-password" style={{ fontSize: 12, fontWeight: 700, color: C.muted, display: "block", marginBottom: 6 }}>Password</label>
          <input
            id="admin-password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.line}`, marginBottom: 8, fontSize: 13, fontFamily: "inherit" }}
          />

          {error && (
            <div style={{ background: C.redBg, color: C.red, fontSize: 12, padding: "8px 10px", borderRadius: 8, marginBottom: 12 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              marginTop: 8, padding: "11px 16px", borderRadius: 8, border: "none",
              background: isSubmitting ? "#D1D5DB" : C.signal, color: C.onSignal, fontWeight: 800, fontSize: 14, boxShadow: isSubmitting ? "none" : "0 1px 0 rgba(255,255,255,0.45) inset, 0 2px 4px rgba(227,159,12,0.35), 0 6px 14px rgba(227,159,12,0.25)", cursor: isSubmitting ? "default" : "pointer",
            }}
          >
            <Lock size={14} /> {isSubmitting ? "Logging in…" : "Log in"}
          </button>

          <div style={{ fontSize: 11, color: C.muted, marginTop: 16, textAlign: "center" }}>
            Access is restricted to Leap platform staff.
          </div>
        </form>
      </div>
    </>
  );
}
