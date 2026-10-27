import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { OrderDetail, OrderSummary, SupplierSubOrder } from "@/lib/api";

// The shipping fee on the order page: shown as its own line before the total when one was charged, nothing when none was. The server, the sign-in state, the cart and the router are replaced by fixed values.
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

import OrderPage from "./orders/[id]/page";
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


describe("the order page", () => {
  it("shows the shipping fee that was charged, before the total, and the total includes it", async () => {
    m.api.fetchOrderById.mockResolvedValue(order([part(1, "preparing")], { total: 105, shippingFee: 5 } as never)); buyer(); await detail(); const sum = screen.getByRole("heading", { name: "Order summary" }).closest("section") as HTMLElement;
    const text = sum.textContent!; expect(within(sum).getByText("Shipping fees")).toBeInTheDocument(); expect(text).toContain("+$5"); expect(text.indexOf("Shipping fees")).toBeLessThan(text.indexOf("Total")); expect(text).toContain("$105");
  });
  it("a discount and a fee are both shown, the discount first", async () => {
    m.api.fetchOrderById.mockResolvedValue(order([part(1, "preparing")], { total: 53, discountAmount: 12, promoCode: "SAVE20", shippingFee: 5 } as never)); buyer(); await detail(); const text = (screen.getByRole("heading", { name: "Order summary" }).closest("section") as HTMLElement).textContent!;
    expect(text.indexOf("Discount")).toBeLessThan(text.indexOf("Shipping fees")); expect(text.indexOf("Shipping fees")).toBeLessThan(text.indexOf("Total"));
  });
  it("no fee line when none was charged (0, or an order from an older server)", async () => {
    for (const shippingFee of [0, undefined]) { m.api.fetchOrderById.mockResolvedValue(order([part(1, "preparing")], { shippingFee } as never)); buyer(); const v = render(<LangProvider lang="en">{orderPage("ord_1")}</LangProvider>); await screen.findByRole("heading", { level: 1 }); expect(screen.queryByText("Shipping fees")).not.toBeInTheDocument(); v.unmount(); }
  });
  it("in Arabic the line is رسوم الشحن", async () => { m.api.fetchOrderById.mockResolvedValue(order([part(1, "preparing")], { total: 105, shippingFee: 5 } as never)); buyer(); await detail("ord_1", "ar"); expect(screen.getByText("رسوم الشحن")).toBeInTheDocument(); });
});
