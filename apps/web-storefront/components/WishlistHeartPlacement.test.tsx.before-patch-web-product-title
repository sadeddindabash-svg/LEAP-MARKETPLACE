import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Where the heart is placed on the site, and that the existing wide button agrees with it.
const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
const m = vi.hoisted(() => ({ api: { fetchWishlist: vi.fn(), addToWishlist: vi.fn(), removeFromWishlist: vi.fn(), checkWishlisted: vi.fn() } }));
vi.mock("@/components/AuthProvider", () => ({ useAuth: () => ({ user: { id: "u1" }, isLoading: false }), getAuthToken: () => "tok" }));
vi.mock("@/lib/api", () => m.api);
vi.mock("@/components/LocLink", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));
import { WishlistButton } from "./WishlistButton";
import WishlistHeart from "./WishlistHeart";
import { WishlistProvider } from "./WishlistProvider";
import { LangProvider } from "./LangProvider";
import { t } from "@/lib/i18n";

describe("in the code of the pages", () => {
  it("the shared list wraps the whole site, inside the sign-in provider and around the garage", () => { const s = read("app/layout.tsx"); const a = s.indexOf("<AuthProvider>"), w = s.indexOf("<WishlistProvider>"), g = s.indexOf("<GarageProvider>"), ge = s.indexOf("</GarageProvider>"), we = s.indexOf("</WishlistProvider>"), ae = s.indexOf("</AuthProvider>"); expect(a).toBeGreaterThan(-1); expect(a < w && w < g && g < ge && ge < we && we < ae).toBe(true); });
  it("every product card has the heart as a sibling of its link (never inside the link), after it, inside the card", () => { const s = read("components/ProductCard.tsx"); const linkEnd = s.indexOf("</Link>"), heart = s.indexOf('<WishlistHeart productId={p.id} name={p.name} variant="card" />'), liEnd = s.indexOf("</li>"); expect(heart).toBeGreaterThan(linkEnd); expect(heart).toBeLessThan(liEnd); expect(s.slice(s.indexOf("<Link"), linkEnd)).not.toContain("WishlistHeart"); expect(s).toContain('import WishlistHeart from "@/components/WishlistHeart";'); });
  it("the product page puts the heart right before Share, in the title row, beside the name", () => { const s = read("app/products/[id]/page.tsx"); expect(s).toContain('<WishlistHeart productId={product.id} name={product.name} variant="page" />\n              <ShareButton title={product.name} />'); expect(s.indexOf("</h1>")).toBeLessThan(s.indexOf("<WishlistHeart")); expect(s).toContain('import WishlistHeart from "@/components/WishlistHeart";'); expect(s).toContain("<WishlistButton productId={product.id} />"); });
});
describe("the wide button and the heart are ONE list", () => {
  beforeEach(() => { vi.clearAllMocks(); m.api.fetchWishlist.mockResolvedValue([]); m.api.addToWishlist.mockResolvedValue(undefined); m.api.removeFromWishlist.mockResolvedValue(undefined); m.api.checkWishlisted.mockResolvedValue(false); });
  const both = () => render(<LangProvider lang="en"><WishlistProvider><WishlistHeart productId="p1" name="x" variant="page" /><WishlistButton productId="p1" /></WishlistProvider></LangProvider>);
  it("pressing the heart turns the wide button to Saved, and pressing the wide button turns the heart red; the list is asked for once and the button never asks on its own", async () => {
    both(); const wide = () => screen.getByRole("button", { name: new RegExp(`${t("en", "add_to_wishlist").replace(/^\S+\s/, "")}|${t("en", "saved_to_wishlist").replace(/^\S+\s/, "")}`) }); await waitFor(() => expect(screen.getByTestId("wishlist-heart")).not.toBeDisabled());
    expect(wide().textContent).toBe(t("en", "add_to_wishlist")); fireEvent.click(screen.getByTestId("wishlist-heart")); await waitFor(() => expect(wide().textContent).toBe(t("en", "saved_to_wishlist")));
    fireEvent.click(wide()); await waitFor(() => expect(screen.getByTestId("wishlist-heart").getAttribute("data-saved")).toBe("false")); await waitFor(() => expect(wide().textContent).toBe(t("en", "add_to_wishlist")));
    expect(m.api.fetchWishlist).toHaveBeenCalledTimes(1); expect(m.api.checkWishlisted).not.toHaveBeenCalled(); expect(m.api.addToWishlist).toHaveBeenCalledTimes(1); expect(m.api.removeFromWishlist).toHaveBeenCalledTimes(1);
  });
  it("starting saved, both show saved", async () => { m.api.fetchWishlist.mockResolvedValue([{ id: "p1" }]); both(); await waitFor(() => expect(screen.getByTestId("wishlist-heart").getAttribute("data-saved")).toBe("true")); expect(screen.getByText(t("en", "saved_to_wishlist"))).toBeInTheDocument(); });
  it("outside the shared list (no provider) the wide button still works on its own, as before", async () => { m.api.checkWishlisted.mockResolvedValue(true); render(<LangProvider lang="en"><WishlistButton productId="p1" /></LangProvider>); await waitFor(() => expect(screen.getByText(t("en", "saved_to_wishlist"))).toBeInTheDocument()); expect(m.api.checkWishlisted).toHaveBeenCalledWith("tok", "p1"); });
});
describe("the words", () => {
  it("both labels exist in English and Arabic", () => { for (const k of ["wishlist_add_aria", "wishlist_remove_aria"] as const) { expect(t("en", k).length).toBeGreaterThan(0); expect(t("ar", k).length).toBeGreaterThan(0); } expect(t("en", "wishlist_add_aria")).toBe("Save to wishlist"); expect(t("ar", "wishlist_remove_aria")).toBe("إزالة من المفضلة"); });
});
