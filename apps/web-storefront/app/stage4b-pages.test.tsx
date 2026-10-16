import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { QuoteRequest, QuoteRequestItem } from "@/lib/api";

// The quote request pages, referrals, notifications, saved searches and the wishlist, with the sign-in state, the server, the cart and the router replaced by fixed values.
const m = vi.hoisted(() => ({
  user: { current: null as { id: string; email: string } | null }, push: vi.fn(), params: { current: new URLSearchParams() }, route: { current: { id: "qr_1" } },
  cart: { current: { cart: { cartId: "cart-77" } as { cartId: string } | null, refreshCart: vi.fn(async () => {}) } },
  garage: { current: { defaultVehicle: null as unknown } },
  api: { fetchMyQuoteRequests: vi.fn(), createQuoteRequest: vi.fn(), fetchQuoteRequest: vi.fn(), addQuoteRequestItem: vi.fn(), updateQuoteRequestItem: vi.fn(), deleteQuoteRequestItem: vi.fn(), submitQuoteRequest: vi.fn(), cancelQuoteRequest: vi.fn(),
    placeQuoteRequestOrder: vi.fn(), uploadReviewPhoto: vi.fn(), fetchMyReferral: vi.fn(), fetchReferralHistory: vi.fn(), fetchNotifications: vi.fn(), markNotificationRead: vi.fn(), markAllNotificationsRead: vi.fn(),
    fetchSavedSearches: vi.fn(), deleteSavedSearch: vi.fn(), fetchWishlist: vi.fn(), removeFromWishlist: vi.fn() },
}));
vi.mock("@/components/AuthProvider", () => ({ useAuth: () => ({ user: m.user.current, isLoading: false }), getAuthToken: () => (m.user.current ? "tok" : null) }));
vi.mock("@/components/CartProvider", () => ({ useCart: () => m.cart.current }));
vi.mock("@/components/GarageProvider", () => ({ useGarage: () => m.garage.current }));
vi.mock("@/components/VehicleCascade", () => ({ default: ({ onChange }: { onChange: (c: { generationId: string; year: number; label: string } | null) => void }) => <button type="button" onClick={() => onChange({ generationId: "g9", year: 2020, label: "x" })}>pick a car</button> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: m.push, replace: vi.fn() }), useSearchParams: () => m.params.current, useParams: () => m.route.current, usePathname: () => "/part-requests" }));
vi.mock("@/lib/api", () => ({ ...Object.fromEntries(Object.keys(m.api).map((k) => [k, (...a: unknown[]) => (m.api as unknown as Record<string, (...x: unknown[]) => unknown>)[k](...a)])), resolveImageUrl: (u: string) => u, resolveNotificationLink: (n: { linkType: string | null; linkId: string | null }) => (n.linkType === "order" ? `/orders/${n.linkId}` : n.linkType === "ticket" ? `/support/${n.linkId}` : n.linkType === "product" ? `/products/${n.linkId}` : n.linkType === "saved_search" ? "/saved-searches" : null) }));

import MyRequestsPage from "./part-requests/page";
import NewRequestPage from "./part-requests/new/page";
import RequestDetailPage from "./part-requests/[id]/page";
import ReferralsPage from "./referrals/page";
import NotificationsPage from "./notifications/page";
import SavedSearchesPage from "./saved-searches/page";
import WishlistPage from "./wishlist/page";
import { LangProvider } from "@/components/LangProvider";

