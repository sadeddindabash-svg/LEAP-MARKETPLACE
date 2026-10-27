import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { CartShipping } from "@/lib/api";

// The three small pieces of free shipping: the row of the summary, the note with the progress bar, and the green icon over Checkout. Amounts go through the display currency (replaced by a plain dollar format here).
vi.mock("@/components/CurrencyProvider", () => ({ useCurrency: () => ({ format: (usd: number) => `$${usd}` }) }));
vi.mock("@/components/Price", () => ({ Price: ({ usd }: { usd: number }) => <span>${usd}</span> }));
import { ShippingRow, FreeShippingHint, FreeShippingBadge, isFree } from "./FreeShipping";
import { LangProvider } from "./LangProvider";

const ship = (over: Partial<CartShipping> = {}): CartShipping => ({ enabled: true, thresholdUsd: 50, feeUsd: 5, chargedUsd: 5, remainingUsd: 30, qualifies: false, waivedByPromo: false, ...over });
const below = ship(); const reached = ship({ chargedUsd: 0, remainingUsd: 0, qualifies: true }); const promo = ship({ chargedUsd: 0, waivedByPromo: true });
const show = (node: React.ReactNode, lang: "en" | "ar" = "en") => render(<LangProvider lang={lang}>{node}</LangProvider>);

describe("when the rule is off, or there is no answer from the server, nothing is drawn", () => {
  for (const [name, s] of [["off", ship({ enabled: false, chargedUsd: 0 })], ["null", null], ["undefined", undefined]] as const) {
    it(name, () => { const { container } = show(<><ShippingRow shipping={s} /><FreeShippingHint shipping={s} /><FreeShippingBadge shipping={s} /></>); expect(container.textContent).toBe(""); });
  }
});
describe("the shipping row", () => {
  it("under the limit: \"Shipping fees\" and the fee with a plus", () => { show(<ShippingRow shipping={below} />); expect(screen.getByText("Shipping fees")).toBeInTheDocument(); expect(screen.getByTestId("shipping-fee")).toHaveTextContent("+$5"); expect(screen.queryByTestId("shipping-fee-struck")).not.toBeInTheDocument(); });
  it("at or above the limit: the fee is struck through and it says Free, in green", () => { show(<ShippingRow shipping={reached} />); expect(screen.getByTestId("shipping-fee-struck")).toHaveTextContent("$5"); expect(screen.getByTestId("shipping-fee-struck").tagName).toBe("DEL"); expect(screen.getByText("Free").closest("span")!.className).toContain("text-[#0f6b49]"); expect(screen.queryByTestId("shipping-fee")).not.toBeInTheDocument(); });
  it("waived by a promo code: also Free", () => { show(<ShippingRow shipping={promo} />); expect(screen.getByText("Free")).toBeInTheDocument(); });
  it("in Arabic: رسوم الشحن and مجاني", () => { show(<><ShippingRow shipping={below} /><ShippingRow shipping={reached} /></>, "ar"); expect(screen.getAllByText("رسوم الشحن")).toHaveLength(2); expect(screen.getByText("مجاني")).toBeInTheDocument(); });
});
describe("the note", () => {
  it("under the limit: how much more is needed, with a progress bar showing how far the basket is (30 of 50 missing = 40%)", () => {
    show(<FreeShippingHint shipping={below} />); const hint = screen.getByTestId("shipping-hint"); expect(hint.getAttribute("data-state")).toBe("below"); expect(hint).toHaveTextContent("Add $30 more for free shipping");
    const bar = screen.getByRole("progressbar"); expect(bar.getAttribute("aria-valuenow")).toBe("40"); expect(bar.getAttribute("aria-valuemin")).toBe("0"); expect(bar.getAttribute("aria-valuemax")).toBe("100"); expect(screen.getByTestId("shipping-progress").style.width).toBe("40%");
  });
  it("the bar never goes outside 0 to 100", () => { const a = show(<FreeShippingHint shipping={ship({ remainingUsd: 70 })} />); expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("0"); a.unmount(); show(<FreeShippingHint shipping={ship({ remainingUsd: -5 })} />); expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("100"); });
  it("a limit of 0 draws an empty bar, not a crash", () => { show(<FreeShippingHint shipping={ship({ thresholdUsd: 0, remainingUsd: 0 })} />); expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("0"); });
  it("at the limit: a green note saying the limit was reached and shipping is free (announced politely)", () => { show(<FreeShippingHint shipping={reached} />); const hint = screen.getByRole("status"); expect(hint.getAttribute("data-state")).toBe("reached"); expect(hint).toHaveTextContent("You've reached $50: shipping is free"); expect(hint.className).toContain("bg-[#e3f4ec]"); expect(screen.queryByRole("progressbar")).not.toBeInTheDocument(); });
  it("with a promo code: a green note about the code, whatever the basket", () => { show(<FreeShippingHint shipping={promo} />); expect(screen.getByRole("status")).toHaveTextContent("Free shipping with your promo code"); expect(screen.getByTestId("shipping-hint").getAttribute("data-state")).toBe("promo"); });
  it("in Arabic the sentences are Arabic and carry the amount", () => { show(<><FreeShippingHint shipping={below} /><FreeShippingHint shipping={reached} /></>, "ar"); expect(screen.getByText("أضف $30 للحصول على شحن مجاني")).toBeInTheDocument(); expect(screen.getByText("وصلت إلى $50: الشحن مجاني")).toBeInTheDocument(); });
});
describe("the icon over Checkout", () => {
  it("shows \"Free shipping\" once shipping is free (limit reached, or a promo code), as a green pill in the end corner (it mirrors in Arabic)", () => {
    for (const s of [reached, promo]) { const v = show(<FreeShippingBadge shipping={s} />); const b = screen.getByTestId("free-shipping-badge"); expect(b).toHaveTextContent("Free shipping"); for (const c of ["absolute", "-top-3.5", "end-3.5", "bg-[#1e9d6b]", "text-white", "rounded-full"]) expect(b.className.split(" "), c).toContain(c); v.unmount(); }
  });
  it("is not shown while a fee is charged, when the rule is off, or when nothing is charged for another reason (an empty basket)", () => {
    for (const s of [below, ship({ enabled: false, chargedUsd: 0, qualifies: true }), ship({ chargedUsd: 0, qualifies: false, waivedByPromo: false })]) { const v = show(<FreeShippingBadge shipping={s} />); expect(screen.queryByTestId("free-shipping-badge")).not.toBeInTheDocument(); v.unmount(); }
  });
  it("in Arabic: شحن مجاني", () => { show(<FreeShippingBadge shipping={reached} />, "ar"); expect(screen.getByTestId("free-shipping-badge")).toHaveTextContent("شحن مجاني"); });
  it("isFree: only when the rule is on, nothing is charged, and the limit is reached or a code waives it", () => { expect(isFree(reached)).toBe(true); expect(isFree(promo)).toBe(true); expect(isFree(below)).toBe(false); expect(isFree(null)).toBe(false); expect(isFree(ship({ enabled: false, chargedUsd: 0, qualifies: true }))).toBe(false); expect(isFree(ship({ chargedUsd: 0 }))).toBe(false); });
});
