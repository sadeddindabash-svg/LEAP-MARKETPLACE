import { describe, it, expect, beforeEach, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

// END TO END, with the REAL pages, the REAL sign-in and cart providers and the REAL backend and database: only the router is replaced. What the buyer does on the page is
// checked afterwards on the server.
const BACKEND = "http://localhost:4000";
const up = await (async () => { try { return (await fetch(`${BACKEND}/health`)).ok; } catch { return false; } })();
const nav = vi.hoisted(() => ({ push: vi.fn(), search: { current: new URLSearchParams() }, route: { current: { id: "" } } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: nav.push, replace: vi.fn() }), useSearchParams: () => nav.search.current, useParams: () => nav.route.current, usePathname: () => "/part-requests" }));

import { AuthProvider } from "@/components/AuthProvider";
import { CartProvider } from "@/components/CartProvider";
import { GarageProvider } from "@/components/GarageProvider";
import { LangProvider } from "@/components/LangProvider";
import NewRequestPage from "./part-requests/new/page";
import RequestDetailPage from "./part-requests/[id]/page";
import MyRequestsPage from "./part-requests/page";
import ReferralsPage from "./referrals/page";
import SavedSearchesPage from "./saved-searches/page";
import WishlistPage from "./wishlist/page";
import { addToWishlist, createQuoteRequest, addQuoteRequestItem, createSavedSearch, fetchMyQuoteRequests, fetchMyReferral, fetchSavedSearches, fetchWishlist, submitQuoteRequest } from "@/lib/api";
import { stockedProduct } from "@/lib/testSupport";

