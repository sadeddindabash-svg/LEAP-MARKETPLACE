import { describe, it, expect, beforeEach, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

// END TO END, with the REAL account pages, the REAL sign-in provider and the REAL backend and database: only the router is replaced. What the buyer does on the page is
// checked afterwards on the server.
const BACKEND = "http://localhost:4000";
const up = await (async () => { try { return (await fetch(`${BACKEND}/health`)).ok; } catch { return false; } })();
const nav = vi.hoisted(() => ({ push: vi.fn(), search: { current: new URLSearchParams() } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: nav.push, replace: vi.fn() }), useSearchParams: () => nav.search.current, usePathname: () => "/account" }));

import { AuthProvider, getAuthToken, useAuth } from "@/components/AuthProvider";
import { LangProvider } from "@/components/LangProvider";
import LoginPage from "./login/page";
import SignupPage from "./signup/page";
import ForgotPasswordPage from "./forgot-password/page";
import AccountPage from "./account/page";
import ChangeEmailPage from "./account/change-email/page";
import TwoFactorPage from "./account/two-factor/page";
import { confirmTwoFactor, setupTwoFactor } from "@/lib/api";
import { currentCode } from "@/lib/testTotp";

const PASSWORD = "stage4_e2e_password";
const T = { timeout: 25000 };
let n = 0;
async function post(path: string, body: unknown, token?: string) {
  const res = await fetch(`${BACKEND}${path}`, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}
async function me(token: string) { const res = await fetch(`${BACKEND}/auth/me`, { headers: { Authorization: `Bearer ${token}` } }); return { status: res.status, body: await res.json().catch(() => ({})) }; }
async function newBuyer(name = "E2E Four") {
  const email = `e2e4-${Date.now()}-${++n}@leap.dev`;
  const res = await post("/auth/signup", { email, password: PASSWORD, name });
  return { email, token: res.body.token as string, id: res.body.user.id as string };
}
const signedIn = (token: string) => { document.cookie = `leap_auth_token=${encodeURIComponent(token)}; path=/`; };
const clearCookies = () => { for (const c of document.cookie.split("; ")) document.cookie = `${c.split("=")[0]}=; path=/; max-age=0`; };
function Who() { const { user } = useAuth(); return <p data-testid="who">{user ? user.email : "nobody"}</p>; }
const shell = (page: React.ReactNode) => render(<LangProvider lang="en"><AuthProvider>{page}<Who /></AuthProvider></LangProvider>);
const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

beforeEach(() => { clearCookies(); nav.push.mockClear(); nav.search.current = new URLSearchParams(); });

describe.runIf(up)("stage 4a end to end: the real account pages against the real server", () => {
  it("CRITICAL (the original bug): an account with two-step sign-in signs in through the REAL login page: the password asks for a code, no session exists until the real code is given", async () => {
    const buyer = await newBuyer();
    const setup = await setupTwoFactor(buyer.token);
    await confirmTwoFactor(buyer.token, await currentCode(setup.secret));
    nav.search.current = new URLSearchParams("next=%2Fcheckout");

    shell(<LoginPage />);
    type("Email", buyer.email); type("Password", PASSWORD);
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Enter the 6-digit code from your authenticator app.", undefined, T)).toBeInTheDocument();
    expect(getAuthToken()).toBeNull();                                                                       // the password alone is not a session
    expect(nav.push).not.toHaveBeenCalled();
    expect(screen.getByTestId("who")).toHaveTextContent("nobody");

    type("6-digit code", await currentCode(setup.secret));
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith("/checkout", undefined), T);
    const token = getAuthToken();
    expect(token).toBeTruthy();
    expect((await me(token as string)).body).toMatchObject({ email: buyer.email, twoFactorEnabled: true });
    await waitFor(() => expect(screen.getByTestId("who")).toHaveTextContent(buyer.email), T);
  }, 120000);

  it("a wrong code on the real login page is refused with the server's words and nothing is signed in", async () => {
    const buyer = await newBuyer();
    const setup = await setupTwoFactor(buyer.token);
    await confirmTwoFactor(buyer.token, await currentCode(setup.secret));
    shell(<LoginPage />);
    type("Email", buyer.email); type("Password", PASSWORD);
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await screen.findByText("Enter the 6-digit code from your authenticator app.", undefined, T);
    type("6-digit code", "000000");
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));
    expect(await screen.findByRole("alert", undefined, T)).toHaveTextContent("Incorrect authenticator code");
    expect(getAuthToken()).toBeNull();
  }, 120000);

  it("a normal sign-in works through the real page, and an address to another site in ?next= is ignored", async () => {
    const buyer = await newBuyer();
    nav.search.current = new URLSearchParams("next=https%3A%2F%2Fevil.example");
    shell(<LoginPage />);
    type("Email", buyer.email); type("Password", PASSWORD);
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith("/", undefined), T);
    expect(getAuthToken()).toBeTruthy();
  }, 60000);

  it("the real sign-up page creates an account that can sign in, with the name that was given", async () => {
    const email = `e2e4-signup-${Date.now()}@leap.dev`;
    shell(<SignupPage />);
    type("Email", email); type("Password", PASSWORD); type("Name (optional)", "New Buyer");
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(nav.push).toHaveBeenCalled(), T);
    const token = getAuthToken() as string;
    expect((await me(token)).body).toMatchObject({ email, name: "New Buyer" });
    expect((await post("/auth/login", { email, password: PASSWORD })).status).toBe(200);
  }, 60000);

  it("CRITICAL: the real change-email page: the new token is adopted (the buyer stays signed in), the new email signs in and the old one does not", async () => {
    const buyer = await newBuyer();
    signedIn(buyer.token);
    const newEmail = `e2e4-changed-${Date.now()}@leap.dev`;
    shell(<ChangeEmailPage />);
    expect(await screen.findByText(buyer.email, { selector: "strong" }, T)).toBeInTheDocument();          // the current email on the page (the probe shows it too)
    type("New email", newEmail); type("Current password", PASSWORD);
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Your email has been updated.", undefined, T)).toBeInTheDocument();
    const token = getAuthToken() as string;
    expect(token).not.toBe(buyer.token);                                                                     // a new token
    expect((await me(token)).body.email).toBe(newEmail);
    await waitFor(() => expect(screen.getByTestId("who")).toHaveTextContent(newEmail), T);
    expect((await post("/auth/login", { email: newEmail, password: PASSWORD })).status).toBe(200);
    expect((await post("/auth/login", { email: buyer.email, password: PASSWORD })).status).toBe(401);
  }, 120000);

  it("CRITICAL: the real two-factor page turns it on with the code from the QR secret it shows, and off with the password; the server agrees each time", async () => {
    const buyer = await newBuyer();
    signedIn(buyer.token);
    shell(<TwoFactorPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Turn on two-factor authentication" }, T));
    const qr = await screen.findByAltText("QR code for your authenticator app", undefined, T);
    expect(qr.getAttribute("src")).toMatch(/^data:image\/png;base64,/);
    const secret = (screen.getByText(/[A-Z2-7]{16,}/, { selector: "code" }).textContent || "").trim();
    type("Then enter the 6-digit code it shows:", await currentCode(secret));
    fireEvent.click(screen.getByRole("button", { name: "Confirm and turn on" }));
    expect(await screen.findByText("Two-factor authentication is now on.", undefined, T)).toBeInTheDocument();
    expect((await me(buyer.token)).body.twoFactorEnabled).toBe(true);
    expect((await post("/auth/login", { email: buyer.email, password: PASSWORD })).body.requiresTwoFactor).toBe(true);

    await screen.findByText("Two-factor authentication is on.", undefined, T);
    type("Enter your current password to turn it off:", PASSWORD);
    fireEvent.click(screen.getByRole("button", { name: "Turn off two-factor authentication" }));
    expect(await screen.findByText("Two-factor authentication is now off.", undefined, T)).toBeInTheDocument();
    expect((await me(buyer.token)).body.twoFactorEnabled).toBe(false);
  }, 120000);

  it("CRITICAL: the real account page shows the buyer, and deleting the account through its two steps really deletes it and signs out", async () => {
    const buyer = await newBuyer("Delete Me");
    signedIn(buyer.token);
    shell(<AccountPage />);
    expect(await screen.findByRole("heading", { level: 1 }, T)).toHaveTextContent("Delete Me");
    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.change(screen.getByLabelText("Confirm your password"), { target: { value: "wrong-password" } });
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete" }));
    expect(await screen.findByRole("alert", undefined, T)).toHaveTextContent("Incorrect password");
    expect((await post("/auth/login", { email: buyer.email, password: PASSWORD })).status).toBe(200);        // a wrong password deleted nothing
    fireEvent.change(screen.getByLabelText("Confirm your password"), { target: { value: PASSWORD } });
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith("/", undefined), T);
    expect(getAuthToken()).toBeNull();
    expect((await post("/auth/login", { email: buyer.email, password: PASSWORD })).status).toBe(401);
  }, 120000);

  it("the real forgot-password page accepts a registered email and answers with the neutral sentence", async () => {
    const buyer = await newBuyer();
    shell(<ForgotPasswordPage />);
    type("Email", buyer.email);
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(await screen.findByText("If that email is registered, a reset link has been sent.", undefined, T)).toBeInTheDocument();
  }, 60000);
});
