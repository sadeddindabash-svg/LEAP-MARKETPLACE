import React, { useState } from "react";
import { Lock } from "lucide-react";
import { login } from "./auth";

const C = {
  ink: "#14171C",
  canvas: "#F5F6F8",
  card: "#FFFFFF",
  line: "#E4E6EA",
  signal: "#E8622C",
  muted: "#6B7280",
  redBg: "#FBE7E5",
  red: "#C0362C",
};
const disp = { fontFamily: "'Barlow Condensed', sans-serif" };
const body = { fontFamily: "'Inter', sans-serif" };

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
    <div style={{ ...body, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 700, background: C.canvas }}>
      <form onSubmit={handleSubmit} style={{ width: 360, background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <div style={{ ...disp, fontSize: 26, fontWeight: 700, color: C.ink }}>LEAP</div>
          <span style={{ fontSize: 10, color: C.muted, border: `1px solid ${C.line}`, borderRadius: 4, padding: "2px 6px" }}>OPS</span>
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
            background: isSubmitting ? "#D1D5DB" : C.signal, color: "#fff", fontWeight: 700, fontSize: 14, cursor: isSubmitting ? "default" : "pointer",
          }}
        >
          <Lock size={14} /> {isSubmitting ? "Logging in…" : "Log in"}
        </button>

        <div style={{ fontSize: 11, color: C.muted, marginTop: 16, textAlign: "center" }}>
          Access is restricted to Leap platform staff.
        </div>
      </form>
    </div>
  );
}