const T = { timeout: 25000 };
let n = 0;
const clearCookies = () => { for (const c of document.cookie.split("; ")) document.cookie = `${c.split("=")[0]}=; path=/; max-age=0`; };
async function newBuyer(name = "E2E Fourb", referralCode?: string) {
  const email = `e2e4b-${Date.now()}-${++n}@leap.dev`;
  const res = await fetch(`${BACKEND}/auth/signup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "e2e_password_123", name, ...(referralCode ? { referralCode } : {}) }) });
  const { token, user } = await res.json();
  document.cookie = `leap_auth_token=${encodeURIComponent(token)}; path=/`;
  return { token: token as string, id: user.id as string, email };
}
const shell = (page: React.ReactNode, lang: "en" | "ar" = "en") => render(<LangProvider lang={lang}><AuthProvider><GarageProvider><CartProvider>{page}</CartProvider></GarageProvider></AuthProvider></LangProvider>);
const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const choose = (label: string, optionText: string) => { const select = screen.getByLabelText(label) as HTMLSelectElement; const option = [...select.options].find((o) => o.textContent === optionText); if (!option) throw new Error(`no option "${optionText}" in ${label}`); fireEvent.change(select, { target: { value: option.value } }); };

beforeEach(() => { clearCookies(); nav.push.mockClear(); nav.search.current = new URLSearchParams(); });

describe.runIf(up)("stage 4b end to end: the real pages against the real server", () => {
  it("CRITICAL: a buyer requests a quote through the REAL pages: picks BMW 1 Series 2017 from the real vehicle lists, adds two parts, sends it; the server has a submitted request with both; they cancel it from its page", async () => {
    const buyer = await newBuyer();
    shell(<NewRequestPage />);
    await waitFor(() => expect((screen.getByLabelText("Brand") as HTMLSelectElement).options.length).toBeGreaterThan(1), T);
    choose("Brand", "BMW");
    await waitFor(() => expect([...(screen.getByLabelText("Model") as HTMLSelectElement).options].some((o) => o.textContent === "1 Series")).toBe(true), T);
    choose("Model", "1 Series");
    await waitFor(() => expect([...(screen.getByLabelText("Year") as HTMLSelectElement).options].some((o) => o.textContent === "2017")).toBe(true), T);
    choose("Year", "2017");
    fireEvent.click(screen.getByRole("button", { name: "Start request" }));

    await screen.findByLabelText("Part name", undefined, T);                                              // the parts step appears once the request was started
    type("Part name", "Rear door handle");
    type("Quantity", "2"); fireEvent.click(screen.getByRole("button", { name: "Add item (0/20)" }));
    await screen.findByText("Qty: 2", undefined, T);
    type("Part name", "Left wing mirror"); fireEvent.click(await screen.findByRole("button", { name: "Add item (1/20)" }, T));
    await screen.findByText("Left wing mirror", undefined, T);
    fireEvent.click(screen.getByRole("button", { name: "Submit request" }));
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith("/part-requests", undefined), T);

    const mine = await fetchMyQuoteRequests(buyer.token);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ status: "submitted", brand: "BMW", year: 2017 });
    expect(mine[0].items.map((i) => `${i.name} x${i.quantity}`).sort()).toEqual(["Left wing mirror x1", "Rear door handle x2"]);
  }, 120000);

  it("the real detail page shows a sent request's banner and cancels it (asked first); the server says cancelled", async () => {
    const buyer = await newBuyer();
    const draft = await createQuoteRequest(buyer.token, "gen_bmw_1_series_f20", 2017);
    await addQuoteRequestItem(buyer.token, draft.id, { name: "Fog light" });
    await submitQuoteRequest(buyer.token, draft.id);
    nav.route.current = { id: draft.id };
    shell(<RequestDetailPage />);
    expect(await screen.findByText("Awaiting a quote from our team.", undefined, T)).toBeInTheDocument();
    expect(screen.getByText("Fog light")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel this request" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancel request" }));
    expect(await screen.findByText("This request was cancelled.", undefined, T)).toBeInTheDocument();
    expect((await fetchMyQuoteRequests(buyer.token))[0].status).toBe("cancelled");
  }, 120000);

  it("the real My requests list shows a buyer's request with its status", async () => {
    const buyer = await newBuyer();
    const draft = await createQuoteRequest(buyer.token, "gen_bmw_1_series_f20", 2018);
    await addQuoteRequestItem(buyer.token, draft.id, { name: "Bumper" });
    shell(<MyRequestsPage />);
    expect(await screen.findByText("Draft", undefined, T)).toBeInTheDocument();
    expect(screen.getByText("For BMW 1 Series · 2018")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /For BMW/ }).getAttribute("href")).toBe(`/part-requests/${draft.id}`);
  }, 60000);

  it("the real referrals page shows the buyer's real code and, after a friend signs up with it, the friend in the history", async () => {
    const buyer = await newBuyer("Layla Host");
    const { code } = await fetchMyReferral(buyer.token);
    const friend = await fetch(`${BACKEND}/auth/signup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: `e2e4b-friend-${Date.now()}@leap.dev`, password: "e2e_password_123", name: "Omar Friend", referralCode: code }) });
    expect(friend.status).toBe(201);
    shell(<ReferralsPage />);
    expect(await screen.findByText(code, undefined, T)).toBeInTheDocument();
    expect(await screen.findByText("Omar joined", undefined, T)).toBeInTheDocument();
    expect(screen.getByText("People referred").previousElementSibling).toHaveTextContent("1");
  }, 60000);

  it("the real saved searches page lists a saved search and deleting it (asked first) removes it on the server", async () => {
    const buyer = await newBuyer();
    await createSavedSearch(buyer.token, { label: "Brake discs", searchTerm: "brake disc", category: "brake" });
    shell(<SavedSearchesPage />);
    expect(await screen.findByRole("link", { name: "Brake discs" }, T)).toHaveAttribute("href", "/search?q=brake+disc&category=brake");
    expect(screen.getByText(/Last checked|Not checked yet/)).toBeInTheDocument();                           // a search just saved has not been checked yet
    fireEvent.click(screen.getByRole("button", { name: "Delete: Brake discs" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.queryByRole("link", { name: "Brake discs" })).not.toBeInTheDocument(), T);
    expect(await fetchSavedSearches(buyer.token)).toEqual([]);
  }, 60000);

  it("the real wishlist page lists a saved part and removing it removes it on the server", async () => {
    const buyer = await newBuyer();
    const product = await stockedProduct();
    await addToWishlist(buyer.token, product.id);
    shell(<WishlistPage />);
    expect(await screen.findByText(product.name, undefined, T)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(screen.queryByText(product.name)).not.toBeInTheDocument(), T);
    expect(await fetchWishlist(buyer.token)).toEqual([]);
  }, 60000);
});
