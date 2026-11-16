import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { stockedProduct } from '@/lib/testSupport';
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

// END TO END, with the REAL order pages, the REAL cart and sign-in providers and the REAL backend and database: only the router is replaced. What the buyer does on the page is
// checked afterwards on the server.
const BACKEND = "http://localhost:4000";
const up = await (async () => { try { return (await fetch(`${BACKEND}/health`)).ok; } catch { return false; } })();

const nav = vi.hoisted(() => ({ push: vi.fn(), route: { current: { id: "" } }, search: { current: new URLSearchParams() } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: nav.push, replace: vi.fn() }), useSearchParams: () => nav.search.current, useParams: () => nav.route.current, usePathname: () => "/orders" }));

import { AuthProvider } from "@/components/AuthProvider";
import { CartProvider } from "@/components/CartProvider";
import { LangProvider } from "@/components/LangProvider";
import OrderPage from "./orders/[id]/page";
import OrdersPage from "./orders/page";
import TrackingPage from "./orders/[id]/tracking/page";
import { createAddress, fetchCart, fetchMyReturnCases, fetchOrderById, placeOrder } from "@/lib/api";
import { addressPayload, EMPTY_ADDRESS } from "@/lib/address";
import { needsEnglishAddressCheck } from "@/lib/orders";

