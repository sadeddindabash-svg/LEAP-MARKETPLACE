import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import type { ProductSummary } from "@/lib/api";

// The product card shows the delivery DATE, as the mobile app does (and not "Delivery in N days").
vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-22T09:00:00Z"));
vi.mock("@/components/Price", () => ({ Price: ({ usd }: { usd: number }) => <span>${usd}</span> }));
vi.mock("@/lib/api", async () => ({ resolveImageUrl: (u: string) => `http://api${u}` }));
import ProductCard from "./ProductCard";
import { LangProvider } from "./LangProvider";

const product = (over: Partial<ProductSummary> = {}): ProductSummary => ({ id: "p1", name: "Wiper blade", images: ["/uploads/w.jpg"], price: 12, stockQuantity: 5, oemNumber: "61610044", estimatedDeliveryDays: 7, ...over } as ProductSummary);
const line = (p: ProductSummary, lang: "en" | "ar" = "en") => render(<LangProvider lang={lang}><ul><ProductCard product={p} lang={lang} /></ul></LangProvider>).container.querySelector("p.flex")!.textContent;
describe("the delivery on a product card", () => {
  it("is the date: a green \"In stock\" box and \"Delivery: Oct. 29\"", () => { expect(line(product())).toBe("In stockDelivery: Oct. 29"); });
  it("in Arabic: التسليم with the Arabic date", () => { expect(line(product(), "ar")).toContain("التسليم: 29 أكتوبر"); });
  it("no estimate, no delivery words; out of stock still says so", () => { expect(line(product({ estimatedDeliveryDays: null }))).toBe("In stock"); expect(line(product({ stockQuantity: 0, estimatedDeliveryDays: null }))).toBe("Out of stock"); expect(line(product({ stockQuantity: 0 }))).toBe("Out of stock"); });
  it("never the old wording", () => { expect(line(product())).not.toMatch(/Delivery in|days/); });
});
