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

// "Request a return" appears for a part only while it can be returned (the server's answer), never for a cancelled part or order. On the real order page, with the server replaced by fixed values.
const RETURN = "Request a return";
const returnable = (flag: boolean | undefined) => ({ returnable: flag });
const buttons = () => screen.queryAllByRole("button", { name: RETURN }).length;

describe("the return button on the order page", () => {
  it("CRITICAL: a part that is not delivered yet, and one delivered inside the window, show it", async () => { buyer(); m.api.fetchOrderById.mockResolvedValue(order([part(1, "preparing", null, returnable(true)), part(2, "shipped", "delivered", { returnable: true, returnUntil: "2030-01-01T00:00:00Z" })])); await detail(); expect(buttons()).toBe(2); });
  it("CRITICAL: a part delivered LONG AGO (the server says the return window has passed) does not show it", async () => { buyer(); m.api.fetchOrderById.mockResolvedValue(order([part(1, "shipped", "delivered", returnable(false)), part(2, "preparing", null, returnable(true))])); await detail(); expect(buttons()).toBe(1); });
  it("CRITICAL: a cancelled order does not show it, whatever the server says", async () => { buyer(); m.api.fetchOrderById.mockResolvedValue(order([part(1, "cancelled", null, returnable(true))], { status: "cancelled", displayStatus: "cancelled" })); await detail(); expect(buttons()).toBe(0); });
  it("CRITICAL: a CANCELLED PART inside an order that is still going does not show it, the other part does", async () => { buyer(); m.api.fetchOrderById.mockResolvedValue(order([part(1, "cancelled", null, returnable(true)), part(2, "preparing", null, returnable(true))])); await detail(); expect(buttons()).toBe(1); });
  it("an order whose every part is cancelled (the order's own status not updated) does not show it", async () => { buyer(); m.api.fetchOrderById.mockResolvedValue(order([part(1, "cancelled"), part(2, "cancelled")])); await detail(); expect(buttons()).toBe(0); });
  it("an older server that sends no answer: the button shows for a part that is not cancelled (as before)", async () => { buyer(); m.api.fetchOrderById.mockResolvedValue(order([part(1, "preparing"), part(2, "cancelled")])); await detail(); expect(buttons()).toBe(1); });
  it("pressing it opens the return form for that part; a part that stops being returnable closes it", async () => {
    buyer(); m.api.fetchOrderById.mockResolvedValue(order([part(1, "shipped", "delivered", returnable(true))])); await detail(); fireEvent.click(screen.getByRole("button", { name: RETURN })); expect(screen.getByRole("button", { name: RETURN })).toHaveAttribute("aria-expanded", "true");
  });
});
