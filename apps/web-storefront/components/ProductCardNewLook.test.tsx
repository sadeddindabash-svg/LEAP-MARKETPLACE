import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ProductSummary } from "@/lib/api";

// The product card on every page: the photo with the brand logo and the discount tag, the name, the green/red stock box with the delivery date, the price (and the old price), and the add-to-cart icon beside the link.
vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-22T09:00:00Z"));
const m = vi.hoisted(() => ({ cart: { current: null as unknown } }));
vi.mock("@/components/CartProvider", () => ({ useOptionalCart: () => m.cart.current }));
vi.mock("@/components/Price", () => ({ Price: ({ usd }: { usd: number }) => <span>${usd}</span> }));
vi.mock("./Price", () => ({ Price: ({ usd }: { usd: number }) => <span>${usd}</span> }));
vi.mock("@/lib/api", () => ({ resolveImageUrl: (u: string) => `https://api.example.com${u}` }));
vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock("next/image", () => ({ default: (p: { src: string; alt: string; onError?: () => void; className?: string }) => <img src={p.src} alt={p.alt} className={p.className} onError={p.onError} /> }));
import ProductCard from "./ProductCard";
import { LangProvider } from "./LangProvider";

const product = (over: Partial<ProductSummary> = {}): ProductSummary => ({ id: "p1", name: "Brake disc", images: ["/uploads/d.jpg"], price: 35, stockQuantity: 5, oemNumber: "61610044", estimatedDeliveryDays: 7, ...over } as ProductSummary);
const show = (over: Partial<ProductSummary> = {}, lang: "en" | "ar" = "en") => render(<LangProvider lang={lang}><ul><ProductCard product={product(over)} lang={lang} /></ul></LangProvider>);
const stock = () => screen.getByTestId("stock-box"); const link = () => screen.getByRole("link", { name: /Brake disc|ديسك/ });
beforeEach(() => { m.cart.current = { addItem: vi.fn(async () => {}) }; });

