"use client";

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { apiMessage } from "@/lib/serverMessages";
import { netFetch } from "@/lib/net";

/**
 * Account sign-in for the web storefront. A cookie holds the JWT (30 days, like the cart id cookie in CartProvider.tsx) so a session survives a page refresh. It is written with
 * SameSite=Lax (the browser does not send it with a form posted from another site) and Secure when the site is on https.
 *
 * Two-step sign-in: when the account has it turned on, the server does NOT answer with a token but with { requiresTwoFactor, userId }: login() then returns
 * { status: "two_factor", userId } and the page asks for the 6-digit code, which completeTwoFactor() sends. (This used to store the word "undefined" as the token.)
 */
const AUTH_TOKEN_COOKIE = "leap_auth_token";
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  avatarUrl?: string | null;
  twoFactorEnabled?: boolean;
  mustChangePassword?: boolean;
}

export type LoginResult = { status: "ok" } | { status: "two_factor"; userId: string };

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  /** The second step: the 6-digit code from the authenticator app, with the userId login() returned. */
  completeTwoFactor: (userId: string, code: string) => Promise<void>;
  signup: (email: string, password: string, referralCode?: string, name?: string) => Promise<void>;
  /** Adopts a session the server just issued (changing the email gives a new token for the new email) without signing in again. */
  adoptSession: (token: string, user: AuthUser) => void;
  /** Reads the account again from the server (after turning two-step sign-in on or off, or changing the photo). */
  refreshUser: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readTokenCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${AUTH_TOKEN_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

const cookieFlags = () => `; path=/; SameSite=Lax${typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : ""}`;
function writeTokenCookie(token: string) {
  document.cookie = `${AUTH_TOKEN_COOKIE}=${encodeURIComponent(token)}${cookieFlags()}; max-age=${60 * 60 * 24 * 30}`;
}
function clearTokenCookie() {
  document.cookie = `${AUTH_TOKEN_COOKIE}=${cookieFlags()}; max-age=0`;
}

async function postJson(path: string, payload: unknown, failure: string) {
  const res = await netFetch(`${API_BASE_URL}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(apiMessage(body.error) || apiMessage(failure));
  return body;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = readTokenCookie();
    if (!token) {
      Promise.resolve().then(() => setIsLoading(false));
      return;
    }
    netFetch(`${API_BASE_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Session expired"))))
      .then(setUser)
      .catch(() => clearTokenCookie())
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    const body = await postJson("/auth/login", { email, password }, "Login failed");
    if (body.requiresTwoFactor && body.userId) return { status: "two_factor", userId: body.userId };
    if (!body.token || !body.user) throw new Error(apiMessage("Login failed"));            // never store a session the server did not really give
    writeTokenCookie(body.token);
    setUser(body.user);
    return { status: "ok" };
  }, []);

  const completeTwoFactor = useCallback(async (userId: string, code: string) => {
    const body = await postJson("/auth/login/2fa", { userId, code }, "Login failed");
    if (!body.token || !body.user) throw new Error(apiMessage("Login failed"));
    writeTokenCookie(body.token);
    setUser(body.user);
  }, []);

  const signup = useCallback(async (email: string, password: string, referralCode?: string, name?: string) => {
    const body = await postJson("/auth/signup", { email, password, ...(referralCode ? { referralCode } : {}), ...(name?.trim() ? { name: name.trim() } : {}) }, "Sign up failed");
    if (!body.token || !body.user) throw new Error(apiMessage("Sign up failed"));
    writeTokenCookie(body.token);
    setUser(body.user);
  }, []);

  const adoptSession = useCallback((token: string, next: AuthUser) => {
    writeTokenCookie(token);
    setUser((current) => ({ ...(current ?? next), ...next }));
  }, []);

  const refreshUser = useCallback(async () => {
    const token = readTokenCookie();
    if (!token) return;
    const res = await netFetch(`${API_BASE_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setUser(await res.json());
  }, []);

  const logout = useCallback(() => {
    clearTokenCookie();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, completeTwoFactor, signup, adoptSession, refreshUser, logout }}>
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