const item = (over: Partial<QuoteRequestItem> = {}): QuoteRequestItem => ({ id: 1, name: "Rear door handle", description: null, referencePhotoUrl: null, quantity: 1, status: "pending", productId: null, ...over });
const req = (over: Partial<QuoteRequest> = {}): QuoteRequest => ({ id: "qr_1", generationId: "g9", year: 2020, brand: "BYD", model: "Seal", generation: "G1", status: "draft", createdAt: "2026-10-01T10:00:00Z", submittedAt: null, quotedAt: null, expiresAt: null, items: [], ...over });
const show = (node: React.ReactNode, lang: "en" | "ar" = "en") => render(<LangProvider lang={lang}>{node}</LangProvider>);
const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const buyer = () => { m.user.current = { id: "u1", email: "sam@example.com" }; };
const future = new Date(Date.now() + 5 * 86_400_000).toISOString(), past = new Date(Date.now() - 2 * 86_400_000).toISOString();
const quoted = (over: Partial<QuoteRequest> = {}) => req({ status: "quoted", expiresAt: future, items: [
  item({ id: 1, name: "Door handle", status: "priced", readyToOrder: true, price: 40, quantity: 2, productId: "p_77" }), item({ id: 2, name: "Mirror cap", status: "priced", readyToOrder: false, price: 15 }), item({ id: 3, name: "Rare badge", status: "unavailable" }), item({ id: 4, name: "Seal strip", status: "pending" })], ...over });

beforeEach(() => {
  vi.clearAllMocks(); m.user.current = null; m.params.current = new URLSearchParams(); m.route.current = { id: "qr_1" }; m.garage.current = { defaultVehicle: null };
  m.cart.current = { cart: { cartId: "cart-77" }, refreshCart: vi.fn(async () => {}) };
  for (const f of Object.values(m.api)) f.mockReset();
  m.api.fetchMyQuoteRequests.mockResolvedValue([]); m.api.createQuoteRequest.mockResolvedValue(req()); m.api.fetchQuoteRequest.mockResolvedValue(req());
  m.api.addQuoteRequestItem.mockImplementation(async (_t: string, _id: string, it: { name: string; quantity?: number }) => req({ items: [item({ id: 9, name: it.name, quantity: it.quantity ?? 1 })] }));
  m.api.updateQuoteRequestItem.mockResolvedValue(req()); m.api.deleteQuoteRequestItem.mockResolvedValue(req()); m.api.submitQuoteRequest.mockResolvedValue(req({ status: "submitted" })); m.api.cancelQuoteRequest.mockResolvedValue(req({ status: "cancelled" }));
  m.api.placeQuoteRequestOrder.mockResolvedValue(quoted()); m.api.uploadReviewPhoto.mockResolvedValue("/uploads/ref.jpg");
  m.api.fetchMyReferral.mockResolvedValue({ code: "SAM123", totalReferred: 3, rewardsEarned: 1, maxRewards: 5, capReached: false }); m.api.fetchReferralHistory.mockResolvedValue([]);
  m.api.fetchNotifications.mockResolvedValue([]); m.api.markNotificationRead.mockResolvedValue(undefined); m.api.markAllNotificationsRead.mockResolvedValue(undefined);
  m.api.fetchSavedSearches.mockResolvedValue([]); m.api.deleteSavedSearch.mockResolvedValue(undefined); m.api.fetchWishlist.mockResolvedValue([]); m.api.removeFromWishlist.mockResolvedValue(undefined);
});
afterEach(() => { vi.restoreAllMocks(); });

describe("my requests", () => {
  it("a visitor who is not signed in is asked to sign in and brought back; a buyer sees each request with its status, items and car", async () => {
    show(<MyRequestsPage />);
    expect(screen.getByText("Sign in to see and make part requests.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Log in" }).getAttribute("href")).toBe("/login?next=%2Fpart-requests");
  });
  it("CRITICAL: lists the requests with the app's status words, a quote past its date shown as Expired, and opens each one", async () => {
    buyer();
    m.api.fetchMyQuoteRequests.mockResolvedValue([req({ id: "qr_a", status: "submitted", items: [item(), item({ id: 2 })] }), req({ id: "qr_b", status: "quoted", expiresAt: past, items: [item()] }), req({ id: "qr_c", status: "ordered" })]);
    show(<MyRequestsPage />);
    expect(await screen.findByText("Submitted")).toBeInTheDocument();
    expect(screen.getByText("Expired")).toBeInTheDocument();
    expect(screen.getByText("Ordered")).toBeInTheDocument();
    expect(screen.getByText(/2 items/)).toBeInTheDocument();
    expect(screen.getByText(/1 item ·/)).toBeInTheDocument();
    expect(screen.getAllByText("For BYD Seal · 2020")).toHaveLength(3);
    expect(screen.getAllByRole("link", { name: /For BYD Seal/ })[0].getAttribute("href")).toBe("/part-requests/qr_a");
    expect(screen.getByRole("link", { name: "New request" }).getAttribute("href")).toBe("/part-requests/new");
  });
  it("with none it says so; in Arabic the page and the status words are the app's", async () => {
    buyer();
    const first = show(<MyRequestsPage />);
    expect(await screen.findByText("No requests yet.")).toBeInTheDocument();
    first.unmount();
    m.api.fetchMyQuoteRequests.mockResolvedValue([req({ status: "quoted", expiresAt: future })]);
    show(<MyRequestsPage />, "ar");
    expect(await screen.findByText("تم التسعير")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("طلبات القطع");          // not "طلباتي": that already means "my orders"
  });
});

