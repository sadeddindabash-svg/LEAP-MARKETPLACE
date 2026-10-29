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

// A buyer's order that is OVER for good (cancelled, or every part cancelled: the supplier refused and nobody else could supply it) offers no address check, no tracking and no receipt;
// an order with a part still going keeps them. On the real order page, with the server replaced by fixed values.
const english = { recipientName: "Sam", country: "Oman", city: "Muscat", streetAddress: "1 Main St", state: null, source: "auto", confirmed: false, updatedAt: null };
const withAutoAddress = (parts: SupplierSubOrder[], over: Partial<OrderDetail> = {}) => order(parts, { addressEnglish: english, ...over });
const CHECK = "Check your address in English"; const TRACK = "Track your package"; const RECEIPT = "Download receipt";
const offers = () => ({ check: !!screen.queryByText(CHECK), track: !!screen.queryByRole("link", { name: TRACK }), receipt: !!screen.queryByRole("button", { name: RECEIPT }) });

describe("an order that is still going", () => {
  it("CONTROL: offers the address check, tracking and the receipt", async () => { buyer(); m.api.fetchOrderById.mockResolvedValue(withAutoAddress([part(1, "preparing")])); await detail(); expect(offers()).toEqual({ check: true, track: true, receipt: true }); });
});
describe("an order that is over for good", () => {
  it("CRITICAL: a CANCELLED order (the supplier refused and nobody else could supply it) offers NO address check, NO tracking and NO receipt, and says it is cancelled", async () => {
    buyer(); m.api.fetchOrderById.mockResolvedValue(withAutoAddress([part(1, "cancelled")], { status: "cancelled", displayStatus: "cancelled" })); await detail();
    expect(offers()).toEqual({ check: false, track: false, receipt: false }); expect(screen.getAllByText(/cancelled/i).length).toBeGreaterThan(0);
  });
  it("CRITICAL: the same when the order's own status was not updated but EVERY part is cancelled", async () => {
    buyer(); m.api.fetchOrderById.mockResolvedValue(withAutoAddress([part(1, "cancelled"), part(2, "cancelled")])); await detail(); expect(offers()).toEqual({ check: false, track: false, receipt: false });
  });
  it("the buyer can still order the parts again, and nothing offers to return or cancel it", async () => {
    buyer(); m.api.fetchOrderById.mockResolvedValue(withAutoAddress([part(1, "cancelled")], { status: "cancelled", displayStatus: "cancelled" })); await detail();
    expect(screen.getByRole("button", { name: /order again|reorder/i })).toBeInTheDocument(); expect(screen.queryByRole("button", { name: "Request a return" })).not.toBeInTheDocument(); expect(screen.queryByRole("button", { name: /cancel order/i })).not.toBeInTheDocument();
  });
  it("a guest sees the same: nothing to check, track or download", async () => { m.params.current = new URLSearchParams("guestEmail=sam%40example.com"); m.api.fetchOrderById.mockResolvedValue(withAutoAddress([part(1, "cancelled")], { status: "cancelled", displayStatus: "cancelled" })); await detail(); expect(offers()).toEqual({ check: false, track: false, receipt: false }); });
});
describe("an order that is only PARTLY cancelled", () => {
  it("CRITICAL: one supplier refused, another part is still going: the address check, tracking and the receipt stay (for the parts that are going)", async () => {
    buyer(); m.api.fetchOrderById.mockResolvedValue(withAutoAddress([part(1, "cancelled"), part(2, "preparing")])); await detail(); expect(offers()).toEqual({ check: true, track: true, receipt: true });
  });
  it("tracking is not offered when the only parts left are delivered ones and cancelled ones (a cancelled part is not 'still to deliver')", async () => {
    buyer(); m.api.fetchOrderById.mockResolvedValue(withAutoAddress([part(1, "cancelled"), part(2, "shipped", "delivered")], { addressEnglish: undefined })); await detail(); expect(offers().track).toBe(false); expect(offers().receipt).toBe(true);
  });
  it("an order with every part delivered offers a receipt but no tracking (as before)", async () => { buyer(); m.api.fetchOrderById.mockResolvedValue(order([part(1, "shipped", "delivered")])); await detail(); expect(offers().track).toBe(false); expect(offers().receipt).toBe(true); });
});
