import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// The heart: outline when not saved, red when saved; a press saves or unsaves and never opens the part; signed out it leads to the login page; on a card it sits on the photo's corner at the END side.
const m = vi.hoisted(() => ({ auth: { current: { user: { id: "u1" } as { id: string } | null, isLoading: false } }, api: { fetchWishlist: vi.fn(), addToWishlist: vi.fn(), removeFromWishlist: vi.fn() } }));
vi.mock("@/components/AuthProvider", () => ({ useAuth: () => m.auth.current, getAuthToken: () => "tok" }));
vi.mock("@/lib/api", () => m.api);
vi.mock("@/components/LocLink", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));
import WishlistHeart from "./WishlistHeart";
import { WishlistProvider } from "./WishlistProvider";
import { LangProvider } from "./LangProvider";

const show = (variant: "card" | "page", lang: "en" | "ar" = "en", name: string | null = "Brakes Part 1") => render(<LangProvider lang={lang}><WishlistProvider><WishlistHeart productId="p1" name={name ?? undefined} variant={variant} /></WishlistProvider></LangProvider>);
const heart = () => screen.getByTestId("wishlist-heart");
beforeEach(() => { vi.clearAllMocks(); m.auth.current = { user: { id: "u1" }, isLoading: false }; m.api.fetchWishlist.mockResolvedValue([]); m.api.addToWishlist.mockResolvedValue(undefined); m.api.removeFromWishlist.mockResolvedValue(undefined); });

describe("the states", () => {
  it("not saved: an outline heart, pressed=false, labelled Save to wishlist with the part's name", async () => { show("page"); await waitFor(() => expect(heart()).not.toBeDisabled()); expect(heart().getAttribute("aria-label")).toBe("Save to wishlist: Brakes Part 1"); expect(heart().getAttribute("aria-pressed")).toBe("false"); expect(heart().getAttribute("data-saved")).toBe("false"); expect(heart().querySelector("svg")!.getAttribute("fill")).toBe("none"); });
  it("saved: a RED heart, pressed=true, labelled Remove from wishlist", async () => { m.api.fetchWishlist.mockResolvedValue([{ id: "p1" }]); show("page"); await waitFor(() => expect(heart().getAttribute("data-saved")).toBe("true")); expect(heart().getAttribute("aria-label")).toBe("Remove from wishlist: Brakes Part 1"); expect(heart().getAttribute("aria-pressed")).toBe("true"); expect(heart().querySelector("svg")!.getAttribute("fill")).toBe("#d92d20"); expect(heart().className).toContain("text-[#d92d20]"); });
  it("without a name the label is just the action", async () => { show("page", "en", null); await waitFor(() => expect(heart()).not.toBeDisabled()); expect(heart().getAttribute("aria-label")).toBe("Save to wishlist"); });
  it("in Arabic the labels are Arabic", async () => { show("page", "ar"); await waitFor(() => expect(heart()).not.toBeDisabled()); expect(heart().getAttribute("aria-label")).toBe("حفظ في المفضلة: Brakes Part 1"); });
  it("it cannot be pressed until the list has loaded (no wrong first state)", () => { m.api.fetchWishlist.mockReturnValue(new Promise(() => {})); show("page"); expect(heart()).toBeDisabled(); });
  it("outside the site's provider it draws nothing", () => { const { container } = render(<LangProvider lang="en"><WishlistHeart productId="p1" variant="card" /></LangProvider>); expect(container.innerHTML).toBe(""); });
});
describe("pressing it", () => {
  it("saves, turns red at once, and tells the server; pressing again unsaves", async () => { show("page"); await waitFor(() => expect(heart()).not.toBeDisabled()); fireEvent.click(heart()); expect(heart().getAttribute("data-saved")).toBe("true"); await waitFor(() => expect(m.api.addToWishlist).toHaveBeenCalledWith("tok", "p1")); fireEvent.click(heart()); expect(heart().getAttribute("data-saved")).toBe("false"); await waitFor(() => expect(m.api.removeFromWishlist).toHaveBeenCalledWith("tok", "p1")); });
  it("a press NEVER opens the part: it does not reach the card's link and the click is cancelled", async () => {
    const outer = vi.fn(); render(<LangProvider lang="en"><WishlistProvider><a href="/products/p1" onClick={outer}><WishlistHeart productId="p1" name="x" variant="page" /></a></WishlistProvider></LangProvider>);
    await waitFor(() => expect(heart()).not.toBeDisabled()); const ev = new MouseEvent("click", { bubbles: true, cancelable: true }); heart().dispatchEvent(ev); expect(ev.defaultPrevented).toBe(true); expect(outer).not.toHaveBeenCalled();
  });
  it("a failed save puts the heart back to outline", async () => { m.api.addToWishlist.mockRejectedValue(new Error("no")); show("page"); await waitFor(() => expect(heart()).not.toBeDisabled()); fireEvent.click(heart()); await waitFor(() => expect(heart().getAttribute("data-saved")).toBe("false")); });
});
describe("signed out", () => {
  it("the heart is a link to the login page (like the wide Log in to save button), never a save", () => { m.auth.current = { user: null, isLoading: false }; show("page"); const h = heart(); expect(h.tagName).toBe("A"); expect(h.getAttribute("href")).toBe("/login"); expect(h.getAttribute("aria-label")).toMatch(/Log in to save/); expect(h.getAttribute("data-saved")).toBe("false"); fireEvent.click(h); expect(m.api.addToWishlist).not.toHaveBeenCalled(); expect(m.api.fetchWishlist).not.toHaveBeenCalled(); });
});
describe("where it sits", () => {
  it("CARD: laid over the square photo (a box of its own that cannot be clicked), the heart at its bottom corner at the END side (it flips in Arabic), 38 px, above the photo", async () => {
    const { container } = show("card"); await waitFor(() => expect(heart()).not.toBeDisabled()); const box = container.firstElementChild as HTMLElement; expect(box.className).toContain("pointer-events-none"); expect(box.className).toContain("absolute"); expect(box.className).toContain("inset-x-0"); expect(box.className).toContain("top-0"); expect(box.className).toContain("aspect-square");
    for (const c of ["pointer-events-auto", "absolute", "bottom-2.5", "end-2.5", "z-10", "size-[38px]"]) expect(heart().className, c).toContain(c); expect(heart().className).not.toMatch(/(^|\s)(left|right|start)-/);
  });
  it("PAGE: a 42 px round button in the flow (not laid over anything), to sit beside Share", async () => { const { container } = show("page"); await waitFor(() => expect(heart()).not.toBeDisabled()); expect(container.firstElementChild).toBe(heart()); expect(heart().className).toContain("size-[42px]"); expect(heart().className).not.toContain("absolute"); expect(heart().className).toContain("rounded-full"); });
});
