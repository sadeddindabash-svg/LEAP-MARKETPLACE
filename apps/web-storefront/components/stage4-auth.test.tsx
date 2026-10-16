import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useEffect } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { AuthProvider, getAuthToken, useAuth, type LoginResult } from "./AuthProvider";
import { setErrorLanguage, SERVER_MESSAGES_AR } from "@/lib/serverMessages";

// The sign-in provider (the real one) with the server replaced by fixed answers.
type Reply = { ok?: boolean; status?: number; body: unknown };
let calls: Array<{ url: string; method: string; body: unknown; auth: string | null }> = [];
let route: (url: string, method: string) => Reply;
function installFetch() {
  calls = [];
  globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    calls.push({ url: String(url), method, body: init?.body ? JSON.parse(String(init.body)) : undefined, auth: ((init?.headers ?? {}) as Record<string, string>).Authorization ?? null });
    const r = route(String(url), method);
    return { ok: r.ok ?? true, status: r.status ?? (r.ok === false ? 400 : 200), json: async () => r.body } as Response;
  }) as unknown as typeof fetch;
}

const holder: { auth?: ReturnType<typeof useAuth> } = {};
const api = () => holder.auth as ReturnType<typeof useAuth>;                    // the provider's functions, as the page under test sees them
function Probe() {
  const auth = useAuth();
  useEffect(() => { holder.auth = auth; });
  return <p data-testid="who">{auth.user ? `${auth.user.email}|${auth.user.twoFactorEnabled ?? "-"}` : auth.isLoading ? "loading" : "nobody"}</p>;
}
const mount = () => render(<AuthProvider><Probe /></AuthProvider>);
const who = () => screen.getByTestId("who").textContent;
const user = (over = {}) => ({ id: "u1", email: "sam@example.com", name: "Sam", role: "buyer", ...over });
const clear = () => { document.cookie = "leap_auth_token=; path=/; max-age=0"; };

