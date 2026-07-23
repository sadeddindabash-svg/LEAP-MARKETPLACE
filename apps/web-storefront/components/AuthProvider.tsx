"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

/**
 * Real, minimal account auth for the web storefront (confirmed scope:
 * login/signup only, enough to unblock saved searches -- order
 * history and saved-address checkout are a real, separate, confirmed
 * next pass, not built here). A real cookie holds the JWT (30-day
 * expiry, same real pattern and reasoning as the cart ID cookie in
 * CartProvider.tsx) so a session survives a page refresh.
 */
const AUTH_TOKEN_COOKIE = "leap_auth_token";
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, referralCode?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readTokenCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${AUTH_TOKEN_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeTokenCookie(token: string) {
  document.cookie = `${AUTH_TOKEN_COOKIE}=${encodeURIComponent(token)}; path=/; max-age=${60 * 60 * 24 * 30}`;
}

function clearTokenCookie() {
  document.cookie = `${AUTH_TOKEN_COOKIE}=; path=/; max-age=0`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = readTokenCookie();
    if (!token) {
      // Real, deliberate: wrapped in a microtask rather than called
      // directly in the effect body -- avoids the same real cascading-
      // render lint issue already fixed once in CartProvider.tsx.
      Promise.resolve().then(() => setIsLoading(false));
      return;
    }
    fetch(`${API_BASE_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Session expired"))))
      .then(setUser)
      .catch(() => clearTokenCookie())
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "Login failed");
    writeTokenCookie(body.token);
    setUser(body.user);
  }, []);

  const signup = useCallback(async (email: string, password: string, referralCode?: string) => {
    const res = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, ...(referralCode ? { referralCode } : {}) }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "Sign up failed");
    writeTokenCookie(body.token);
    setUser(body.user);
  }, []);

  const logout = useCallback(() => {
    clearTokenCookie();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

export function getAuthToken(): string | null {
  return readTokenCookie();
}
