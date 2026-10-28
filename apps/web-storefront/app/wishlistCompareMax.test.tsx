import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import type { ProductSummary } from "@/lib/api";

// The wishlist's compare mode: at most 4 parts on a tablet or a computer, at most 2 on a phone (a screen under 768 px), whatever way the screen is turned.
const m = vi.hoisted(() => ({ items: { current: [] as unknown[] } }));
vi.mock("@/components/AuthProvider", () => ({ useAuth: () => ({ user: { id: "u1", email: "a@b.c" }, isLoading: false }), getAuthToken: () => "tok" }));
vi.mock("@/lib/api", () => ({ fetchWishlist: async () => m.items.current, removeFromWishlist: async () => {}, resolveImageUrl: (u: string) => u }));
vi.mock("@/components/Price", () => ({ Price: ({ usd }: { usd: number }) => <span>${usd}</span> }));
vi.mock("@/components/LocLink", () => ({ default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => <a href={href} className={className}>{children}</a> }));
vi.mock("next/image", () => ({ default: (p: { src: string; alt: string }) => <img src={p.src} alt={p.alt} /> }));
import WishlistPage from "./wishlist/page";
import { LangProvider } from "@/components/LangProvider";

let listeners: Array<() => void> = []; let phone = false;
function screenIs(isPhone: boolean) { phone = isPhone; window.matchMedia = vi.fn().mockImplementation((q: string) => ({ get matches() { return q.includes("max-width: 767px") ? phone : false; }, media: q, addEventListener: (_: string, l: () => void) => { listeners.push(l); }, removeEventListener: (_: string, l: () => void) => { listeners = listeners.filter((x) => x !== l); }, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as never; }
const turn = (isPhone: boolean) => act(() => { phone = isPhone; listeners.forEach((l) => l()); });
const part = (id: string): ProductSummary => ({ id, name: `Part ${id}`, price: 10, images: [], stockQuantity: 5 } as unknown as ProductSummary);
const open = async (lang: "en" | "ar" = "en") => { m.items.current = ["a", "b", "c", "d", "e"].map(part); render(<LangProvider lang={lang}><WishlistPage /></LangProvider>); await screen.findByText("Part a"); fireEvent.click(screen.getByRole("button", { name: /^(Compare|قارن|مقارنة)$/ })); };
const box = (id: string) => screen.getByRole("checkbox", { name: `Part ${id}` }) as HTMLInputElement;
const tick = (...ids: string[]) => ids.forEach((id) => fireEvent.click(box(id)));
beforeEach(() => { listeners = []; screenIs(false); });

describe("on a computer or tablet", () => {
  it("up to 4 parts can be ticked; the fifth is disabled; the hint says 2 to 4; the link compares the 4", async () => {
    await open(); expect(screen.getByText("Pick 2 to 4 parts to compare.")).toBeInTheDocument(); tick("a", "b", "c", "d"); expect(box("e").disabled).toBe(true); expect(box("a").disabled).toBe(false);
    expect(screen.getByRole("link", { name: "Compare (4)" }).getAttribute("href")).toBe("/compare?ids=a,b,c,d");
  });
});
describe("on a phone", () => {
  it("only 2 parts can be ticked: the others are disabled, a ticked one can be unticked, the hint says 2 at a time, the link compares the 2", async () => {
    screenIs(true); await open(); await waitFor(() => expect(screen.getByText("Pick 2 parts to compare. On a phone, 2 at a time.")).toBeInTheDocument()); expect(screen.queryByText("Pick 2 to 4 parts to compare.")).not.toBeInTheDocument();
    tick("a", "b"); for (const id of ["c", "d", "e"]) expect(box(id).disabled, id).toBe(true); expect(box("a").disabled).toBe(false);
    expect(screen.getByRole("link", { name: "Compare (2)" }).getAttribute("href")).toBe("/compare?ids=a,b"); tick("a"); expect(box("c").disabled).toBe(false); tick("c"); expect(screen.getByRole("link", { name: "Compare (2)" }).getAttribute("href")).toBe("/compare?ids=b,c");
  });
  it("one ticked part is not enough to compare (the need-two message), on a phone too", async () => { screenIs(true); await open(); tick("a"); expect(screen.getByText("Pick at least 2 parts to compare.")).toBeInTheDocument(); expect(screen.queryByRole("link", { name: /^Compare \(/ })).not.toBeInTheDocument(); });
  it("the Arabic hint for a phone", async () => { screenIs(true); await open("ar"); await waitFor(() => expect(screen.getByText("اختر قطعتين للمقارنة. على الهاتف تُقارَن قطعتان في المرة الواحدة.")).toBeInTheDocument()); });
});
describe("when the screen is turned or resized", () => {
  it("from a computer-size screen with 4 ticked to a phone-size one: only the first 2 stay ticked, and the link follows", async () => {
    await open(); tick("a", "b", "c", "d"); turn(true); await waitFor(() => expect(screen.getByRole("link", { name: "Compare (2)" }).getAttribute("href")).toBe("/compare?ids=a,b")); expect(box("a").checked).toBe(true); expect(box("c").checked).toBe(false); expect(box("e").disabled).toBe(true);
  });
  it("from a phone to a tablet (turned sideways past 768 px): 4 can be ticked again", async () => { screenIs(true); await open(); tick("a", "b"); expect(box("c").disabled).toBe(true); turn(false); await waitFor(() => expect(box("c").disabled).toBe(false)); tick("c", "d"); expect(screen.getByRole("link", { name: "Compare (4)" })).toBeInTheDocument(); });
});