beforeEach(() => { clear(); route = () => ({ body: {} }); installFetch(); setErrorLanguage("en"); });
afterEach(() => { setErrorLanguage("en"); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("signing in", () => {
  it("CRITICAL: a password sign-in gives a session: the token is kept (so a refresh stays signed in) and the buyer is known", async () => {
    mount();
    await waitFor(() => expect(who()).toBe("nobody"));
    route = () => ({ body: { token: "tok-1", user: user() } });
    let result: LoginResult | undefined;
    await act(async () => { result = await api().login("sam@example.com", "pw123456"); });
    expect(result).toEqual({ status: "ok" });
    expect(getAuthToken()).toBe("tok-1");
    expect(who()).toBe("sam@example.com|-");
    expect(calls[0]).toMatchObject({ url: expect.stringMatching(/\/auth\/login$/), method: "POST", body: { email: "sam@example.com", password: "pw123456" } });
  });

  it("CRITICAL (the bug): an account with two-step sign-in is NOT signed in by its password alone: no token is stored, and the page is told to ask for the code", async () => {
    mount();
    await waitFor(() => expect(who()).toBe("nobody"));
    route = () => ({ body: { requiresTwoFactor: true, userId: "u9" } });
    let result: LoginResult | undefined;
    await act(async () => { result = await api().login("sam@example.com", "pw123456"); });
    expect(result).toEqual({ status: "two_factor", userId: "u9" });
    expect(getAuthToken()).toBeNull();                                                                       // it used to store the word "undefined" here
    expect(document.cookie).not.toMatch(/undefined/);
    expect(who()).toBe("nobody");
  });

  it("the second step: the code with the userId gives the session; a wrong code is refused with the server's reason and stores nothing", async () => {
    mount();
    await waitFor(() => expect(who()).toBe("nobody"));
    route = () => ({ ok: false, status: 401, body: { error: "Incorrect authenticator code. Please try again." } });
    await act(async () => { await expect(api().completeTwoFactor("u9", "000000")).rejects.toThrow("Incorrect authenticator code. Please try again."); });
    expect(getAuthToken()).toBeNull();
    route = () => ({ body: { token: "tok-2", user: user({ id: "u9" }) } });
    await act(async () => { await api().completeTwoFactor("u9", "123456"); });
    expect(calls.at(-1)).toMatchObject({ url: expect.stringMatching(/\/auth\/login\/2fa$/), body: { userId: "u9", code: "123456" } });
    expect(getAuthToken()).toBe("tok-2");
    expect(who()).toBe("sam@example.com|-");
  });

  it("CRITICAL: a reply with no token (or no user) is never turned into a session", async () => {
    mount();
    await waitFor(() => expect(who()).toBe("nobody"));
    route = () => ({ body: { user: user() } });
    await act(async () => { await expect(api().login("a@b.co", "pw123456")).rejects.toThrow(); });
    route = () => ({ body: { token: "tok" } });
    await act(async () => { await expect(api().completeTwoFactor("u1", "123456")).rejects.toThrow(); });
    await act(async () => { await expect(api().signup("a@b.co", "pw123456")).rejects.toThrow(); });
    expect(getAuthToken()).toBeNull();
  });

  it("CRITICAL: when the server cannot be reached the buyer reads a clear message, not the browser's 'Failed to fetch', and nothing is signed in", async () => {
    mount();
    await waitFor(() => expect(who()).toBe("nobody"));
    globalThis.fetch = vi.fn(async () => { throw new TypeError("Failed to fetch"); }) as unknown as typeof fetch;
    await act(async () => { await expect(api().login("sam@example.com", "pw123456")).rejects.toThrow("We can't reach the server. Please check your connection and try again."); });
    expect(getAuthToken()).toBeNull();
    setErrorLanguage("ar");
    await act(async () => { await expect(api().login("sam@example.com", "pw123456")).rejects.toThrow(/[\u0600-\u06FF]/); });
  });

  it("errors are in the page's language when the app has a translation, English otherwise", async () => {
    mount();
    await waitFor(() => expect(who()).toBe("nobody"));
    const [english, arabic] = Object.entries(SERVER_MESSAGES_AR)[0];
    route = () => ({ ok: false, status: 401, body: { error: english } });
    setErrorLanguage("ar");
    await act(async () => { await expect(api().login("a@b.co", "x")).rejects.toThrow(arabic); });
    route = () => ({ ok: false, status: 400, body: { error: "A message nobody translated" } });
    await act(async () => { await expect(api().login("a@b.co", "x")).rejects.toThrow("A message nobody translated"); });
  });
});

describe("signing up, the session and the cookie", () => {
  it("sign-up sends the name and the referral code only when they were given", async () => {
    mount();
    await waitFor(() => expect(who()).toBe("nobody"));
    route = () => ({ body: { token: "tok-3", user: user() } });
    await act(async () => { await api().signup("a@b.co", "pw123456"); });
    expect(calls.at(-1)?.body).toEqual({ email: "a@b.co", password: "pw123456" });
    await act(async () => { await api().signup("a@b.co", "pw123456", "REF1", "  Sam  "); });
    expect(calls.at(-1)?.body).toEqual({ email: "a@b.co", password: "pw123456", referralCode: "REF1", name: "Sam" });
  });

  it("CRITICAL: the sign-in cookie is SameSite=Lax (not sent with a form posted from another site), and Secure when the site is on https", async () => {
    const writes: string[] = [];
    const descriptor = Object.getOwnPropertyDescriptor(Document.prototype, "cookie") as PropertyDescriptor;
    Object.defineProperty(document, "cookie", { configurable: true, get: () => descriptor.get!.call(document), set: (v: string) => { writes.push(v); descriptor.set!.call(document, v); } });
    route = () => ({ body: { token: "tok-4", user: user() } });
    mount();
    await waitFor(() => expect(who()).toBe("nobody"));
    await act(async () => { await api().login("a@b.co", "pw123456"); });
    expect(writes.at(-1)).toMatch(/leap_auth_token=tok-4; path=\/; SameSite=Lax; max-age=\d+/);
    expect(writes.at(-1)).not.toMatch(/Secure/);                                                            // this test site is http
    vi.stubGlobal("location", { protocol: "https:" });
    await act(async () => { await api().login("a@b.co", "pw123456"); });
    expect(writes.at(-1)).toMatch(/; SameSite=Lax; Secure; max-age=/);
    act(() => api().logout());
    expect(writes.at(-1)).toMatch(/leap_auth_token=; path=\/; SameSite=Lax; Secure; max-age=0/);
    delete (document as unknown as Record<string, unknown>).cookie;
  });

  it("a saved session is picked up on load; a token the server no longer accepts is thrown away", async () => {
    document.cookie = "leap_auth_token=good; path=/";
    route = (url) => (url.endsWith("/auth/me") ? { body: user({ twoFactorEnabled: true }) } : { body: {} });
    const first = mount();
    await waitFor(() => expect(who()).toBe("sam@example.com|true"));
    expect(calls[0].auth).toBe("Bearer good");
    first.unmount();
    document.cookie = "leap_auth_token=stale; path=/";
    route = () => ({ ok: false, status: 401, body: { error: "Invalid token" } });
    mount();
    await waitFor(() => expect(who()).toBe("nobody"));
    expect(getAuthToken()).toBeNull();
  });

  it("CRITICAL: adopting a new session (after changing the email) switches the token and keeps the rest of the buyer; refreshing reads them again", async () => {
    document.cookie = "leap_auth_token=old; path=/";
    route = (url) => (url.endsWith("/auth/me") ? { body: user({ twoFactorEnabled: false, avatarUrl: "/a.jpg" }) } : { body: {} });
    mount();
    await waitFor(() => expect(who()).toContain("sam@example.com"));
    act(() => api().adoptSession("new-token", user({ email: "new@example.com" })));
    expect(getAuthToken()).toBe("new-token");
    expect(who()).toBe("new@example.com|false");                                                            // email changed, the other fields kept
    route = () => ({ body: user({ email: "new@example.com", twoFactorEnabled: true }) });
    await act(async () => { await api().refreshUser(); });
    expect(who()).toBe("new@example.com|true");
    expect(calls.at(-1)?.auth).toBe("Bearer new-token");
  });

  it("signing out clears the session", async () => {
    document.cookie = "leap_auth_token=good; path=/";
    route = () => ({ body: user() });
    mount();
    await waitFor(() => expect(who()).toContain("sam@"));
    act(() => api().logout());
    expect(who()).toBe("nobody");
    expect(getAuthToken()).toBeNull();
  });
});
