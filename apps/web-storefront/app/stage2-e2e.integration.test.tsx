import { describe, it, expect, beforeEach, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

// END TO END, with the REAL pages, the REAL cart and sign-in providers and the REAL backend and database: only the router is replaced. A guest and a signed-in buyer each go
// through the checkout, and the order that really landed on the server is checked afterwards.
const BACKEND = "http://localhost:4000";
const up = await (async () => { try { return (await fetch(`${BACKEND}/health`)).ok; } catch { return false; } })();

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }), useSearchParams: () => new URLSearchParams(), usePathname: () => "/checkout" }));

import { AuthProvider } from "@/components/AuthProvider";
import { CartProvider } from "@/components/CartProvider";
import { LangProvider } from "@/components/LangProvider";
import CheckoutPage from "./checkout/page";
import CartPage from "./cart/page";
import AddressesPage from "./addresses/page";
import { addCartItem, fetchMyAddresses, fetchMyOrders, fetchProducts } from "@/lib/api";

let n = 0;
const clearCookies = () => { for (const c of document.cookie.split("; ")) document.cookie = `${c.split("=")[0]}=; path=/; max-age=0`; };
async function product() {
  const found = (await fetchProducts()).find((p) => p.stockQuantity >= 5 && p.price > 0);
  if (!found) throw new Error("No in-stock product: reseed the database");
  return found;
}
async function newBuyer() {
  const email = `e2e-${Date.now()}-${++n}@leap.dev`;
  const res = await fetch(`${BACKEND}/auth/signup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "e2e_password_123", name: "E2E" }) });
  const { token, user } = await res.json();
  return { token: token as string, id: user.id as string, email };
}
const shell = (page: React.ReactNode, lang: "en" | "ar" = "en") => render(<LangProvider lang={lang}><AuthProvider><CartProvider>{page}</CartProvider></AuthProvider></LangProvider>);
const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const T = { timeout: 20000 };

beforeEach(() => { clearCookies(); push.mockClear(); });

describe.runIf(up)("stage 2 end to end: the real pages, the real providers, the real server", () => {
  it("CRITICAL: a GUEST fills the cart, checks out and the order really exists with their address and email; the cart is empty afterwards", async () => {
    const item = await product();
    const cartId = `e2e-cart-${Date.now()}`;
    document.cookie = `leap_cart_id=${cartId}; path=/`;
    await addCartItem(cartId, item.id, 2);

    shell(<CheckoutPage />);
    expect(await screen.findByText(`${item.name} × 2`, undefined, T)).toBeInTheDocument();
    await screen.findByText("Prices are held for you while you check out.", undefined, T);        // the checkout locked the prices on the real server

    const email = `e2e-guest-${Date.now()}@example.com`;
    type("Email for order confirmation", email);
    type("Recipient name", "E2E Guest"); type("Phone", "+968 9000 0000"); type("Country", "Oman"); type("City", "Muscat"); type("Street address", "12 Al Noor St");
    fireEvent.click(screen.getByRole("button", { name: "Place order" }));
    await waitFor(() => expect(push).toHaveBeenCalled(), T);

    const url = String(push.mock.lastCall?.[0]);
    const match = /^\/checkout\/confirmation\?orderId=([^&]+)&guestEmail=(.+)$/.exec(url);
    expect(match, url).not.toBeNull();
    const orderId = decodeURIComponent(match![1]);
    expect(decodeURIComponent(match![2])).toBe(email);

    const real = await (await fetch(`${BACKEND}/order/${orderId}?guestEmail=${encodeURIComponent(email)}`)).json();       // the order that really landed
    expect(real.id).toBe(orderId);
    expect(JSON.stringify(real)).toContain("Muscat");
    expect(JSON.stringify(real)).toContain(item.id);

    const emptied = await (await fetch(`${BACKEND}/cart/${/leap_cart_id=([^;]*)/.exec(document.cookie)![1]}`)).json();     // the provider moved to a NEW empty cart
    expect(emptied.items).toEqual([]);
    expect(/leap_cart_id=([^;]*)/.exec(document.cookie)![1]).not.toBe(cartId);
  }, 120000);

  it("CRITICAL: a SIGNED-IN buyer checks out with their saved address and the order really belongs to them (the cart was loaded with their token)", async () => {
    const item = await product();
    const buyer = await newBuyer();
    document.cookie = `leap_auth_token=${encodeURIComponent(buyer.token)}; path=/`;
    const cartId = `e2e-cart-${Date.now()}`;
    document.cookie = `leap_cart_id=${cartId}; path=/`;
    await addCartItem(cartId, item.id, 1, { token: buyer.token });
    const address = await (await fetch(`${BACKEND}/addresses/me`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${buyer.token}` }, body: JSON.stringify({ label: "Home", recipientName: "E2E Buyer", phone: "+968 1", country: "Oman", city: "Sohar", streetAddress: "9 Coast Rd" }) })).json();

    shell(<CheckoutPage />);
    expect(await screen.findByText(buyer.email, undefined, T)).toBeInTheDocument();                // "Ordering as" the real signed-in buyer
    await waitFor(() => expect(screen.getByRole("radio", { name: /Home/ })).toBeChecked(), T);
    fireEvent.click(screen.getByRole("button", { name: "Place order" }));
    await waitFor(() => expect(push).toHaveBeenCalled(), T);

    const orders = await fetchMyOrders(buyer.token);
    expect(orders).toHaveLength(1);
    expect(String(push.mock.lastCall?.[0])).toBe(`/checkout/confirmation?orderId=${encodeURIComponent(orders[0].id)}`);
    const detail = await (await fetch(`${BACKEND}/order/${orders[0].id}`, { headers: { Authorization: `Bearer ${buyer.token}` } })).json();
    expect(JSON.stringify(detail)).toContain("Sohar");
    expect(address.id).toBeTruthy();
  }, 120000);

  it("the real cart page shows the real cart in Arabic, and removing a part removes it on the server", async () => {
    const item = await product();
    const cartId = `e2e-cart-${Date.now()}`;
    document.cookie = `leap_cart_id=${cartId}; path=/`;
    await addCartItem(cartId, item.id, 1);
    shell(<CartPage />, "ar");
    expect(await screen.findByRole("heading", { level: 1 }, T)).toHaveTextContent("السلة");
    expect(await screen.findByText(/المورد LEAP-SLR-/, undefined, T)).toBeInTheDocument();                // the supplier label, with the Arabic word
    fireEvent.click(await screen.findByRole("button", { name: "إزالة" }, T));
    await screen.findByText("سلتك فارغة.", undefined, T);
    expect((await (await fetch(`${BACKEND}/cart/${cartId}`)).json()).items).toEqual([]);
  }, 120000);

  it("CRITICAL: the real address book: a buyer adds an address and deletes it through the page, and the server agrees each time", async () => {
    const buyer = await newBuyer();
    document.cookie = `leap_auth_token=${encodeURIComponent(buyer.token)}; path=/`;
    shell(<AddressesPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Add address" }, T));
    type("Label (e.g. Home, Work)", "Office"); type("Recipient name", "E2E Buyer"); type("Phone", "+968 2"); type("Country", "Oman"); type("City", "Nizwa"); type("Street address", "3 Fort Rd");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Address saved", undefined, T)).toBeInTheDocument();
    const stored = await fetchMyAddresses(buyer.token);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ label: "Office", city: "Nizwa", country: "Oman", isDefault: true });

    fireEvent.click(await screen.findByRole("button", { name: "Delete" }, T));
    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    expect(await screen.findByText("Address deleted", undefined, T)).toBeInTheDocument();
    expect(await fetchMyAddresses(buyer.token)).toEqual([]);
  }, 120000);
});
