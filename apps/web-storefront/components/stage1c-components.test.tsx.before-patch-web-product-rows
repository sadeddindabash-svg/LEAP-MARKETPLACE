import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ProductSummary, ReviewsSummary } from "@/lib/api";

// The pieces of the full product page, with the server, the garage and the sign-in state replaced by fixed values.
const m = vi.hoisted(() => ({
  auth: { current: { user: null as { id: string } | null } },
  garage: { current: { defaultVehicle: null as unknown } },
  checkWishlisted: vi.fn(),
  addToWishlist: vi.fn(async () => {}),
  removeFromWishlist: vi.fn(async () => {}),
  fetchSameBrand: vi.fn(),
  fetchProductsPaginated: vi.fn(),
}));
vi.mock("./AuthProvider", () => ({ useAuth: () => m.auth.current, getAuthToken: () => "tok" }));
vi.mock("./GarageProvider", () => ({ useGarage: () => m.garage.current }));
vi.mock("@/lib/api", () => ({
  checkWishlisted: (...a: unknown[]) => m.checkWishlisted(...a),
  addToWishlist: (...a: unknown[]) => m.addToWishlist(...(a as [])),
  removeFromWishlist: (...a: unknown[]) => m.removeFromWishlist(...(a as [])),
  fetchSameBrand: (...a: unknown[]) => m.fetchSameBrand(...a),
  fetchProductsPaginated: (...a: unknown[]) => m.fetchProductsPaginated(...a),
  resolveImageUrl: (u: string) => u,
}));

import ProductGallery from "./ProductGallery";
import ConfirmedFit from "./ConfirmedFit";
import ShareButton from "./ShareButton";
import NotifyWhenInStock from "./NotifyWhenInStock";
import OemComparison from "./OemComparison";
import LoadMoreGrid, { PAGE_SIZE } from "./LoadMoreGrid";
import { installFakeObserver } from "./testObserver";
import CustomerPhotos from "./CustomerPhotos";
import { LangProvider } from "./LangProvider";

const en = (node: React.ReactNode) => render(<LangProvider lang="en">{node}</LangProvider>);
const ar = (node: React.ReactNode) => render(<LangProvider lang="ar">{node}</LangProvider>);
const product = (id: string, over: Partial<ProductSummary> = {}): ProductSummary => ({ id, name: `Part ${id}`, description: null, category: "brake", part: "Disc", position: null, oemNumber: null, currencyCode: "USD", rating: null, reviewCount: 0, stockQuantity: 5, estimatedDeliveryDays: 5, weightKg: null, status: "active", price: 43, images: [], brand: "BYD", ...over });
const status = () => screen.getByText(/Photo \d of \d|الصورة \d من \d/, { selector: "p" }).textContent;

