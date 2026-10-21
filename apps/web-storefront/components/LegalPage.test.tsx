import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// One of the six pages: the admin's title and text in the visitor's language, the date, the message when there is no text yet, and the search-result details.
const m = vi.hoisted(() => ({ lang: { current: "en" as "en" | "ar" }, page: { current: null as unknown } }));
vi.mock("@/lib/lang", () => ({ getLang: vi.fn(async () => m.lang.current) }));
vi.mock("@/lib/api", () => ({ fetchLegalPage: vi.fn(async () => m.page.current) }));
import LegalPage, { legalMetadata } from "./LegalPage";
import type { PageKey } from "@/lib/footerContent";
import { LangProvider } from "./LangProvider";

const page = (over = {}) => ({ key: "terms", slug: "terms-conditions", title: { en: "Terms of use", ar: "شروط الاستخدام" }, body: { en: "## Rules\nBe kind to **everyone**.", ar: "## القواعد\nكن لطيفا." }, updatedAt: "2026-10-21T10:00:00.000Z", hasContent: true, ...over });
const show = async (key: PageKey = "terms", lang: "en" | "ar" = "en") => { m.lang.current = lang; return render(<LangProvider lang={lang}>{await LegalPage({ pageKey: key })}</LangProvider>); };
beforeEach(() => { vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://shop.example.com"); m.lang.current = "en"; m.page.current = page(); });

describe("a page with text", () => {
  it("shows the admin's title as the heading, the date, and the text formatted", async () => {
    const { container } = await show(); expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Terms of use"); expect(screen.getByText("Last updated: 21 October 2026")).toBeInTheDocument();
    expect(container.querySelector("h2")!.textContent).toBe("Rules"); expect(container.querySelector("strong")!.textContent).toBe("everyone");
  });
  it("is an article inside the site's own main area: a page may have only one <main>, and the layout already has it", async () => {
    const { container } = await show(); expect(container.querySelector("main")).toBeNull(); expect(container.querySelector("article")).not.toBeNull();
    m.page.current = page({ hasContent: false, body: { en: null, ar: null } }); document.body.innerHTML = ""; const empty = await show(); expect(empty.container.querySelector("main")).toBeNull();
  });
  it("in Arabic: the Arabic title and text, and the date with Western digits", async () => {
    await show("terms", "ar"); expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("شروط الاستخدام"); expect(screen.getByText(/آخر تحديث: 21/)).toBeInTheDocument(); expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("القواعد");
  });
  it("a page written in only one language shows that text in the other language too (better than nothing)", async () => {
    m.page.current = page({ body: { en: "Only English text.", ar: null }, title: { en: "Terms", ar: null } }); await show("terms", "ar"); expect(screen.getByText("Only English text.")).toBeInTheDocument(); expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Terms");
  });
  it("a page without a title shows the footer's own name for it", async () => { m.page.current = page({ title: { en: null, ar: null } }); await show("refund"); expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Refund"); });
  it("no date line when the page has no date", async () => { m.page.current = page({ updatedAt: null }); await show(); expect(screen.queryByText(/Last updated/)).not.toBeInTheDocument(); });
  it("SAFETY: a script in the text is shown as letters", async () => { m.page.current = page({ body: { en: "<script>alert(1)</script>", ar: null } }); const { container } = await show(); expect(container.querySelector("script")).toBeNull(); expect(container.textContent).toContain("<script>"); });
});
describe("a page with no text yet", () => {
  it("says it is being prepared (still a normal page, with its name and a way home)", async () => {
    m.page.current = page({ hasContent: false, body: { en: null, ar: null }, title: { en: null, ar: null }, updatedAt: null }); await show("privacy");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Privacy Policy"); expect(screen.getByText("This page is being prepared. Please check back soon.")).toBeInTheDocument(); expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
  });
  it("the same when the shop cannot be reached", async () => { m.page.current = null; await show("about"); expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("About us"); expect(screen.getByText(/being prepared/)).toBeInTheDocument(); });
});
describe("the details a search engine reads", () => {
  it("title, a description from the first words (no formatting marks), the address in both languages, and indexed", async () => {
    const meta = await legalMetadata("terms"); expect(meta.title).toBe("Terms of use");     // the layout adds " | Leap Auto Parts" itself, once expect(meta.description).toBe("Rules Be kind to everyone."); expect(meta.robots).toBeUndefined();
    expect(meta.alternates?.canonical).toBe("https://shop.example.com/terms-conditions");
  });
  it("the description is at most 155 characters", async () => { m.page.current = page({ body: { en: "word ".repeat(100), ar: null } }); expect(((await legalMetadata("terms")).description ?? "").length).toBeLessThanOrEqual(155); });
  it("a page with no text is kept out of search engines", async () => { m.page.current = page({ hasContent: false, body: { en: null, ar: null } }); const meta = await legalMetadata("terms"); expect(meta.robots).toEqual({ index: false, follow: true }); expect(meta.description).toBeUndefined(); });
  it("Arabic: the Arabic title and the Arabic address", async () => { m.lang.current = "ar"; const meta = await legalMetadata("terms"); expect(meta.title).toBe("شروط الاستخدام"); expect(String(meta.alternates?.canonical)).toContain("/ar/terms-conditions"); });
});
