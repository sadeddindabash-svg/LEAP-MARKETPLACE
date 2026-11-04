import { describe, it, expect } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { FreeShippingBadge, FreeShippingHint } from "./FreeShipping";
import { LangProvider } from "./LangProvider";
import type { CartShipping } from "@/lib/api";

// Free shipping is celebrated every time the cart opens with shipping free, and the moment it becomes free.
const ship = (o: Partial<CartShipping>): CartShipping => ({ enabled: true, thresholdUsd: 50, feeUsd: 5, chargedUsd: 5, remainingUsd: 10, qualifies: false, waivedByPromo: false, ...o } as CartShipping);
const reached = ship({ chargedUsd: 0, remainingUsd: 0, qualifies: true });

describe("the free shipping celebration", () => {
  it("CRITICAL: a cart that opens with free shipping celebrates: the note glows with confetti, the pill pops with its shine", async () => {
    await act(async () => { render(<LangProvider lang="en"><FreeShippingHint shipping={reached} /><FreeShippingBadge shipping={reached} /></LangProvider>); });
    expect(screen.getByRole("status").className).toContain("fs-celebrate");
    expect(document.querySelectorAll(".fs-piece").length).toBe(14);
    const pill = screen.getByTestId("free-shipping-badge");
    expect(pill.className).toContain("fs-pop"); expect(pill.querySelector(".fs-shine")).not.toBeNull();
  });
  it("a cart below the limit does not celebrate", async () => {
    await act(async () => { render(<LangProvider lang="en"><FreeShippingHint shipping={ship({})} /></LangProvider>); });
    expect(document.querySelector(".fs-celebrate")).toBeNull(); expect(document.querySelectorAll(".fs-piece").length).toBe(0);
  });
  it("reaching the limit while the cart is open celebrates (without motion support, as here, it turns green at once)", async () => {
    const v = render(<LangProvider lang="en"><FreeShippingHint shipping={ship({})} /></LangProvider>);
    await act(async () => { v.rerender(<LangProvider lang="en"><FreeShippingHint shipping={reached} /></LangProvider>); });
    expect(screen.getByRole("status")).toHaveTextContent("You've reached $50: shipping is free");
    expect(screen.getByRole("status").className).toContain("fs-celebrate");
  });
});