beforeEach(() => {
  vi.clearAllMocks();
  m.auth.current = { user: null };
  m.garage.current = { defaultVehicle: null };
  m.checkWishlisted.mockResolvedValue(false);
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("product gallery", () => {
  it("no photos: a plain message (not a broken image); one photo: no arrows and no thumbnails", () => {
    const { unmount } = en(<ProductGallery images={[]} alt="Disc" />);
    expect(screen.getByText("No photo")).toBeInTheDocument();
    unmount();
    en(<ProductGallery images={["/a.jpg"]} alt="Disc" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("CRITICAL: arrows go through the photos and wrap round; thumbnails jump to a photo; the position is announced", () => {
    en(<ProductGallery images={["/a.jpg", "/b.jpg", "/c.jpg"]} alt="Disc" />);
    expect(status()).toBe("Photo 1 of 3");
    fireEvent.click(screen.getByRole("button", { name: "Next photo" }));
    expect(status()).toBe("Photo 2 of 3");
    fireEvent.click(screen.getByRole("button", { name: "Previous photo" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous photo" }));
    expect(status()).toBe("Photo 3 of 3");                                       // wrapped round to the last
    fireEvent.click(screen.getByRole("button", { name: "Next photo" }));
    expect(status()).toBe("Photo 1 of 3");                                       // and round to the first
    fireEvent.click(screen.getAllByRole("button", { name: "Photo 3 of 3" })[0]);
    expect(status()).toBe("Photo 3 of 3");
    expect(screen.getAllByRole("button", { name: "Photo 3 of 3" })[0].getAttribute("aria-current")).toBe("true");
  });

  it("CRITICAL: the arrow keys follow the reading direction: in English the right arrow goes forward, in Arabic it goes back (and the left arrow goes forward)", () => {
    const { unmount } = en(<ProductGallery images={["/a.jpg", "/b.jpg", "/c.jpg"]} alt="Disc" />);
    fireEvent.keyDown(screen.getByRole("group"), { key: "ArrowRight" });
    expect(status()).toBe("Photo 2 of 3");                                         // forward
    unmount();
    ar(<ProductGallery images={["/a.jpg", "/b.jpg", "/c.jpg"]} alt="قرص" />);
    const arabic = screen.getByRole("group");
    fireEvent.keyDown(arabic, { key: "ArrowRight" });
    expect(status()).toBe("الصورة 3 من 3");                                        // BACK from the first: round to the last
    fireEvent.keyDown(arabic, { key: "ArrowLeft" });
    expect(status()).toBe("الصورة 1 من 3");                                        // forward
    fireEvent.keyDown(arabic, { key: "ArrowLeft" });
    expect(status()).toBe("الصورة 2 من 3");
  });
});

describe("confirmed fit", () => {
  const car = { generationId: "g1", year: 2024, brand: "BYD", brandAr: null, model: "Seal DM-i", modelAr: null };
  it("CRITICAL: shown only when the buyer's default car is in the part's fit list", () => {
    m.garage.current = { defaultVehicle: car };
    const { unmount } = en(<ConfirmedFit fitsVehicleIds={["g0", "g1"]} />);
    expect(screen.getByRole("status")).toHaveTextContent("Confirmed fit: BYD Seal DM-i · 2024");
    unmount();
    const second = en(<ConfirmedFit fitsVehicleIds={["g0"]} />);
    expect(second.container).toBeEmptyDOMElement();
    second.unmount();
    m.garage.current = { defaultVehicle: null };
    expect(en(<ConfirmedFit fitsVehicleIds={["g1"]} />).container).toBeEmptyDOMElement();
  });
  it("in Arabic it is the app's own wording", () => {
    m.garage.current = { defaultVehicle: car };
    ar(<ConfirmedFit fitsVehicleIds={["g1"]} />);
    expect(screen.getByRole("status")).toHaveTextContent("توافق مؤكد: BYD Seal DM-i · 2024");
  });
});

describe("share", () => {
  it("uses the device's share sheet when there is one", async () => {
    const share = vi.fn(async () => {});
    vi.stubGlobal("navigator", { ...navigator, share });
    en(<ShareButton title="Disc" />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Share/ })); });
    expect(share).toHaveBeenCalledWith({ title: "Disc", url: window.location.href });
  });
  it("otherwise copies the link and says so; a refused copy is not an error on the page", async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    en(<ShareButton title="Disc" />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Share/ })); });
    expect(writeText).toHaveBeenCalledWith(window.location.href);
    expect(screen.getByText("Link copied")).toBeInTheDocument();
    writeText.mockRejectedValueOnce(new Error("blocked"));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Share/ })); });
  });
});

describe("notify me when back in stock (the wishlist, as in the app)", () => {
  it("signed out it leads to sign-in", () => {
    en(<NotifyWhenInStock productId="p1" />);
    expect(screen.getByRole("link", { name: "Notify me when back in stock" }).getAttribute("href")).toBe("/login");
  });

  it("CRITICAL: signed in, it saves the part to the wishlist and confirms; pressing again takes it back", async () => {
    m.auth.current = { user: { id: "u1" } };
    en(<NotifyWhenInStock productId="p1" />);
    const button = await screen.findByRole("button", { name: "Notify me when back in stock" });
    await act(async () => { fireEvent.click(button); });
    expect(m.addToWishlist).toHaveBeenCalledWith("tok", "p1");
    expect(await screen.findByRole("button", { name: "We'll notify you" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("We'll let you know when this is back in stock.")).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "We'll notify you" })); });
    expect(m.removeFromWishlist).toHaveBeenCalledWith("tok", "p1");
    expect(screen.getByRole("button", { name: "Notify me when back in stock" })).toBeInTheDocument();
  });

  it("a part already saved shows as subscribed, and the Arabic text is the app's", async () => {
    m.auth.current = { user: { id: "u1" } };
    m.checkWishlisted.mockResolvedValue(true);
    ar(<NotifyWhenInStock productId="p1" />);
    expect(await screen.findByRole("button", { name: "سنُعلمك عند التوفر" })).toBeInTheDocument();
  });
});

describe("same part, other listings", () => {
  it("draws nothing when there are none", () => {
    expect(en(<OemComparison products={[]} lang="en" />).container).toBeEmptyDOMElement();
  });
  it("CRITICAL: lists the same OEM number from other suppliers with price, stock, delivery and verified sellers, each linking to its part", () => {
    en(<OemComparison lang="en" products={[product("a", { price: 31, isVerifiedSeller: true }), product("b", { stockQuantity: 0, estimatedDeliveryDays: null })]} />);
    expect(screen.getByRole("heading", { name: "Same part, other listings" })).toBeInTheDocument();
    expect(screen.getByText("Identical OEM part number")).toBeInTheDocument();
    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual(["/products/a", "/products/b"]);
    expect(links[0]).toHaveTextContent("$31");
    expect(links[0]).toHaveTextContent("Verified seller");
    expect(links[0]).toHaveTextContent("Delivery in 5 days");
    expect(links[1]).toHaveTextContent("Out of stock");
    expect(links[1]).not.toHaveTextContent("Verified seller");
    expect(links[1]).not.toHaveTextContent("Delivery in");
  });
  it("in Arabic it is the app's wording and the links keep /ar", () => {
    ar(<OemComparison lang="ar" products={[product("a")]} />);
    expect(screen.getByRole("heading", { name: "نفس القطعة من موردين آخرين" })).toBeInTheDocument();
    expect(screen.getByRole("link").getAttribute("href")).toBe("/ar/products/a");
  });
});

