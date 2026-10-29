import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { OrderDetail, OrderSummary, SupplierSubOrder } from "@/lib/api";

// The orders pages (list, detail, tracking), with the server, the sign-in state, the cart and the router replaced by fixed values.
const m = vi.hoisted(() => ({
  user: { current: null as { id: string; email: string } | null },
  params: { current: new URLSearchParams() },
  route: { current: { id: "ord_1" } },
  push: vi.fn(),
  addItem: vi.fn(),
  api: {
    fetchMyOrders: vi.fn(), fetchAnnualSpend: vi.fn(), fetchOrderById: vi.fn(), fetchOrderReceipt: vi.fn(), cancelOrder: vi.fn(), cancelSubOrder: vi.fn(),
    confirmEnglishAddress: vi.fn(), createReturnCase: vi.fn(), uploadReviewPhoto: vi.fn(), fetchOrderTracking: vi.fn(),
  },
}));
vi.mock("@/components/AuthProvider", () => ({ useAuth: () => ({ user: m.user.current, isLoading: false }), getAuthToken: () => (m.user.current ? "tok" : null) }));
vi.mock("@/components/CartProvider", () => ({ useCart: () => ({ addItem: (...a: unknown[]) => m.addItem(...a) }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: m.push, replace: vi.fn() }), useSearchParams: () => m.params.current, useParams: () => m.route.current, usePathname: () => "/orders" }));
vi.mock("@/lib/api", () => ({
  fetchMyOrders: (...a: unknown[]) => m.api.fetchMyOrders(...a), fetchAnnualSpend: (...a: unknown[]) => m.api.fetchAnnualSpend(...a), fetchOrderById: (...a: unknown[]) => m.api.fetchOrderById(...a),
  fetchOrderReceipt: (...a: unknown[]) => m.api.fetchOrderReceipt(...a), cancelOrder: (...a: unknown[]) => m.api.cancelOrder(...a), cancelSubOrder: (...a: unknown[]) => m.api.cancelSubOrder(...a),
  confirmEnglishAddress: (...a: unknown[]) => m.api.confirmEnglishAddress(...a), createReturnCase: (...a: unknown[]) => m.api.createReturnCase(...a), uploadReviewPhoto: (...a: unknown[]) => m.api.uploadReviewPhoto(...a),
  fetchOrderTracking: (...a: unknown[]) => m.api.fetchOrderTracking(...a), resolveImageUrl: (u: string) => u,
}));

import OrdersPage from "./orders/page";
import OrderPage from "./orders/[id]/page";
import TrackingPage from "./orders/[id]/tracking/page";
import { LangProvider } from "@/components/LangProvider";

const hub = (status: string | null, proof: string[] = []) => (status ? { id: 1, status, updatedAt: "x", events: [], deliveryProof: proof.length ? { photos: proof.map((url) => ({ url, submittedAt: "x" })) } : null } : null);
const part = (subOrderId: number, status: string, hubStatus: string | null = null, over: Partial<SupplierSubOrder> = {}): SupplierSubOrder => ({
  subOrderId, supplierId: "s", supplierName: "Supplier LEAP-SLR-AB12", status, trackingNumber: null, hubId: null, hubName: null, hubShipment: hub(hubStatus),
  items: [{ productId: `p${subOrderId}`, name: `Part ${subOrderId}`, quantity: 2, unitPrice: 25, imageUrl: null }], ...over,
});
const order = (parts: SupplierSubOrder[], over: Partial<OrderDetail> = {}): OrderDetail => ({
  id: "ord_1", userId: "u1", guestEmail: null, isGuestOrder: false, status: "to_ship", displayStatus: "to_ship", total: 100, discountAmount: 0, promoCode: null, currencyCode: "USD", placedAt: "2026-10-01T10:00:00Z",
  address: { recipientName: "Sam", phone: "+968 1", country: "Oman", city: "Muscat", streetAddress: "1 Main St", postalCode: null, source: "buyer" }, supplierSubOrders: parts, ...over,
});
const orderPage = (id: string) => { m.route.current = { id }; return <OrderPage />; };
const trackingPage = (id: string) => { m.route.current = { id }; return <TrackingPage />; };
const show = (node: React.ReactNode, lang: "en" | "ar" = "en") => render(<LangProvider lang={lang}>{node}</LangProvider>);
const detail = async (id = "ord_1", lang: "en" | "ar" = "en") => { show(orderPage(id), lang); await screen.findByRole("heading", { level: 1 }); };
const buyer = () => { m.user.current = { id: "u1", email: "buyer@leap.dev" }; };

