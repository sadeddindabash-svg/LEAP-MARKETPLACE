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

// In Arabic the order page asks the server for the ARABIC product names (and shows what it gets); in English it does not ask for anything different.
const arabicPart = (id: number, arabic: string) => part(id, "preparing", null, { items: [{ productId: `p${id}`, name: arabic, quantity: 2, unitPrice: 25, imageUrl: null }] });
const lastCall = () => m.api.fetchOrderById.mock.calls.at(-1) as unknown[];

describe("the order page in Arabic", () => {
  it("CRITICAL: asks the server for the order in Arabic and shows the Arabic product names it returns", async () => {
    buyer(); m.api.fetchOrderById.mockResolvedValue(order([arabicPart(1, "طقم تيل فرامل أمامي"), arabicPart(2, "فلتر زيت")])); await detail("ord_1", "ar");
    expect(lastCall().slice(1)).toEqual(["ord_1", null, "ar"]); expect(screen.getByText("طقم تيل فرامل أمامي")).toBeInTheDocument(); expect(screen.getByText("فلتر زيت")).toBeInTheDocument(); expect(screen.queryByText("Part 1")).not.toBeInTheDocument();
  });
  it("a guest asks in Arabic too (and still identifies the order by the email)", async () => {
    m.params.current = new URLSearchParams("guestEmail=sam%40example.com"); m.api.fetchOrderById.mockResolvedValue(order([arabicPart(1, "فلتر زيت")])); await detail("ord_1", "ar"); expect(lastCall().slice(1)).toEqual(["ord_1", "sam@example.com", "ar"]);
  });
  it("a product with no Arabic name yet shows the English name the server sent", async () => { buyer(); m.api.fetchOrderById.mockResolvedValue(order([part(1, "preparing"), arabicPart(2, "فلتر زيت")])); await detail("ord_1", "ar"); expect(screen.getByText("Part 1")).toBeInTheDocument(); expect(screen.getByText("فلتر زيت")).toBeInTheDocument(); });
});
describe("the order page in English", () => {
  it("CRITICAL: asks with the English language marker (the server sends English), and shows the names it returns", async () => { buyer(); m.api.fetchOrderById.mockResolvedValue(order([part(1, "preparing")])); await detail("ord_1", "en"); expect(lastCall().slice(1)).toEqual(["ord_1", null, "en"]); expect(screen.getByText("Part 1")).toBeInTheDocument(); });
});
