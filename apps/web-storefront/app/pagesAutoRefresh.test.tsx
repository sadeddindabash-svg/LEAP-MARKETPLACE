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

const summary = (id: string, displayStatus: string, total = 50): OrderSummary => ({ id, status: displayStatus, displayStatus, total, currencyCode: "USD", placedAt: "2026-10-01T10:00:00Z", supplierNames: ["Supplier LEAP-SLR-AB12"] });

// The pages refresh themselves every 5 seconds: what changed elsewhere (the other device, the admin, the hub) appears; a failed refresh keeps what is on screen.
const tick = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); });
afterEach(() => { vi.useRealTimers(); });

describe("the orders list", () => {
  it("CRITICAL: a new order and a changed status appear within 5 seconds, without a reload", async () => {
    buyer(); m.api.fetchMyOrders.mockResolvedValue([summary("ord_1", "to_ship")]); show(<OrdersPage />); expect(await screen.findByText(/ord_1/)).toBeInTheDocument(); expect(screen.queryByText(/ord_2/)).not.toBeInTheDocument();
    m.api.fetchMyOrders.mockResolvedValue([summary("ord_2", "to_ship"), summary("ord_1", "cancelled")]); await tick(5000); expect(await screen.findByText(/ord_2/)).toBeInTheDocument();
  });
  it("CRITICAL: a failed refresh keeps the list (no empty list, no error)", async () => {
    buyer(); m.api.fetchMyOrders.mockResolvedValue([summary("ord_1", "to_ship")]); show(<OrdersPage />); await screen.findByText(/ord_1/); m.api.fetchMyOrders.mockRejectedValue(new Error("down")); await tick(5000); await tick(5000); expect(screen.getByText(/ord_1/)).toBeInTheDocument(); expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
describe("the order details", () => {
  it("CRITICAL: a status that changed elsewhere (the hub delivered it, the supplier shipped it) appears within 5 seconds", async () => {
    buyer(); m.api.fetchOrderById.mockResolvedValue(order([part(1, "preparing")])); await detail(); expect(screen.getByText("Part 1")).toBeInTheDocument(); const calls = m.api.fetchOrderById.mock.calls.length;
    m.api.fetchOrderById.mockResolvedValue(order([part(1, "shipped", "delivered", { items: [{ productId: "p1", name: "Part 1 renamed", quantity: 2, unitPrice: 25, imageUrl: null }] })])); await tick(5000);
    expect(m.api.fetchOrderById.mock.calls.length).toBeGreaterThan(calls); expect(await screen.findByText("Part 1 renamed")).toBeInTheDocument(); expect(m.api.fetchOrderById.mock.lastCall?.slice(1)).toEqual(["ord_1", null, "en"]);
  });
  it("CRITICAL: a failed refresh keeps the order on screen (no error page)", async () => { buyer(); m.api.fetchOrderById.mockResolvedValue(order([part(1, "preparing")])); await detail(); m.api.fetchOrderById.mockRejectedValue(new Error("down")); await tick(5000); await tick(5000); expect(screen.getByText("Part 1")).toBeInTheDocument(); expect(screen.queryByRole("alert")).not.toBeInTheDocument(); });
  it("an order that cannot be seen (not found) is not polled", async () => { buyer(); m.api.fetchOrderById.mockRejectedValue(new Error("Order not found")); show(orderPage("ord_1")); await screen.findByRole("heading", { level: 1 }).catch(() => {}); const calls = m.api.fetchOrderById.mock.calls.length; await tick(15000); expect(m.api.fetchOrderById.mock.calls.length).toBe(calls); });
});