beforeEach(() => {
  vi.clearAllMocks();
  m.user.current = null; m.params.current = new URLSearchParams();
  m.api.fetchMyOrders.mockResolvedValue([]); m.api.fetchAnnualSpend.mockResolvedValue({ year: 2026, orderCount: 0, totalSpent: 0, currencyCode: "USD" });
  m.api.fetchOrderById.mockResolvedValue(order([part(1, "preparing")]));
  m.api.cancelOrder.mockResolvedValue({}); m.api.cancelSubOrder.mockResolvedValue({}); m.api.confirmEnglishAddress.mockResolvedValue({});
  m.api.createReturnCase.mockResolvedValue({ id: "RC-9" }); m.api.uploadReviewPhoto.mockResolvedValue("/uploads/x.jpg");
  m.api.fetchOrderReceipt.mockResolvedValue(new Blob(["%PDF"], { type: "application/pdf" }));
  m.api.fetchOrderTracking.mockResolvedValue({ orderId: "ord_1", subOrders: [] });
  m.addItem.mockResolvedValue(undefined);
});
afterEach(() => { vi.useRealTimers(); });

describe("orders list", () => {
  const summary = (id: string, displayStatus: string, total = 50): OrderSummary => ({ id, status: displayStatus, displayStatus, total, currencyCode: "USD", placedAt: "2026-10-01T10:00:00Z", supplierNames: ["Supplier LEAP-SLR-AB12"] });

  it("CRITICAL: a visitor who is not signed in is asked to sign in, and can still look an order up with its ID and email", () => {
    show(<OrdersPage />);
    expect(screen.getByText(/Log in to see your order history/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/login");
    fireEvent.click(screen.getByRole("button", { name: "Track" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Please fill in both fields.");
    expect(m.push).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Order ID"), { target: { value: " ord_77 " } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "sam@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Track" }));
    expect(m.push.mock.lastCall?.[0]).toBe("/orders/ord_77?guestEmail=sam%40example.com");
    expect(m.api.fetchMyOrders).not.toHaveBeenCalled();
  });

  it("CRITICAL: a signed-in buyer sees how many shipments are active, what they spent this year, and every order with its status", async () => {
    buyer();
    m.api.fetchMyOrders.mockResolvedValue([summary("ord_1", "shipped"), summary("ord_2", "delivered"), summary("ord_3", "to_ship"), summary("ord_4", "cancelled")]);
    m.api.fetchAnnualSpend.mockResolvedValue({ year: 2026, orderCount: 3, totalSpent: 320, currencyCode: "USD" });
    show(<OrdersPage />);
    expect(await screen.findByText("ord_1")).toBeInTheDocument();
    expect(m.api.fetchMyOrders).toHaveBeenCalledWith("tok");
    expect(screen.getByText("Active Shipments").previousElementSibling).toHaveTextContent("2");          // shipped and to_ship
    expect(screen.getByText("$320")).toBeInTheDocument();
    expect(screen.getByText("2026 SPEND")).toBeInTheDocument();
    const delivered = screen.getByText("ord_2").closest("a") as HTMLElement;
    expect(within(delivered).getByText("Delivered")).toBeInTheDocument();
    expect(delivered.getAttribute("href")).toBe("/orders/ord_2");
    expect(within(screen.getByText("ord_4").closest("a") as HTMLElement).getByText("Cancelled")).toBeInTheDocument();
  });

  it("with no orders it says so and points to the shop; in Arabic it is Arabic, with /ar links", async () => {
    buyer();
    const first = show(<OrdersPage />);
    expect(await screen.findByText("No orders yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse products" }).getAttribute("href")).toBe("/search");
    first.unmount();
    m.api.fetchMyOrders.mockResolvedValue([summary("ord_1", "to_ship")]);
    show(<OrdersPage />, "ar");
    expect(await screen.findByText("قيد الشحن")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("طلباتي");
    expect(screen.getByText(/المورد LEAP-SLR-AB12/)).toBeInTheDocument();
    expect(screen.getByText("ord_1").closest("a")?.getAttribute("href")).toBe("/ar/orders/ord_1");
  });
});

describe("order detail: seeing it", () => {
  it("CRITICAL: with neither a sign-in nor a guest email there is nothing to show but a way in", () => {
    show(orderPage("ord_1"));
    return screen.findByRole("link", { name: "Sign in" }).then(() => {
      expect(m.api.fetchOrderById).not.toHaveBeenCalled();
      expect(screen.getByRole("link", { name: "Track an order" }).getAttribute("href")).toBe("/orders");
    });
  });

  it("CRITICAL: a signed-in buyer's order shows its parts with their stage, tracking number, items, address and totals", async () => {
    buyer();
    m.api.fetchOrderById.mockResolvedValue(order([part(1, "shipped", "shipped_to_buyer", { trackingNumber: "TRK123" }), part(2, "preparing")], { discountAmount: 10, promoCode: "SAVE10", total: 90 }));
    await detail();
    expect(m.api.fetchOrderById).toHaveBeenCalledWith("tok", "ord_1", null);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Order ord_1");
    expect(screen.getByText("Placed on Oct 1, 2026")).toBeInTheDocument();
    expect(screen.getByText("TRK123")).toBeInTheDocument();
    expect(screen.getAllByText("Supplier LEAP-SLR-AB12")).toHaveLength(2);
    expect(screen.getByRole("list", { name: "Shipped" })).toBeInTheDocument();                               // the first part is on its way
    expect(screen.getByText("Part 1")).toBeInTheDocument();
    expect(screen.getByText((_, el) => el?.tagName === "P" && el.textContent === "1 Main St, Muscat, Oman")).toBeInTheDocument();
    expect(screen.getByText("Discount (SAVE10)")).toBeInTheDocument();
    expect(screen.getByText("$90")).toBeInTheDocument();
  });

  it("CRITICAL: a guest opens their order with the email in the address, and every link keeps it", async () => {
    m.params.current = new URLSearchParams("guestEmail=sam%40example.com");
    m.api.fetchOrderById.mockResolvedValue(order([part(1, "preparing")], { isGuestOrder: true, userId: null, guestEmail: "sam@example.com" }));
    await detail();
    expect(m.api.fetchOrderById).toHaveBeenCalledWith(null, "ord_1", "sam@example.com");
    expect(screen.getByText("You are viewing this order as a guest.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Track your package" }).getAttribute("href")).toBe("/orders/ord_1/tracking?guestEmail=sam%40example.com");
  });

  it("an order that is not there (or not theirs) says 'Not found', and a failure shows the server's reason", async () => {
    buyer();
    m.api.fetchOrderById.mockRejectedValue(new Error("Order not found"));
    const first = show(orderPage("nope"));
    expect(await screen.findByRole("heading", { name: "Not found" })).toBeInTheDocument();
    first.unmount();
    m.api.fetchOrderById.mockRejectedValue(new Error("Failed to load order (500)"));
    show(orderPage("x"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load this order. Failed to load order (500)");
  });

  it("proof of delivery photos are shown when the courier sent them", async () => {
    buyer();
    m.api.fetchOrderById.mockResolvedValue(order([part(1, "shipped", "delivered", { hubShipment: hub("delivered", ["/uploads/proof1.jpg", "/uploads/proof2.jpg"]) })]));
    await detail();
    expect(screen.getByText("Proof of delivery")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Proof of delivery" })).toHaveLength(2);
  });

  it("CRITICAL: in Arabic the page, the statuses and the actions are Arabic, and every link keeps /ar", async () => {
    buyer();
    await detail("ord_1", "ar");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("الطلب ord_1");
    expect(screen.getByRole("button", { name: "إعادة الطلب" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "تنزيل الإيصال" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "تتبع الطلب" }).getAttribute("href")).toBe("/ar/orders/ord_1/tracking");
    expect(screen.getByText("المورد LEAP-SLR-AB12")).toBeInTheDocument();
    expect(screen.getByText("الشحن إلى")).toBeInTheDocument();
  });
});

describe("order detail: cancelling", () => {
  it("CRITICAL: the whole order can be cancelled while every part can: it asks first, 'Back' changes nothing, confirming cancels and reloads", async () => {
    buyer();
    await detail();
    fireEvent.click(screen.getByRole("button", { name: "Cancel order" }));
    expect(screen.getByRole("alertdialog", { name: "Cancel this order?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(m.api.cancelOrder).not.toHaveBeenCalled();
    m.api.fetchOrderById.mockResolvedValue(order([part(1, "cancelled")], { status: "cancelled", displayStatus: "cancelled" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel order" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancel order" }));
    await waitFor(() => expect(m.api.cancelOrder).toHaveBeenCalledWith("ord_1", { token: "tok", guestEmail: null }));
    expect(await screen.findByText("Order cancelled.")).toBeInTheDocument();
    await waitFor(() => expect(m.api.fetchOrderById).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("button", { name: "Cancel order" })).not.toBeInTheDocument();                  // a cancelled order cannot be cancelled again
  });

  it("CRITICAL: a guest cancels with their email, not a token", async () => {
    m.params.current = new URLSearchParams("guestEmail=sam%40example.com");
    await detail();
    fireEvent.click(screen.getByRole("button", { name: "Cancel order" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancel order" }));
    await waitFor(() => expect(m.api.cancelOrder).toHaveBeenCalledWith("ord_1", { token: null, guestEmail: "sam@example.com" }));
  });

  it("CRITICAL: when some parts have already shipped the whole order cannot be cancelled, but each part that can still be gets its own button", async () => {
    buyer();
    m.api.fetchOrderById.mockResolvedValue(order([part(11, "shipped", "shipped_to_buyer"), part(12, "preparing")]));
    await detail();
    expect(screen.queryByRole("button", { name: "Cancel order" })).not.toBeInTheDocument();
    const buttons = screen.getAllByRole("button", { name: "Cancel this part" });
    expect(buttons).toHaveLength(1);                                                                          // only the part that has not shipped
    fireEvent.click(buttons[0]);
    fireEvent.click(within(screen.getByRole("alertdialog", { name: "Cancel this part?" })).getByRole("button", { name: "Cancel this part" }));
    await waitFor(() => expect(m.api.cancelSubOrder).toHaveBeenCalledWith("ord_1", 12, { token: "tok", guestEmail: null }));
    expect(await screen.findByText("Cancelled.")).toBeInTheDocument();
  });

  it("a refusal from the server (a part shipped meanwhile) is shown and the order is left as it was", async () => {
    buyer();
    m.api.cancelOrder.mockRejectedValue(new Error("This order can no longer be cancelled — at least one part has already shipped."));
    await detail();
    fireEvent.click(screen.getByRole("button", { name: "Cancel order" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancel order" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("at least one part has already shipped");
  });

  it("when everything is delivered there is nothing to cancel and nothing to track", async () => {
    buyer();
    m.api.fetchOrderById.mockResolvedValue(order([part(1, "shipped", "delivered")], { displayStatus: "delivered", status: "delivered" }));
    await detail();
    expect(screen.queryByRole("button", { name: /Cancel/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Track your package" })).not.toBeInTheDocument();
  });
});

describe("order detail: returns, address, receipt, reorder", () => {
  it("CRITICAL: a return request needs a reason and details; a signed-in buyer can attach up to 3 photos; it is sent for THAT part with the buyer's token", async () => {
    buyer();
    await detail();
    fireEvent.click(screen.getByRole("button", { name: "Request a return" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit request" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Please fill in both fields.");
    expect(m.api.createReturnCase).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Reason (e.g. wrong item, damaged)"), { target: { value: "Damaged" } });
    fireEvent.change(screen.getByLabelText("Details"), { target: { value: "Cracked on arrival" } });
    const picker = screen.getByLabelText("Attach photos (optional)", { selector: "input" });
    for (let i = 0; i < 3; i++) { await act(async () => { fireEvent.change(picker, { target: { files: [new File(["x"], `p${i}.jpg`, { type: "image/jpeg" })] } }); }); }
    await waitFor(() => expect(m.api.uploadReviewPhoto).toHaveBeenCalledTimes(3));
    expect(screen.queryByLabelText("Attach photos (optional)", { selector: "input" })).not.toBeInTheDocument();   // three is the limit
    fireEvent.click(screen.getByRole("button", { name: "Submit request" }));
    await waitFor(() => expect(m.api.createReturnCase).toHaveBeenCalledTimes(1));
    expect(m.api.createReturnCase.mock.lastCall).toEqual([{ subOrderId: 1, reason: "Damaged", message: "Cracked on arrival", photos: ["/uploads/x.jpg", "/uploads/x.jpg", "/uploads/x.jpg"] }, { token: "tok", guestEmail: null }]);
    expect(await screen.findByText(/Return request sent/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View your return request" }).getAttribute("href")).toBe("/returns/RC-9");
  });

  it("a guest can ask for a return too, with their email, but cannot attach photos (they are told)", async () => {
    m.params.current = new URLSearchParams("guestEmail=sam%40example.com");
    await detail();
    fireEvent.click(screen.getByRole("button", { name: "Request a return" }));
    expect(screen.getByText("Photos can be attached when you are signed in.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Reason (e.g. wrong item, damaged)"), { target: { value: "Wrong" } });
    fireEvent.change(screen.getByLabelText("Details"), { target: { value: "Not what I ordered" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit request" }));
    await waitFor(() => expect(m.api.createReturnCase).toHaveBeenCalled());
    expect(m.api.createReturnCase.mock.lastCall?.[1]).toEqual({ token: null, guestEmail: "sam@example.com" });
    expect((await screen.findByRole("link", { name: "View your return request" })).getAttribute("href")).toBe("/returns/RC-9?guestEmail=sam%40example.com");
  });

  it("CRITICAL: a request the server refuses (the return window passed) shows the server's reason and keeps the form", async () => {
    buyer();
    m.api.createReturnCase.mockRejectedValue(new Error("The return window (7 days after delivery) has passed for this order."));
    await detail();
    fireEvent.click(screen.getByRole("button", { name: "Request a return" }));
    fireEvent.change(screen.getByLabelText("Reason (e.g. wrong item, damaged)"), { target: { value: "Late" } });
    fireEvent.change(screen.getByLabelText("Details"), { target: { value: "Too late" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit request" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The return window (7 days after delivery) has passed");
    expect(screen.getByLabelText("Details")).toBeInTheDocument();
  });

  const english = (source: string) => ({ recipientName: "Sam Buyer", country: "Oman", city: "Muscat", streetAddress: "1 Main St", state: null, source, confirmed: source === "buyer", updatedAt: null });
  it("CRITICAL: while the English address is only a guess the buyer is asked to check it: 'It is correct' confirms it as it is", async () => {
    buyer();
    m.api.fetchOrderById.mockResolvedValue(order([part(1, "preparing")], { addressEnglish: english("auto") }));
    await detail();
    expect(screen.getByRole("heading", { name: "Check your address in English" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "It is correct" }));
    await waitFor(() => expect(m.api.confirmEnglishAddress).toHaveBeenCalledWith("ord_1", { token: "tok", guestEmail: null }, undefined));
    expect(await screen.findByText("Thank you, your address is confirmed.")).toBeInTheDocument();
  });

  it("CRITICAL: an edited English address must be complete and in English letters, or nothing is sent; a good edit is sent with the edits", async () => {
    buyer();
    m.api.fetchOrderById.mockResolvedValue(order([part(1, "preparing")], { addressEnglish: english("auto") }));
    await detail();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("City"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Please fill in the name, country, city and street.");
    fireEvent.change(screen.getByLabelText("City"), { target: { value: "مسقط" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Please write the address in English letters.");
    expect(m.api.confirmEnglishAddress).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("City"), { target: { value: " Salalah " } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(m.api.confirmEnglishAddress).toHaveBeenCalledTimes(1));
    expect(m.api.confirmEnglishAddress.mock.lastCall?.[2]).toEqual({ recipientName: "Sam Buyer", country: "Oman", city: "Salalah", streetAddress: "1 Main St" });
  });

  it("an address already confirmed is not asked about again", async () => {
    buyer();
    m.api.fetchOrderById.mockResolvedValue(order([part(1, "preparing")], { addressEnglish: english("buyer") }));
    await detail();
    expect(screen.queryByText("Check your address in English")).not.toBeInTheDocument();
  });

  it("CRITICAL: the receipt is fetched with the buyer's sign-in in a header (never in a link) and saved as a PDF in the page's language", async () => {
    buyer();
    const created: string[] = [];
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => { created.push("blob:x"); return "blob:x"; }), revokeObjectURL: vi.fn() }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    await detail("ord_1", "ar");
    fireEvent.click(screen.getByRole("button", { name: "تنزيل الإيصال" }));
    await waitFor(() => expect(m.api.fetchOrderReceipt).toHaveBeenCalledWith("ord_1", { token: "tok", guestEmail: null }, "ar"));
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    expect(created).toEqual(["blob:x"]);
    click.mockRestore(); vi.unstubAllGlobals();
  });

  it("CRITICAL: Reorder puts every item of the order back in the cart; items that cannot be added are named, and if none can it says so", async () => {
    buyer();
    m.api.fetchOrderById.mockResolvedValue(order([part(1, "delivered"), part(2, "delivered")]));
    await detail();
    fireEvent.click(screen.getByRole("button", { name: "Reorder" }));
    expect(await screen.findByText("2 item(s) added to your cart.")).toBeInTheDocument();
    expect(m.addItem.mock.calls).toEqual([["p1", 2], ["p2", 2]]);
    expect(screen.getByRole("link", { name: "View cart" }).getAttribute("href")).toBe("/cart");
    m.addItem.mockImplementation(async (id: string) => { if (id === "p1") throw new Error("gone"); });
    fireEvent.click(screen.getByRole("button", { name: "Reorder" }));
    expect(await screen.findByText("1 item(s) added. Could not add: Part 1")).toBeInTheDocument();
    m.addItem.mockRejectedValue(new Error("gone"));
    fireEvent.click(screen.getByRole("button", { name: "Reorder" }));
    expect(await screen.findByText("Could not add any item from this order right now.")).toBeInTheDocument();
  });
});

describe("tracking page", () => {
  const tracking = { orderId: "ord_1", subOrders: [{ subOrderId: 1, supplierTrackingNumber: "SUP1", hubTrackingNumber: "HUB1", isDelayed: true, timeline: [{ time: "2026-10-02T09:00:00Z", description: "Received at the hub", kind: "received", location: null, source: "hub" }, { time: "2026-10-03T09:00:00Z", description: "On its way to you", kind: "shipped_to_buyer", location: "Muscat", source: "hub" }] }] };

  it("CRITICAL: shows the tracking number, the delay notice and every step, and a guest's email is sent with the request", async () => {
    m.params.current = new URLSearchParams("guestEmail=sam%40example.com");
    m.api.fetchOrderTracking.mockResolvedValue(tracking);
    show(trackingPage("ord_1"));
    expect(await screen.findByText("HUB1")).toBeInTheDocument();                                               // the hub's number is the one the buyer can use
    expect(screen.getByText("This shipment is taking longer than expected. We're keeping an eye on it.")).toBeInTheDocument();
    expect(screen.getByText("Received at the hub")).toBeInTheDocument();
    expect(screen.getByText(/On its way to you/)).toBeInTheDocument();
    expect(m.api.fetchOrderTracking).toHaveBeenCalledWith("ord_1", { token: null, guestEmail: "sam@example.com" }, "en");
    expect(screen.getByRole("link", { name: "Order ord_1" }).getAttribute("href")).toBe("/orders/ord_1?guestEmail=sam%40example.com");
  });

  it("CRITICAL: it refreshes itself every 20 seconds while open, and stops when the page is left", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    buyer();
    m.api.fetchOrderTracking.mockResolvedValue(tracking);
    const { unmount } = show(trackingPage("ord_1"), "ar");
    await screen.findByText("HUB1");
    expect(m.api.fetchOrderTracking).toHaveBeenCalledTimes(1);
    expect(m.api.fetchOrderTracking.mock.lastCall).toEqual(["ord_1", { token: "tok", guestEmail: null }, "ar"]);       // Arabic steps asked for
    await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });
    expect(m.api.fetchOrderTracking).toHaveBeenCalledTimes(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });
    expect(m.api.fetchOrderTracking).toHaveBeenCalledTimes(3);
    unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(m.api.fetchOrderTracking).toHaveBeenCalledTimes(3);
  });

  it("no shipments, no updates yet and a failed load each say so", async () => {
    buyer();
    m.api.fetchOrderTracking.mockResolvedValue({ orderId: "ord_1", subOrders: [] });
    const a = show(trackingPage("ord_1"));
    expect(await screen.findByText("No shipments found for this order.")).toBeInTheDocument();
    a.unmount();
    m.api.fetchOrderTracking.mockResolvedValue({ orderId: "ord_1", subOrders: [{ subOrderId: 1, supplierTrackingNumber: null, hubTrackingNumber: null, isDelayed: false, timeline: [] }] });
    const b = show(trackingPage("ord_1"));
    expect(await screen.findByText(/No tracking updates yet/)).toBeInTheDocument();
    b.unmount();
    m.api.fetchOrderTracking.mockRejectedValue(new Error("down"));
    show(trackingPage("ord_1"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load tracking.");
  });
});
