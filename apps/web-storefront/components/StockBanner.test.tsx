import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import StockBanner, { LOW_STOCK } from "./StockBanner";

// The box under the title, as in the mobile app: "In stock · Delivery: Oct. 29", "Only 3 left · Delivery: Oct. 29" when 5 or fewer are left, "Currently out of stock".
vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-22T09:00:00Z"));
const text = (stock: number, days: number | null, lang: "en" | "ar" = "en") => { const { container } = render(<StockBanner stockQuantity={stock} estimatedDeliveryDays={days} lang={lang} />); const p = container.querySelector("p")!; return { text: p.textContent, state: p.getAttribute("data-stock"), cls: p.className, svg: container.querySelector("svg")! }; };

describe("stock and delivery", () => {
  it("plenty in stock: \"In stock · Delivery: Oct. 29\" in the green box (the card colour, no number)", () => { const r = text(24, 7); expect(r.text).toBe("In stock · Delivery: Oct. 29"); expect(r.state).toBe("in"); expect(r.cls).toContain("bg-[#0f6b49]"); expect(r.cls).toContain("text-white"); });
  it("5 or fewer left: the number is shown, in amber: \"Only 3 left · Delivery: Oct. 29\"", () => {
    expect(LOW_STOCK).toBe(5); const r = text(3, 7); expect(r.text).toBe("Only 3 left · Delivery: Oct. 29"); expect(r.state).toBe("low"); expect(r.cls).toContain("bg-[#fab219]"); expect(r.cls).toContain("text-navy"); expect(text(1, 7).text).toBe("Only 1 left · Delivery: Oct. 29");
  });
  it("exactly 5 is still \"Only 5 left\", 6 is \"In stock\"", () => { expect(text(5, 7).text).toBe("Only 5 left · Delivery: Oct. 29"); expect(text(5, 7).state).toBe("low"); expect(text(6, 7).text).toBe("In stock · Delivery: Oct. 29"); expect(text(6, 7).state).toBe("in"); });
  it("out of stock: \"Currently out of stock\", no delivery date (nothing to deliver), in the red of the cards", () => { for (const n of [0, -3]) { const r = text(n, 7); expect(r.text).toBe("Currently out of stock"); expect(r.state).toBe("out"); expect(r.cls).toContain("bg-[#c62f26]"); expect(r.cls).toContain("text-white"); expect(r.cls).not.toContain("bg-gauge"); } });
  it("no delivery estimate: just the stock words, with no dangling separator", () => { expect(text(24, null).text).toBe("In stock"); expect(text(2, null).text).toBe("Only 2 left"); });
  it("the delivery date follows today's date", () => { vi.setSystemTime(new Date("2026-10-30T09:00:00Z")); expect(text(24, 7).text).toBe("In stock · Delivery: Nov. 6"); vi.setSystemTime(new Date("2026-10-22T09:00:00Z")); });
  it("in Arabic: متوفر, متبقٍ N فقط, غير متوفر حاليًا, with التسليم and the Arabic date", () => { expect(text(24, 7, "ar").text).toBe("متوفر · التسليم: 29 أكتوبر"); expect(text(3, 7, "ar").text).toBe("متبقٍ 3 فقط · التسليم: 29 أكتوبر"); expect(text(0, 7, "ar").text).toBe("غير متوفر حاليًا"); });
  it("the icon is decoration (hidden from screen readers) and differs between available and not available", () => { expect(text(24, 7).svg.getAttribute("aria-hidden")).toBe("true"); expect(text(24, 7).svg.innerHTML).not.toBe(text(0, 7).svg.innerHTML); });
  it("the box fits its words, not the whole width (and wraps inside the column when the words are long), in every state", () => { for (const n of [24, 3, 0]) { const r = text(n, 7); expect(r.cls).toContain("w-fit"); expect(r.cls).toContain("max-w-full"); expect(r.cls).not.toMatch(/(^|\s)w-full(\s|$)/); expect(r.cls).toContain("flex"); } });
  it("the colours are exactly those of the product cards' stock boxes (green and red), so a card and its page agree", () => { expect(text(24, 7).cls).toContain("bg-[#0f6b49]"); expect(text(0, 7).cls).toContain("bg-[#c62f26]"); });
});