describe("the lists at the bottom of a product page (same brand, newest): lazy loading", () => {
  const page = (from: number, n: number) => Array.from({ length: n }, (_, i) => product(`p${from + i}`));
  const sameBrand = (initial: ProductSummary[]) => en(<LoadMoreGrid id="b" title="More BYD parts" initial={initial} source={{ kind: "sameBrand", productId: "cur" }} />);
  const asked: string[] = [];
  let reply: Array<{ items: ProductSummary[] }> = [];
  beforeEach(() => {
    asked.length = 0; reply = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => { asked.push(url); return { ok: true, status: 200, json: async () => reply.shift() ?? { items: [] } } as Response; }));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("draws nothing without products, and a short first page is simply the whole list: nothing is loaded afterwards", () => {
    expect(sameBrand([]).container).toBeEmptyDOMElement();
  });
  it("a short page is complete: it never starts watching for more", () => {
    const view = installFakeObserver();
    sameBrand(page(1, PAGE_SIZE - 1));
    expect(screen.getByRole("heading", { name: "More BYD parts" })).toBeInTheDocument();
    expect(view.listening()).toBe(0);
    expect(screen.queryByRole("button", { name: /more/i })).not.toBeInTheDocument();                        // and there is no 'Show more' button at all any more
  });

  it("CRITICAL: a full page keeps going by itself: it asks the website's door for that part's brand, NEXT page, and adds it without repeating anything", async () => {
    const view = installFakeObserver();
    reply = [{ items: [...page(11, 10), product("p1")] }];                              // the next page repeats one already shown
    sameBrand(page(1, PAGE_SIZE));
    expect(screen.getAllByRole("listitem")).toHaveLength(10);
    await act(async () => { view.reveal(); });
    expect(asked).toEqual(["/api/products?kind=sameBrand&page=2&limit=10&productId=cur"]);
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(20));        // 10 + 10 new, the repeat dropped
  });

  it("CRITICAL: the newest list never shows the part being looked at, yet a full page that CONTAINED it keeps loading (it must not stop early)", async () => {
    const view = installFakeObserver();
    reply = [{ items: [...page(11, 9), product("cur")] }];
    ar(<LoadMoreGrid id="n" title="أحدث المنتجات" initial={[...page(1, 9), product("cur")]} source={{ kind: "newest", excludeId: "cur" }} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(9);                       // ten arrived, nine are shown
    await act(async () => { view.reveal(); });
    expect(asked).toEqual(["/api/products?kind=newest&page=2&limit=10&lang=ar"]);
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(18));
    expect(screen.queryByText("Part cur")).not.toBeInTheDocument();
    expect(view.listening()).toBe(1);                                              // that page was full too, so there may be more
  });

  it("CRITICAL: stops after two more pages and offers 'See all parts' instead (these lists sit above the footer)", async () => {
    installFakeObserver({ alwaysVisible: true });
    reply = [{ items: page(11, 10) }, { items: page(21, 10) }, { items: page(31, 10) }];
    sameBrand(page(1, PAGE_SIZE));
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(30));
    await act(async () => { await Promise.resolve(); });
    expect(asked).toHaveLength(2);
    expect(screen.getByRole("link", { name: "See all parts" }).getAttribute("href")).toBe("/search");
  });

  it("a newest page that really was short ends the list (nothing more is asked)", async () => {
    const view = installFakeObserver();
    reply = [{ items: page(11, 4) }];
    en(<LoadMoreGrid id="n" title="Newest products" initial={page(1, 10)} source={{ kind: "newest", excludeId: "cur" }} />);
    await act(async () => { view.reveal(); });
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(14));
    expect(view.listening()).toBe(0);
  });
});

describe("customer photos", () => {
  const rv = (id: number, createdAt: string, photos: string[]): ReviewsSummary["reviews"][number] => ({ id, buyerName: null, rating: 5, comment: null, createdAt, photos, isVerifiedPurchase: true });
  it("draws nothing without photos; otherwise every photo once, newest review first, each opening full size", () => {
    expect(en(<CustomerPhotos lang="en" reviews={[rv(1, "2026-01-01", [])]} />).container).toBeEmptyDOMElement();
    en(<CustomerPhotos lang="en" reviews={[rv(1, "2026-01-01", ["/a.jpg", "/b.jpg"]), rv(2, "2026-03-01", ["/c.jpg", "/a.jpg"])]} />);
    expect(screen.getByRole("heading", { name: "Customer photos" })).toBeInTheDocument();
    expect(screen.getAllByRole("link").map((l) => l.getAttribute("href"))).toEqual(["/c.jpg", "/a.jpg", "/b.jpg"]);
    expect(screen.getAllByRole("link")[0].getAttribute("target")).toBe("_blank");
  });
});