describe("the stock box", () => {
  it("in stock: a filled GREEN box with white text, and the delivery date beside it", () => { show(); expect(stock().textContent).toBe("In stock"); expect(stock().getAttribute("data-stock")).toBe("in"); for (const c of ["bg-[#0f6b49]", "text-white", "rounded-md", "font-bold"]) expect(stock().className.split(" "), c).toContain(c); expect(screen.getByText("Delivery: Oct. 29")).toBeInTheDocument(); });
  it("out of stock: a filled RED box with white text, and no delivery date (nothing to deliver)", () => { show({ stockQuantity: 0 }); expect(stock().textContent).toBe("Out of stock"); expect(stock().getAttribute("data-stock")).toBe("out"); expect(stock().className).toContain("bg-[#c62f26]"); expect(stock().className).toContain("text-white"); expect(screen.queryByText(/Delivery:/)).not.toBeInTheDocument(); });
  it("no estimate: just the box", () => { show({ estimatedDeliveryDays: null }); expect(screen.queryByText(/Delivery:/)).not.toBeInTheDocument(); expect(stock().textContent).toBe("In stock"); });
  it("in Arabic: متوفر / غير متوفر, with the Arabic date", () => { show({}, "ar"); expect(stock().textContent).toBe("متوفر"); expect(screen.getByText("التسليم: 29 أكتوبر")).toBeInTheDocument(); });
});
describe("the add-to-cart icon", () => {
  it("is a button of its own BESIDE the link (never inside it: a button cannot sit in a link), at the end corner of the card", () => {
    show(); const btn = screen.getByRole("button", { name: "Add to cart: Brake disc" }); expect(link().contains(btn)).toBe(false); expect(btn.closest("div")!.className).toContain("absolute"); expect(btn.closest("div")!.className).toContain("end-4"); expect(btn.closest("div")!.className).toContain("bottom-4");
    expect(link().querySelectorAll("button")).toHaveLength(0);
  });
  it("adds this part (one), and does not open the part's page", async () => { const add = vi.fn(async () => {}); m.cart.current = { addItem: add }; show(); fireEvent.click(screen.getByRole("button", { name: "Add to cart: Brake disc" })); await Promise.resolve(); expect(add).toHaveBeenCalledWith("p1", 1); });
  it("out of stock: the button is greyed out and disabled", () => { show({ stockQuantity: 0 }); expect(screen.getByRole("button", { name: "Out of stock: Brake disc" })).toBeDisabled(); });
  it("the price row leaves room for the button at its end, so they never overlap", () => { show(); expect(screen.getByText("$35").closest("p")!.className).toContain("pe-14"); });
});
describe("the brand logo and the discount", () => {
  it("the brand's logo is in the photo's corner when the part has one (named by the brand), and nothing is drawn when it has none", () => {
    const a = show({ brandLogoUrl: "/uploads/byd.png", brand: "BYD" }); expect(screen.getByTestId("brand-badge")).toBeInTheDocument(); expect(screen.getByAltText("BYD").getAttribute("src")).toBe("https://api.example.com/uploads/byd.png"); a.unmount(); show(); expect(screen.queryByTestId("brand-badge")).not.toBeInTheDocument();
  });
  it("a discount: the tag -29% on the photo (the corner opposite the logo), the old price struck through beside the price", () => {
    show({ price: 10, originalPrice: 14, brandLogoUrl: "/uploads/byd.png", brand: "BYD" }); const tag = screen.getByTestId("discount-tag"); expect(tag.textContent).toBe("-29%"); expect(tag.getAttribute("aria-label")).toBe("-29% off"); for (const c of ["absolute", "end-2.5", "top-2.5"]) expect(tag.className.split(" "), c).toContain(c); expect(screen.getByTestId("brand-badge").className).toContain("start-2.5");
    const old = screen.getByText("$14").closest("del")!; expect(old).not.toBeNull(); expect(old.className).toContain("text-muted"); expect(screen.getByText("$10").closest("del")).toBeNull();
  });
  it("the tag colour grows with the discount: gold, orange, red", () => { for (const [orig, cls] of [[11, "#fab219"], [13, "#f26b21"], [20, "#d92d20"]] as const) { const v = show({ price: 10, originalPrice: orig }); expect(screen.getByTestId("discount-tag").className).toContain(cls); v.unmount(); } });
  it("no discount, or an old price that is not higher: no tag and no struck-through price", () => { for (const o of [null, undefined, 35, 20]) { const v = show({ originalPrice: o as never }); expect(screen.queryByTestId("discount-tag")).not.toBeInTheDocument(); expect(document.querySelector("del")).toBeNull(); v.unmount(); } });
  it("a discounted part that is out of stock still shows its tag (and the red box and the greyed button)", () => { show({ price: 10, originalPrice: 14, stockQuantity: 0 }); expect(screen.getByTestId("discount-tag")).toBeInTheDocument(); expect(stock().getAttribute("data-stock")).toBe("out"); });
  it("the tag keeps its minus in front in BOTH languages (it is read left to right, so Arabic does not turn it into \"29%-\")", () => { for (const lang of ["en", "ar"] as const) { const v = show({ price: 10, originalPrice: 14 }, lang); expect(screen.getByTestId("discount-tag").getAttribute("dir")).toBe("ltr"); v.unmount(); } });
  it("in Arabic the tag says the same percentage and is named in Arabic", () => { show({ price: 10, originalPrice: 14 }, "ar"); expect(screen.getByTestId("discount-tag").textContent).toBe("-29%"); expect(screen.getByTestId("discount-tag").getAttribute("aria-label")).toBe("خصم 29%"); });
});
describe("the rest of the card is as before", () => {
  it("one link to the part holds the photo, the name, the part number and the price; the photo is the part's first picture, drawn whole", () => { show(); expect(link().getAttribute("href")).toBe("/products/p1"); expect(link().textContent).toContain("61610044"); expect(link().textContent).toContain("$35"); const img = screen.getByAltText("Brake disc"); expect(img.className).toContain("object-contain"); expect(img.getAttribute("src")).toBe("https://api.example.com/uploads/d.jpg"); });
  it("a part with no photo shows the grey tile with an icon", () => { show({ images: [] }); expect(screen.queryByAltText("Brake disc")).not.toBeInTheDocument(); expect(link().querySelector("svg")).not.toBeNull(); });
  it("in Arabic the link keeps /ar", () => { show({}, "ar"); expect(link().getAttribute("href")).toBe("/ar/products/p1"); });
});