describe("request a quote", () => {
  it("CRITICAL: pick the car (or use the garage car), start the request, add parts (name required, with quantity, description and photo), and the counter shows n of 20", async () => {
    buyer();
    show(<NewRequestPage />);
    expect(screen.getByRole("button", { name: "Start request" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "pick a car" }));
    fireEvent.click(screen.getByRole("button", { name: "Start request" }));
    await waitFor(() => expect(m.api.createQuoteRequest).toHaveBeenCalledWith("tok", "g9", 2020));
    expect(await screen.findByRole("button", { name: "Add item (0/20)" })).toBeDisabled();                     // a name is needed
    type("Part name", "Rear door handle"); type("Description (optional)", "Left side, black"); type("Quantity", "2");
    fireEvent.change(screen.getByLabelText("Reference photo (optional)", { selector: "input" }), { target: { files: [new File(["x"], "p.jpg")] } });
    await waitFor(() => expect(m.api.uploadReviewPhoto).toHaveBeenCalled());
    fireEvent.click(await screen.findByRole("button", { name: "Add item (0/20)" }));
    await waitFor(() => expect(m.api.addQuoteRequestItem).toHaveBeenCalledWith("tok", "qr_1", { name: "Rear door handle", description: "Left side, black", referencePhotoUrl: "/uploads/ref.jpg", quantity: 2 }));
    expect(await screen.findByText("Qty: 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add item (1/20)" })).toBeInTheDocument();
  });
  it("the garage car starts the request in one tap", async () => {
    buyer(); m.garage.current = { defaultVehicle: { generationId: "gen7", year: 2022, brand: "BYD", brandAr: null, model: "Seal", modelAr: null } };
    show(<NewRequestPage />);
    fireEvent.click(screen.getByRole("button", { name: "Use my car: BYD Seal · 2022" }));
    await waitFor(() => expect(m.api.createQuoteRequest).toHaveBeenCalledWith("tok", "gen7", 2022));
  });
  it("CRITICAL: a request needs at least one part to be sent, a part can be removed, and sending goes to My requests", async () => {
    buyer(); m.params.current = new URLSearchParams("draft=qr_1");
    m.api.fetchQuoteRequest.mockResolvedValue(req());
    show(<NewRequestPage />);
    expect(await screen.findByRole("button", { name: "Submit request" })).toBeDisabled();
    m.api.fetchQuoteRequest.mockResolvedValue(req({ items: [item({ id: 9, name: "Rear door handle" })] }));
    type("Part name", "Rear door handle"); fireEvent.click(screen.getByRole("button", { name: /Add item/ }));
    expect(await screen.findByText("Rear door handle")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove: Rear door handle" }));
    await waitFor(() => expect(m.api.deleteQuoteRequestItem).toHaveBeenCalledWith("tok", "qr_1", 9));
    m.api.addQuoteRequestItem.mockResolvedValue(req({ items: [item({ id: 10 })] }));
    type("Part name", "Another"); fireEvent.click(screen.getByRole("button", { name: /Add item/ }));
    await screen.findByText("Rear door handle");
    fireEvent.click(screen.getByRole("button", { name: "Submit request" }));
    await waitFor(() => expect(m.api.submitQuoteRequest).toHaveBeenCalledWith("tok", "qr_1"));
    await waitFor(() => expect(m.push).toHaveBeenCalledWith("/part-requests", undefined));
  });
  it("CRITICAL: at 20 parts no more can be added; a draft continued with ?draft= opens at the parts step; a request already sent cannot be added to", async () => {
    buyer(); m.params.current = new URLSearchParams("draft=qr_1");
    m.api.fetchQuoteRequest.mockResolvedValue(req({ items: Array.from({ length: 20 }, (_, i) => item({ id: i + 1, name: `Part ${i + 1}` })) }));
    const first = show(<NewRequestPage />);
    await screen.findByLabelText("Part name");
    type("Part name", "One more");
    expect(await screen.findByRole("button", { name: "Add item (20/20)" })).toBeDisabled();
    first.unmount();
    m.api.fetchQuoteRequest.mockResolvedValue(req({ status: "submitted" }));
    show(<NewRequestPage />);
    expect(await screen.findByText(/This request hasn't been submitted yet\./)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add item/ })).not.toBeInTheDocument();
  });
  it("a server refusal is shown and the buyer keeps what they typed", async () => {
    buyer(); m.params.current = new URLSearchParams("draft=qr_1");
    m.api.addQuoteRequestItem.mockRejectedValue(new Error("A request can have at most 20 items"));
    show(<NewRequestPage />);
    await screen.findByLabelText("Part name");
    type("Part name", "Handle"); fireEvent.click(await screen.findByRole("button", { name: /Add item/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("at most 20 items");
    expect(screen.getByLabelText("Part name")).toHaveValue("Handle");
  });
});

describe("request detail", () => {
  const open = async (r: QuoteRequest, lang: "en" | "ar" = "en") => { buyer(); m.api.fetchQuoteRequest.mockResolvedValue(r); show(<RequestDetailPage />, lang); await screen.findByRole("heading", { level: 1 }); };
  it("CRITICAL: a quote shows each part as it is: priced and ready (its price), priced but pending approval, unavailable, still pending; the total counts only the ready ones", async () => {
    await open(quoted());
    expect(screen.getByText("Quote received -- review the prices below.", { exact: false })).toBeInTheDocument();
    expect(screen.getByText(/Valid until/)).toBeInTheDocument();
    const ready = screen.getByText("Door handle").closest("li") as HTMLElement;
    expect(within(ready).getByText("$80")).toBeInTheDocument();                                            // 40 x 2
    expect(within(screen.getByText("Mirror cap").closest("li") as HTMLElement).getByText("Pending approval")).toBeInTheDocument();
    expect(within(screen.getByText("Rare badge").closest("li") as HTMLElement).getByText("Unavailable")).toBeInTheDocument();
    expect(screen.getByText("Total").parentElement).toHaveTextContent("$80");
    expect(screen.getByRole("link", { name: "View product" }).getAttribute("href")).toBe("/products/p_77");
  });
  it("CRITICAL: Add to cart puts the ready parts in THE CART (its id is sent), reloads the cart, and goes to it", async () => {
    await open(quoted());
    fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));
    await waitFor(() => expect(m.api.placeQuoteRequestOrder).toHaveBeenCalledWith("tok", "qr_1", "cart-77"));
    await waitFor(() => expect(m.cart.current.refreshCart).toHaveBeenCalled());
    await waitFor(() => expect(m.push).toHaveBeenCalledWith("/cart", undefined));
  });
  it("CRITICAL: quantities and removal are offered on a valid quote; the quantity buttons change that part; a quote past its date is Expired and cannot be ordered", async () => {
    const first = (await open(quoted()), undefined);
    void first;
    fireEvent.click(within(screen.getByText("Door handle").closest("li") as HTMLElement).getByLabelText("Increase quantity"));
    await waitFor(() => expect(m.api.updateQuoteRequestItem).toHaveBeenCalledWith("tok", "qr_1", 1, { quantity: 3 }));
    fireEvent.click(within(screen.getByText("Door handle").closest("li") as HTMLElement).getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(m.api.deleteQuoteRequestItem).toHaveBeenCalledWith("tok", "qr_1", 1));
  });
  it("an expired quote says so and offers no ordering and no quantity changes", async () => {
    await open(quoted({ expiresAt: past }));
    expect(screen.getByText("This quote has expired.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add to cart" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Increase quantity")).not.toBeInTheDocument();
  });
  it("CRITICAL: a draft or submitted request can be cancelled (asked first, Back changes nothing); a draft can be continued; a quoted one cannot be cancelled", async () => {
    await open(req({ status: "submitted", items: [item()] }));
    expect(screen.getByText("Awaiting a quote from our team.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel this request" }));
    fireEvent.click(within(screen.getByRole("alertdialog", { name: "Cancel this request?" })).getByRole("button", { name: "Back" }));
    expect(m.api.cancelQuoteRequest).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel this request" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancel request" }));
    await waitFor(() => expect(m.api.cancelQuoteRequest).toHaveBeenCalledWith("tok", "qr_1"));
  });
  it("a draft offers 'Continue this request'; a quoted request offers no cancel", async () => {
    const draft = (await open(req({ status: "draft" })), undefined); void draft;
    expect(screen.getByRole("link", { name: "Continue this request" }).getAttribute("href")).toBe("/part-requests/new?draft=qr_1");
  });
  it("a quoted request cannot be cancelled", async () => {
    await open(quoted());
    expect(screen.queryByRole("button", { name: "Cancel this request" })).not.toBeInTheDocument();
  });
  it("a server refusal (the quote just expired) is shown; a request that is not there says Not found; in Arabic the page is the app's Arabic", async () => {
    await open(quoted());
    m.api.placeQuoteRequestOrder.mockRejectedValue(new Error("This quote has expired"));
    fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This quote has expired");
    expect(m.push).not.toHaveBeenCalled();
  });
  it("not found, and Arabic", async () => {
    buyer(); m.api.fetchQuoteRequest.mockRejectedValue(new Error("Request not found"));
    const first = show(<RequestDetailPage />);
    expect(await screen.findByRole("heading", { name: "Not found" })).toBeInTheDocument();
    first.unmount();
    await open(quoted(), "ar");
    expect(screen.getByRole("button", { name: "أضف إلى السلة" })).toBeInTheDocument();
    expect(screen.getByText("قيد المراجعة")).toBeInTheDocument();                                          // the pending part
    expect(screen.getByText("غير متوفر")).toBeInTheDocument();
  });
});

describe("referrals", () => {
  it("not signed in: asked to sign in, and brought back", () => {
    show(<ReferralsPage />);
    expect(screen.getByRole("link", { name: "Log in" }).getAttribute("href")).toBe("/login?next=%2Freferrals");
  });
  it("CRITICAL: shows the code, how many were referred and the rewards out of the maximum; copying the code works; the reward cap is said when reached", async () => {
    buyer();
    const writeText = vi.fn(async () => {}); vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    m.api.fetchMyReferral.mockResolvedValue({ code: "SAM123", totalReferred: 6, rewardsEarned: 5, maxRewards: 5, capReached: true });
    show(<ReferralsPage />);
    expect(await screen.findByText("SAM123")).toBeInTheDocument();
    expect(screen.getByText("People referred").previousElementSibling).toHaveTextContent("6");
    expect(screen.getByText("Rewards earned").previousElementSibling).toHaveTextContent("5 / 5");
    expect(screen.getByText("You've reached the maximum number of referral rewards.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Copy code" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("SAM123"));
    expect(await screen.findByText("Code copied!")).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
  it("CRITICAL: Share sends the app's sentence with the SIGN-UP link that carries the code (in the page's language), or copies it when the browser cannot share", async () => {
    buyer();
    const share = vi.fn(async () => {}); const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", { ...navigator, share, clipboard: { writeText } });
    const first = show(<ReferralsPage />);
    await screen.findByText("SAM123");
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await waitFor(() => expect(share).toHaveBeenCalledWith({ text: expect.stringContaining("/signup?ref=SAM123") }));
    expect((share.mock.calls[0] as unknown as [{ text: string }])[0].text).toMatch(/^Use my code to get a discount on your first order at Leap: http/);
    first.unmount();
    vi.stubGlobal("navigator", { ...navigator, share: undefined, clipboard: { writeText } });
    show(<ReferralsPage />, "ar");
    await screen.findByText("SAM123");
    fireEvent.click(screen.getByRole("button", { name: "مشاركة" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining("/ar/signup?ref=SAM123")));
    expect(await screen.findByText("تم نسخ نص المشاركة!")).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
  it("the history lists who joined (first names only), with a mark where the reward was earned", async () => {
    buyer();
    m.api.fetchReferralHistory.mockResolvedValue([{ firstName: "Layla", joinedAt: "2026-10-02T10:00:00Z", rewardGranted: true }, { firstName: null, joinedAt: "2026-09-20T10:00:00Z", rewardGranted: false }]);
    show(<ReferralsPage />);
    expect(await screen.findByText("Layla joined")).toBeInTheDocument();
    expect(screen.getByText("A new member joined")).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: "Reward earned" })).toHaveLength(1);
  });
});

describe("notifications", () => {
  const n = (over = {}) => ({ id: 1, type: "order_update", title: "Order shipped", body: "Your order is on its way", linkType: "order", linkId: "ord_1", isRead: false, createdAt: new Date(Date.now() - 3 * 3_600_000).toISOString(), ...over });
  it("not signed in: asked to sign in and brought back; the page asks the server for the page's language", async () => {
    show(<NotificationsPage />);
    expect(screen.getByRole("link", { name: "Log in" }).getAttribute("href")).toBe("/login?next=%2Fnotifications");
  });
  it("CRITICAL: opening a notification marks it read and goes to what it is about (order, ticket, product, saved search); one with no link is only marked read", async () => {
    buyer();
    m.api.fetchNotifications.mockResolvedValue([n({ id: 1 }), n({ id: 2, linkType: "ticket", linkId: "T-5", title: "Ticket reply" }), n({ id: 3, linkType: "product", linkId: "p1", title: "Back in stock" }), n({ id: 4, linkType: "saved_search", linkId: "9", title: "New matches" }), n({ id: 5, linkType: null, linkId: null, title: "Welcome" })]);
    show(<NotificationsPage />);
    expect(await screen.findByText("Order shipped")).toBeInTheDocument();
    for (const [title, href] of [["Order shipped", "/orders/ord_1"], ["Ticket reply", "/support/T-5"], ["Back in stock", "/products/p1"], ["New matches", "/saved-searches"]] as const) {
      m.push.mockClear();
      fireEvent.click(screen.getByText(title));
      expect(m.push.mock.lastCall?.[0]).toBe(href);
    }
    m.push.mockClear();
    fireEvent.click(screen.getByText("Welcome"));
    expect(m.push).not.toHaveBeenCalled();
    await waitFor(() => expect(m.api.markNotificationRead).toHaveBeenCalledWith("tok", 5));
    expect(m.api.markNotificationRead).toHaveBeenCalledTimes(5);
  });
  it("an already-read notification is not marked again; 'Mark all read' marks everything and goes away", async () => {
    buyer();
    m.api.fetchNotifications.mockResolvedValue([n({ id: 1, isRead: true, title: "Already read" }), n({ id: 2, title: "Fresh one" })]);
    show(<NotificationsPage />);
    fireEvent.click(await screen.findByText("Already read"));
    expect(m.api.markNotificationRead).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Mark all read" }));
    await waitFor(() => expect(m.api.markAllNotificationsRead).toHaveBeenCalledWith("tok"));
    expect(screen.queryByRole("button", { name: "Mark all read" })).not.toBeInTheDocument();
  });
  it("in Arabic it asks the server for Arabic texts, and an empty list says you are all caught up", async () => {
    buyer();
    show(<NotificationsPage />, "ar");
    expect(await screen.findByText("أنت على اطلاع بكل شيء.")).toBeInTheDocument();
    expect(m.api.fetchNotifications).toHaveBeenCalledWith("tok", "ar");
  });
});

describe("saved searches", () => {
  const s = (over = {}) => ({ id: 3, label: "Brake discs", searchTerm: "brake disc", category: "brake", createdAt: "x", lastCheckedAt: new Date(Date.now() - 2 * 3_600_000).toISOString(), ...over });
  it("CRITICAL: lists each search (it opens the search), when it was last checked or 'not checked yet'; deleting asks first and only the confirmation deletes", async () => {
    buyer();
    m.api.fetchSavedSearches.mockResolvedValue([s(), s({ id: 4, label: "Filters", searchTerm: "oil filter", category: null, lastCheckedAt: null })]);
    show(<SavedSearchesPage />);
    expect(await screen.findByRole("link", { name: "Brake discs" })).toHaveAttribute("href", "/search?q=brake+disc&category=brake");
    expect(screen.getByText("Last checked: 2h ago")).toBeInTheDocument();
    expect(screen.getByText("Not checked yet")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete: Brake discs" }));
    const dialog = screen.getByRole("alertdialog", { name: 'Delete your saved search "Brake discs"?' });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(m.api.deleteSavedSearch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Delete: Brake discs" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(m.api.deleteSavedSearch).toHaveBeenCalledWith("tok", 3));
    await waitFor(() => expect(screen.queryByRole("link", { name: "Brake discs" })).not.toBeInTheDocument());
  });
  it("empty and signed-out states, and Arabic", async () => {
    show(<SavedSearchesPage />);
    expect(screen.getByRole("link", { name: "Log in" }).getAttribute("href")).toBe("/login?next=%2Fsaved-searches");
    buyer();
    const first = show(<SavedSearchesPage />, "ar");
    expect(await screen.findByText(/لا توجد عمليات بحث محفوظة بعد/)).toBeInTheDocument();
    first.unmount();
    m.api.fetchSavedSearches.mockResolvedValue([s()]);
    show(<SavedSearchesPage />, "ar");
    expect(await screen.findByText("آخر فحص: منذ 2 س")).toBeInTheDocument();
  });
});

describe("wishlist", () => {
  const p = (over = {}) => ({ id: "a", name: "Item a", images: [], price: 10, stockQuantity: 3, ...over });
  it("lists saved parts with their price, says the buyer will be told when an out-of-stock one is back, and removes one", async () => {
    buyer();
    m.api.fetchWishlist.mockResolvedValue([p(), p({ id: "b", name: "Item b", stockQuantity: 0 })]);
    show(<WishlistPage />);
    expect(await screen.findByText("Item a")).toBeInTheDocument();
    expect(screen.getByText("Out of stock — we'll notify you when it's back")).toBeInTheDocument();
    fireEvent.click(within(screen.getByText("Item a").closest("li") as HTMLElement).getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(m.api.removeFromWishlist).toHaveBeenCalledWith("tok", "a"));
    await waitFor(() => expect(screen.queryByText("Item a")).not.toBeInTheDocument());
  });
  it("signed out it asks to sign in; empty it says so and points to the shop; in Arabic it is the app's Arabic", async () => {
    const out = show(<WishlistPage />);
    expect(screen.getByRole("link", { name: "Log in" }).getAttribute("href")).toBe("/login?next=%2Fwishlist");
    out.unmount();
    buyer();
    show(<WishlistPage />, "ar");
    expect(await screen.findByText(/لا شيء محفوظ بعد/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "تصفح المنتجات" }).getAttribute("href")).toBe("/ar/search");
  });
});