let n = 0;
const T = { timeout: 25000 };
const clearCookies = () => { for (const c of document.cookie.split("; ")) document.cookie = `${c.split("=")[0]}=; path=/; max-age=0`; };
async function product() {
  return stockedProduct();          // restocks when earlier runs used the stock up (see lib/testSupport.ts)
}
async function newBuyer() {
  const email = `e2e3-${Date.now()}-${++n}@leap.dev`;
  const res = await fetch(`${BACKEND}/auth/signup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "e2e_password_123", name: "E2E" }) });
  const { token, user } = await res.json();
  return { token: token as string, id: user.id as string, email };
}
const address = { recipientName: "E2E Buyer", phone: "+968 1", country: "Oman", city: "Muscat", streetAddress: "12 Al Noor St" };
async function signedInOrder(over: Partial<typeof address> = {}) {
  const item = await product(); const buyer = await newBuyer();
  const saved = await createAddress(buyer.token, addressPayload({ ...EMPTY_ADDRESS, label: "Home", ...address, ...over }));
  const order = await placeOrder([{ productId: item.id, quantity: 1 }], { userId: buyer.id }, { addressId: saved.id });
  document.cookie = `leap_auth_token=${encodeURIComponent(buyer.token)}; path=/`;
  return { item, buyer, orderId: order.id };
}
const shell = (page: React.ReactNode, lang: "en" | "ar" = "en") => render(<LangProvider lang={lang}><AuthProvider><CartProvider>{page}</CartProvider></AuthProvider></LangProvider>);
const orderPage = (id: string, search = "") => { nav.route.current = { id }; nav.search.current = new URLSearchParams(search); return <OrderPage />; };

beforeEach(() => { clearCookies(); nav.push.mockClear(); nav.search.current = new URLSearchParams(); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe.runIf(up)("stage 3a end to end: the real order pages against the real server", () => {
  it("CRITICAL: a GUEST opens their order from the link, cancels it on the page, and the server says cancelled", async () => {
    const item = await product();
    const email = `e2e3-guest-${Date.now()}@example.com`;
    const placed = await placeOrder([{ productId: item.id, quantity: 1 }], { guestEmail: email }, { address });
    shell(orderPage(placed.id, `guestEmail=${encodeURIComponent(email)}`));
    expect(await screen.findByRole("heading", { level: 1 }, T)).toHaveTextContent(placed.id);
    expect(await screen.findByText(item.name, { exact: false }, T)).toBeInTheDocument();
    expect(screen.getByText("You are viewing this order as a guest.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel order" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancel order" }));
    expect(await screen.findByText("Order cancelled.", undefined, T)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("button", { name: "Cancel order" })).not.toBeInTheDocument(), T);
    expect((await fetchOrderById(null, placed.id, email)).status).toBe("cancelled");
  }, 120000);

  it("CRITICAL: a signed-in buyer sees their orders list with the active shipment counted, and Reorder puts the items in their REAL cart", async () => {
    const { item, orderId } = await signedInOrder();
    const first = shell(<OrdersPage />);
    expect(await screen.findByText(orderId, undefined, T)).toBeInTheDocument();
    expect(screen.getByText("Active Shipments").previousElementSibling).toHaveTextContent("1");
    first.unmount();

    const cartId = `e2e3-cart-${Date.now()}`;
    document.cookie = `leap_cart_id=${cartId}; path=/`;
    shell(orderPage(orderId));
    fireEvent.click(await screen.findByRole("button", { name: "Reorder" }, T));
    expect(await screen.findByText("1 item(s) added to your cart.", undefined, T)).toBeInTheDocument();
    expect((await fetchCart(cartId)).items.map((i) => i.productId)).toEqual([item.id]);
  }, 120000);

  it("the receipt button downloads a real PDF from the server", async () => {
    const { orderId } = await signedInOrder();
    let saved: Blob | null = null;
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn((b: Blob) => { saved = b; return "blob:e2e"; }), revokeObjectURL: vi.fn() }));
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    shell(orderPage(orderId));
    fireEvent.click(await screen.findByRole("button", { name: "Download receipt" }, T));
    await waitFor(() => expect(saved).not.toBeNull(), T);
    const bytes = new Uint8Array(await (saved as unknown as Blob).arrayBuffer());
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  }, 120000);

  it("CRITICAL: a return request made on the page really exists on the server, and the buyer is given the link to it", async () => {
    const { buyer, orderId } = await signedInOrder();
    shell(orderPage(orderId));
    fireEvent.click(await screen.findByRole("button", { name: "Request a return" }, T));
    fireEvent.change(screen.getByLabelText("Reason (e.g. wrong item, damaged)"), { target: { value: "Damaged" } });
    fireEvent.change(screen.getByLabelText("Details"), { target: { value: "Arrived cracked" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit request" }));
    const link = await screen.findByRole("link", { name: "View your return request" }, T);
    const cases = await fetchMyReturnCases(buyer.token);
    expect(cases).toHaveLength(1);
    expect(link.getAttribute("href")).toBe(`/returns/${cases[0].id}`);
    expect(cases[0]).toMatchObject({ orderId, reason: "Damaged" });
  }, 120000);

  it("CRITICAL: an Arabic address shows the English check on the page, and 'It is correct' confirms it on the server", async () => {
    const { buyer, orderId } = await signedInOrder({ recipientName: "سام", city: "مسقط", streetAddress: "شارع النور 12" });
    expect(needsEnglishAddressCheck(await fetchOrderById(buyer.token, orderId))).toBe(true);
    shell(orderPage(orderId));
    expect(await screen.findByRole("heading", { name: "Check your address in English" }, T)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "It is correct" }));
    expect(await screen.findByText("Thank you, your address is confirmed.", undefined, T)).toBeInTheDocument();
    expect(needsEnglishAddressCheck(await fetchOrderById(buyer.token, orderId))).toBe(false);
  }, 120000);

  it("the real tracking page shows the real order's parts to a guest, in Arabic, and the order page in Arabic is all Arabic", async () => {
    const item = await product();
    const email = `e2e3-guest-${Date.now()}@example.com`;
    const placed = await placeOrder([{ productId: item.id, quantity: 1 }], { guestEmail: email }, { address });
    nav.route.current = { id: placed.id }; nav.search.current = new URLSearchParams(`guestEmail=${encodeURIComponent(email)}`);
    const t = shell(<TrackingPage />, "ar");
    expect(await screen.findByRole("heading", { level: 1 }, T)).toHaveTextContent("تتبع الطلب");
    expect(await screen.findByRole("link", { name: new RegExp(placed.id) }, T)).toBeInTheDocument();                  // the link back to the order, in Arabic
    t.unmount();
    shell(orderPage(placed.id, `guestEmail=${encodeURIComponent(email)}`), "ar");
    expect(await screen.findByRole("button", { name: "إعادة الطلب" }, T)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "إلغاء الطلب" })).toBeInTheDocument();
    expect(screen.getByText(/المورد LEAP-SLR-/)).toBeInTheDocument();
  }, 120000);
});
