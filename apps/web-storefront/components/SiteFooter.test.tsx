import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";

// The footer: the website's own footer until the admin sets something; then the admin's tagline, column titles, link wording and visibility, copyright, social media icons, and links to the six pages inside the storefront.
const m = vi.hoisted(() => ({ footer: { current: null as unknown } }));
vi.mock("@/lib/api", () => ({ fetchFooterContent: vi.fn(async () => m.footer.current), resolveImageUrl: (u: string) => `https://api.example.com${u}` }));
vi.mock("next/image", () => ({ default: ({ src, alt, fill, ...rest }: { src: string; alt: string; fill?: boolean }) => <img src={src} alt={alt} data-fill={fill ? "yes" : undefined} {...(rest as object)} /> }));
import SiteFooter from "./SiteFooter";
import { LangProvider } from "./LangProvider";

const pair = (en: string | null = null, ar: string | null = null) => ({ en, ar });
const links = (over: Record<string, unknown> = {}) => Object.fromEntries(["about", "terms", "delivery", "refund", "privacy", "cancellation"].map((k) => [k, { ...pair(), shown: true, ...(over[k] as object | undefined) }]));
const footer = (over: { text?: Record<string, unknown>; social?: unknown[]; pages?: Record<string, boolean> } = {}) => ({
  text: { tagline: pair(), copyright: pair(), titles: { shop: pair(), account: pair(), help: pair(), useful: pair() }, links: links(), ...(over.text || {}) },
  social: over.social ?? [], pages: { about: false, terms: false, delivery: false, refund: false, privacy: false, cancellation: false, ...(over.pages || {}) },
});
const show = async (lang: "en" | "ar" = "en") => render(<LangProvider lang={lang}>{await SiteFooter({ lang })}</LangProvider>);
const useful = () => within(screen.getByRole("navigation", { name: /Useful links|روابط مفيدة/ }));
beforeEach(() => { m.footer.current = null; });

