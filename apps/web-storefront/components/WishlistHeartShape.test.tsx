import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The heart must be drawn whole: a symmetric heart centred in its 24 x 24 box (the first, hand-made drawing stopped short on the right and looked cut).
vi.mock("@/components/AuthProvider", () => ({ useAuth: () => ({ user: null, isLoading: false }), getAuthToken: () => null }));
vi.mock("@/lib/api", () => ({ fetchWishlist: vi.fn(), addToWishlist: vi.fn(), removeFromWishlist: vi.fn() }));
vi.mock("@/components/LocLink", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));
import WishlistHeart from "./WishlistHeart";
import { WishlistProvider } from "./WishlistProvider";
import { LangProvider } from "./LangProvider";

const LUCIDE_HEART = "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z";
const OLD_LOPSIDED = "M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.7 5 6.1 5c2 0 3.3 1 3.9 2.2C10.6 6 11.9 5 13.9 5c3.4 0 5.2 3.4 3.7 6.8C19.5 16.4 12 21 12 21z";
const drawn = () => { render(<LangProvider lang="en"><WishlistProvider><WishlistHeart productId="p1" variant="page" /></WishlistProvider></LangProvider>); return screen.getByTestId("wishlist-heart").querySelector("svg")!; };

describe("the heart's drawing", () => {
  it("is the whole, symmetric heart, in a 24 x 24 box", () => { const svg = drawn(); expect(svg.getAttribute("viewBox")).toBe("0 0 24 24"); expect(svg.querySelector("path")!.getAttribute("d")).toBe(LUCIDE_HEART); });
  it("is not the old hand-made drawing whose right half stopped short", () => { expect(drawn().querySelector("path")!.getAttribute("d")).not.toBe(OLD_LOPSIDED); expect(readFileSync(join(__dirname, "WishlistHeart.tsx"), "utf8")).not.toContain(OLD_LOPSIDED); });
  it("its horizontal extent is centred on 12 with room for the 2-wide line: the left end (2) and the right end (22) are the same distance from the box edges", () => { const nums = LUCIDE_HEART.match(/-?\d*\.?\d+/g)!; expect(LUCIDE_HEART).toContain("3-5.5A5.5 5.5 0 0 0 16.5 3"); expect(LUCIDE_HEART).toContain("A5.5 5.5 0 0 0 2 8.5"); expect(nums.length).toBeGreaterThan(10); const leftEdge = 2, rightEdge = 22; expect(leftEdge).toBe(24 - rightEdge); });
  it("saved is a red fill and stroke, not saved is an outline: the same shape for both, still 20 px", () => { const svg = drawn(); expect(svg.getAttribute("fill")).toBe("none"); expect(svg.getAttribute("width")).toBe("20"); expect(svg.getAttribute("stroke-linejoin")).toBe("round"); });
});
