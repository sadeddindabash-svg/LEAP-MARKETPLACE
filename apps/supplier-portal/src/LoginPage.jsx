import React, { useState } from "react";
import { Lock } from "lucide-react";
import { login } from "./auth";
import { useLang } from "./langContext";

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

const LOGIN_COPY = {
  zh: {
    subtitle: "供应商门户登录",
    email: "邮箱", password: "密码",
    login: "登录", loggingIn: "登录中…",
    restricted: "仅限已通过认证的 Leap 供应商使用。",
    wrongRole: "该账户没有供应商门户访问权限。",
  },
  en: {
    subtitle: "Supplier portal login",
    email: "Email", password: "Password",
    login: "Log in", loggingIn: "Logging in…",
    restricted: "Access is restricted to verified Leap suppliers.",
    wrongRole: "This account doesn't have supplier portal access.",
  },
};

export default function LoginPage({ onLoginSuccess }) {
  const { lang, toggle } = useLang();
  const c = LOGIN_COPY[lang];
  const font = { fontFamily: lang === "zh" ? "'Noto Sans SC', sans-serif" : "'Inter', sans-serif" };
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
      if (user.role !== "supplier") {
        setError(c.wrongRole);
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
    <div style={{ ...font, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 700, background: C.canvas }}>
      <form onSubmit={handleSubmit} style={{ width: 360, background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: 32 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ ...disp, fontSize: 26, fontWeight: 700, color: C.ink }}>LEAP</div>
            <span style={{ fontSize: 10, color: C.muted, border: `1px solid ${C.line}`, borderRadius: 4, padding: "2px 6px" }}>
              {lang === "zh" ? "供应商" : "Supplier"}
            </span>
          </div>
          <button type="button" onClick={toggle} style={{ border: `1px solid ${C.line}`, borderRadius: 6, background: "none", fontSize: 11, fontWeight: 700, padding: "4px 8px", cursor: "pointer", color: C.muted }}>
            {lang === "zh" ? "EN" : "中文"}
          </button>
        </div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 24 }}>{c.subtitle}</div>

        <label htmlFor="supplier-email" style={{ fontSize: 12, fontWeight: 700, color: C.muted, display: "block", marginBottom: 6 }}>{c.email}</label>
        <input
          id="supplier-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.line}`, marginBottom: 16, fontSize: 13, fontFamily: "inherit" }}
        />

        <label htmlFor="supplier-password" style={{ fontSize: 12, fontWeight: 700, color: C.muted, display: "block", marginBottom: 6 }}>{c.password}</label>
        <input
          id="supplier-password"
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
            fontFamily: "inherit",
          }}
        >
          <Lock size={14} /> {isSubmitting ? c.loggingIn : c.login}
        </button>

        <div style={{ fontSize: 11, color: C.muted, marginTop: 16, textAlign: "center" }}>{c.restricted}</div>
      </form>
    </div>
  );
}