describe("the website's own footer (nothing set, or the shop cannot be reached)", () => {
  it("shows its own tagline, the year in the copyright, and the six links to the existing website (the privacy page at its real, old address)", async () => {
    await show(); const year = new Date().getFullYear();
    expect(screen.getByText("Real parts, direct from verified suppliers.")).toBeInTheDocument(); expect(screen.getByText(`Copyright © Leap Auto Parts ${year}`)).toBeInTheDocument(); expect(screen.queryByRole("list", { name: "Follow us" })).not.toBeInTheDocument();
    const hrefs = useful().getAllByRole("link").map((a) => a.getAttribute("href")); expect(hrefs).toEqual(["about-us", "terms-conditions", "delivery-shipping-policy", "refund-policy", "privecy-policy", "cancellation-replacement-policy"].map((s) => `https://www.leapautoparts.com/${s}`));
  });
  it("Arabic: the Arabic website's addresses", async () => { await show("ar"); expect(useful().getAllByRole("link")[0].getAttribute("href")).toBe("https://www.leapautoparts.com/ar/about-us"); });
});
describe("the admin's wording", () => {
  it("tagline, copyright (with the year filled in), the four column titles and the link wording, per language", async () => {
    m.footer.current = footer({ text: { tagline: pair("Genuine parts", "قطع أصلية"), copyright: pair("© Leap {year}. All rights reserved.", "© ليب {year}"), titles: { shop: pair("Browse"), account: pair(), help: pair("Need help?"), useful: pair("Company") }, links: links({ about: pair("Who we are", "من نحن"), refund: pair("Returns & refunds") }) } });
    await show(); const year = new Date().getFullYear();
    expect(screen.getByText("Genuine parts")).toBeInTheDocument(); expect(screen.getByText(`© Leap ${year}. All rights reserved.`)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Browse" })).toBeInTheDocument(); expect(screen.getByRole("heading", { name: "My account" })).toBeInTheDocument(); expect(screen.getByRole("heading", { name: "Need help?" })).toBeInTheDocument(); expect(screen.getByRole("heading", { name: "Company" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Company" })).toBeInTheDocument(); expect(screen.getByRole("link", { name: "Who we are" })).toBeInTheDocument(); expect(screen.getByRole("link", { name: "Returns & refunds" })).toBeInTheDocument(); expect(screen.getByRole("link", { name: "Terms & Conditions" })).toBeInTheDocument();
  });
  it("Arabic uses the Arabic wording, and one language never borrows the other's", async () => {
    m.footer.current = footer({ text: { tagline: pair("English only", "قطع أصلية"), links: links({ about: pair("English about", null) }) } }); await show("ar");
    expect(screen.getByText("قطع أصلية")).toBeInTheDocument(); expect(screen.queryByText("English only")).not.toBeInTheDocument(); expect(screen.queryByRole("link", { name: "English about" })).not.toBeInTheDocument(); expect(useful().getAllByRole("link")[0]).toHaveTextContent("من نحن");
  });
  it("a link the admin hid is gone, and the others stay in their order", async () => {
    m.footer.current = footer({ text: { links: links({ terms: { shown: false }, cancellation: { shown: false } }) } }); await show();
    expect(useful().getAllByRole("link").map((a) => a.textContent)).toEqual(["About us", "Delivery & Shipping", "Refund", "Privacy Policy"]);
  });
  it("SAFETY: the admin's text is drawn as text, never as HTML", async () => {
    m.footer.current = footer({ text: { tagline: pair("<img src=x onerror=alert(1)> Hi") } }); const { container } = await show(); expect(container.querySelector("img[onerror]")).toBeNull(); expect(screen.getByText("<img src=x onerror=alert(1)> Hi")).toBeInTheDocument();
  });
});
describe("the six links", () => {
  it("a page that has text opens INSIDE the storefront (same tab); a page without text still goes to the old website", async () => {
    m.footer.current = footer({ pages: { about: true, privacy: true } }); await show(); const a = useful().getAllByRole("link");
    expect(a[0].getAttribute("href")).toBe("/about-us"); expect(a[4].getAttribute("href")).toBe("/privacy-policy"); expect(a[1].getAttribute("href")).toBe("https://www.leapautoparts.com/terms-conditions"); expect(a[0].getAttribute("target")).toBeNull();
  });
  it("in Arabic the page links keep the /ar language prefix", async () => { m.footer.current = footer({ pages: { terms: true } }); await show("ar"); expect(useful().getAllByRole("link")[1].getAttribute("href")).toBe("/ar/terms-conditions"); });
  it("when all six have text, none points to the old website", async () => {
    m.footer.current = footer({ pages: { about: true, terms: true, delivery: true, refund: true, privacy: true, cancellation: true } }); await show();
    expect(useful().getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(["/about-us", "/terms-conditions", "/delivery-shipping-policy", "/refund-policy", "/privacy-policy", "/cancellation-replacement-policy"]);
  });
});
describe("the social media icons under the tagline", () => {
  const item = (id: string, name: string, url: string | null, icon: string | null = null) => ({ id, name, url, icon });
  it("only an icon with a link is shown; each opens in a new tab, is named for a screen reader, and keeps the admin's order", async () => {
    m.footer.current = footer({ social: [item("1", "Facebook", "https://facebook.com/leap"), item("2", "Draft", null), item("3", "Instagram", "https://instagram.com/leap")] }); await show();
    const list = screen.getByRole("list", { name: "Follow us" }); const links2 = within(list).getAllByRole("link");
    expect(links2.map((a) => a.getAttribute("aria-label"))).toEqual(["Facebook", "Instagram"]); expect(links2.map((a) => a.getAttribute("href"))).toEqual(["https://facebook.com/leap", "https://instagram.com/leap"]);
    for (const a of links2) { expect(a.getAttribute("target")).toBe("_blank"); expect(a.getAttribute("rel")).toBe("noopener noreferrer"); }
  });
  it("an icon with no picture of its own shows the Leap logo; one with a picture shows it", async () => {
    m.footer.current = footer({ social: [item("1", "Facebook", "https://f.com"), item("2", "Instagram", "https://i.com", "/uploads/ig.png")] }); await show();
    const [fb, ig] = within(screen.getByRole("list", { name: "Follow us" })).getAllByRole("link").map((a) => a.querySelector("img")!);
    expect(fb.getAttribute("src")).toBe("/leap-logo.png"); expect(ig.getAttribute("src")).toContain("https://api.example.com/uploads/ig.png");
  });
  it("nothing to show (none, or none with a link) leaves no empty list", async () => {
    m.footer.current = footer({ social: [item("1", "Draft", null)] }); await show(); expect(screen.queryByRole("list", { name: "Follow us" })).not.toBeInTheDocument();
  });
  it("Arabic: the list is named in Arabic", async () => { m.footer.current = footer({ social: [item("1", "Facebook", "https://f.com")] }); await show("ar"); expect(screen.getByRole("list", { name: "تابعنا" })).toBeInTheDocument(); });
});
