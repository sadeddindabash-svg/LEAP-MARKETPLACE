import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ProductSummary } from "@/lib/api";
import { installFakeObserver } from "./testObserver";

vi.mock("@/components/Price", () => ({ Price: ({ usd }: { usd: number }) => <span>${usd}</span> }));
vi.mock("@/lib/api", async () => ({ resolveImageUrl: (u: string) => u }));
import InfiniteProductGrid from "./InfiniteProductGrid";
import { LangProvider } from "./LangProvider";
import { loadGrid } from "@/lib/gridMemory";

const product = (id: string): ProductSummary => ({ id, name: `Part ${id}`, images: [], price: 10, stockQuantity: 5, oemNumber: null, estimatedDeliveryDays: null } as unknown as ProductSummary);
const page = (from: number, n: number) => Array.from({ length: n }, (_, i) => product(`p${from + i}`));
const SOURCE = { kind: "search", params: { q: "disc", category: "brake" } } as const;

let requests: string[] = [];
let answers: Array<{ items: ProductSummary[]; total?: number | null } | { status: number } | Error> = [];
function stubFetch() {
  requests = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: { signal?: AbortSignal }) => {
    requests.push(url);
    const next = answers.shift();
    if (!next) throw new Error("no answer prepared");
    if (next instanceof Error) throw next;
    if ("status" in next) return { ok: false, status: next.status, json: async () => ({}) } as Response;
    void init;
    return { ok: true, status: 200, json: async () => next } as Response;
  }));
}
const show = (props: Partial<React.ComponentProps<typeof InfiniteProductGrid>> = {}, lang: "en" | "ar" = "en") =>
  render(<LangProvider lang={lang}><InfiniteProductGrid id="g" source={SOURCE} initial={page(1, 24)} total={100} pageSize={24} gridClassName="grid" {...props} /></LangProvider>);
const count = () => screen.getAllByRole("listitem").length;

beforeEach(() => { sessionStorage.clear(); answers = []; stubFetch(); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("a list that loads the next page by itself", () => {
  it("CRITICAL: shows its first page and asks for NOTHING until the end of the list comes near; then it asks for the NEXT page, with exactly what the list is of", async () => {
    const view = installFakeObserver();
    answers = [{ items: page(25, 24), total: 100 }];
    show();
    expect(count()).toBe(24);
    expect(requests).toEqual([]);
    await act(async () => { view.reveal(); });
    expect(requests).toEqual(["/api/products?kind=search&page=2&limit=24&q=disc&category=brake"]);
    await waitFor(() => expect(count()).toBe(48));
  });

  it("CRITICAL: a buyer who jumps straight PAST the end of the list (End key, scrollbar, skip to the footer) still gets the next page: the watcher alone would never fire", async () => {
    installFakeObserver();                                                        // the watcher reports nothing, as it does when the end is jumped over
    answers = [{ items: page(25, 24) }];
    show();
    const rect = vi.spyOn(Element.prototype, "getBoundingClientRect");
    rect.mockReturnValue({ top: 6000 } as DOMRect);                               // the end of the list is far BELOW the screen
    await act(async () => { fireEvent.scroll(window); await new Promise((r) => setTimeout(r, 60)); });
    expect(requests).toEqual([]);                                                 // far away: nothing is asked for
    rect.mockReturnValue({ top: -2500 } as DOMRect);                              // now the buyer is far BELOW the end of the list
    await act(async () => { fireEvent.scroll(window); await new Promise((r) => setTimeout(r, 60)); });
    expect(requests).toHaveLength(1);
    await waitFor(() => expect(count()).toBe(48));
    rect.mockRestore();
  });

  it("CRITICAL: ONE request at a time, however often the browser says 'visible' while a page is still arriving", async () => {
    const view = installFakeObserver();
    let release: (v: Response) => void = () => {};
    vi.stubGlobal("fetch", vi.fn((url: string) => { requests.push(url); return new Promise<Response>((resolve) => { release = resolve; }); }));
    show();
    await act(async () => { view.reveal(); view.reveal(); view.reveal(); });
    expect(requests).toHaveLength(1);
    await act(async () => { release({ ok: true, status: 200, json: async () => ({ items: page(25, 24) }) } as Response); });
    await waitFor(() => expect(count()).toBe(48));
  });

  it("CRITICAL: on a tall screen where the end is STILL in view after a page, it keeps loading until the list ends, and then stops asking for good", async () => {
    const view = installFakeObserver({ alwaysVisible: true });
    answers = [{ items: page(25, 24), total: 50 }, { items: page(49, 2), total: 50 }];
    show({ total: 50 });
    await waitFor(() => expect(count()).toBe(50));
    await act(async () => { await Promise.resolve(); });
    expect(requests).toHaveLength(2);                                             // pages 2 and 3, and no page 4
    expect(requests[1]).toContain("page=3");
    expect(view.listening()).toBe(0);                                             // nothing is watching any more
    expect(screen.getByText("That's all 50 parts.")).toBeInTheDocument();
  });

  it("a list that is already complete on its first page never starts watching, and says nothing about an end", () => {
    const view = installFakeObserver();
    show({ initial: page(1, 10), total: 10 });
    expect(view.listening()).toBe(0);
    expect(screen.queryByText(/That's all/)).not.toBeInTheDocument();
  });

  it("CRITICAL: a part already shown is never added twice, and the one to leave out is never shown but still counts as received", async () => {
    const view = installFakeObserver();
    answers = [{ items: [...page(11, 9), product("cur")] }];                       // ten arrive: nine new... and the part being looked at
    show({ initial: [...page(1, 9), product("cur")], total: null, pageSize: 10, hiddenId: "cur" });
    expect(count()).toBe(9);                                                      // ten arrived, nine are shown
    await act(async () => { view.reveal(); });
    await waitFor(() => expect(count()).toBe(18));
    expect(screen.queryByText("Part cur")).not.toBeInTheDocument();
    expect(view.listening()).toBe(1);                                             // that page was FULL (10 arrived), so there may be more: it keeps watching
    answers = [{ items: [...page(1, 3), ...page(21, 2)] }];                         // 3 repeats and 2 new
    await act(async () => { view.reveal(); });
    await waitFor(() => expect(count()).toBe(20));
  });

  it("with no total, a page that is not full ends the list", async () => {
    const view = installFakeObserver();
    answers = [{ items: page(11, 4) }];
    show({ initial: page(1, 10), total: null, pageSize: 10 });
    await act(async () => { view.reveal(); });
    await waitFor(() => expect(count()).toBe(14));
    expect(view.listening()).toBe(0);
  });

  it("CRITICAL: a failed load is a plain message with 'Try again' (no loop, nothing lost); trying again loads the same page", async () => {
    const view = installFakeObserver();
    answers = [new TypeError("Failed to fetch")];
    show();
    await act(async () => { view.reveal(); });
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't load more parts.");
    expect(count()).toBe(24);
    expect(view.listening()).toBe(0);                                             // it does not hammer a server that is down
    answers = [{ items: page(25, 24) }];
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Try again" })); });
    await waitFor(() => expect(count()).toBe(48));
    expect(requests[1]).toBe(requests[0]);                                        // the same page, not the next one
  });

  it("a 'slow down' answer (too many requests) says so in plain words", async () => {
    const view = installFakeObserver();
    answers = [{ status: 429 }];
    show();
    await act(async () => { view.reveal(); });
    expect(await screen.findByRole("alert")).toHaveTextContent("You're going quickly. Wait a moment, then try again.");
  });

  it("CRITICAL: the small lists on a product page stop after 2 more pages and offer 'See all parts' (they must not swallow the footer)", async () => {
    const view = installFakeObserver({ alwaysVisible: true });
    answers = [{ items: page(11, 10) }, { items: page(21, 10) }, { items: page(31, 10) }];
    show({ initial: page(1, 10), total: null, pageSize: 10, maxExtraPages: 2, seeAllHref: "/search" });
    await waitFor(() => expect(count()).toBe(30));
    await act(async () => { await Promise.resolve(); });
    expect(requests).toHaveLength(2);
    expect(view.listening()).toBe(0);
    expect(screen.getByRole("link", { name: "See all parts" }).getAttribute("href")).toBe("/search");
  });

  it("a list that starts at page 3 (an old ?page=3 link) asks for page 4 next", async () => {
    const view = installFakeObserver();
    answers = [{ items: page(97, 24) }];
    show({ startPage: 3 });
    await act(async () => { view.reveal(); });
    expect(requests[0]).toContain("page=4");
  });

  it("a screen reader is told how many parts are shown, and can skip the list to the footer", async () => {
    const view = installFakeObserver();
    answers = [{ items: page(25, 24) }];
    show();
    expect(screen.getByRole("link", { name: "Skip the list of parts" }).getAttribute("href")).toBe("#site-footer");
    await act(async () => { view.reveal(); });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("48 of 100 parts shown"));
  });

  it("in Arabic the words are Arabic and the page asks for Arabic names", async () => {
    const view = installFakeObserver();
    answers = [new Error("down")];
    show({}, "ar");
    expect(screen.getByRole("link", { name: "تخطَّ قائمة القطع" })).toBeInTheDocument();
    await act(async () => { view.reveal(); });
    expect(requests[0]).toContain("lang=ar");
    expect(await screen.findByRole("alert")).toHaveTextContent("تعذّر تحميل المزيد من القطع.");
    expect(screen.getByRole("button", { name: "حاول مرة أخرى" })).toBeInTheDocument();
  });

  it("leaving the page stops a request still on its way (nothing is updated after the buyer left)", async () => {
    const view = installFakeObserver();
    let signal: AbortSignal | undefined;
    vi.stubGlobal("fetch", vi.fn((_url: string, init?: { signal?: AbortSignal }) => { signal = init?.signal; return new Promise<Response>(() => {}); }));
    const { unmount } = show();
    await act(async () => { view.reveal(); });
    unmount();
    expect(signal?.aborted).toBe(true);
  });
});

describe("coming BACK from a product to the list", () => {
  const scrollTo = () => vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  const scrolledTo = (y: number) => { Object.defineProperty(window, "scrollY", { value: y, configurable: true }); fireEvent.scroll(window); };

  async function loadThenLeave() {
    const view = installFakeObserver();
    answers = [{ items: page(25, 24) }];
    const first = show();
    await act(async () => { view.reveal(); });
    await waitFor(() => expect(count()).toBe(48));
    scrolledTo(2400);
    first.unmount();                                                              // the buyer opens a product
  }

  it("CRITICAL: after a genuine Back the parts already loaded are there again, and the page returns to the same place", async () => {
    await loadThenLeave();
    expect(loadGrid(`g:${window.location.pathname}${window.location.search}`)).not.toBeNull();
    const spy = scrollTo();
    installFakeObserver();
    window.dispatchEvent(new PopStateEvent("popstate"));                          // the router's Back
    show();
    await waitFor(() => expect(count()).toBe(48));
    await waitFor(() => expect(spy).toHaveBeenCalledWith(0, 2400), { timeout: 2000 });
  });

  it("CRITICAL: the place saved is where the buyer was when they CLICKED a product, not the top of the page that the navigation scrolls to", async () => {
    const view = installFakeObserver();
    answers = [{ items: page(25, 24) }];
    const first = show();
    await act(async () => { view.reveal(); });
    await waitFor(() => expect(count()).toBe(48));
    scrolledTo(3100);
    fireEvent.click(screen.getByText("Part p30"));                              // the buyer clicks a product...
    scrolledTo(0);                                                               // ...and the navigation scrolls the page to the top before the list goes away
    first.unmount();
    expect(loadGrid(`g:${window.location.pathname}${window.location.search}`)?.scrollY).toBe(3100);
  });

  it("CRITICAL: opening the same address AFRESH (a menu link, a new visit) starts at the top: nothing is restored", async () => {
    await loadThenLeave();
    await new Promise((r) => setTimeout(r, 3100));                                // no Back happened lately
    const spy = scrollTo();
    installFakeObserver();
    show();
    await act(async () => { await Promise.resolve(); });
    expect(count()).toBe(24);
    expect(spy).not.toHaveBeenCalled();
    expect(loadGrid(`g:${window.location.pathname}${window.location.search}`)).toBeNull();      // and the old memory is thrown away
  }, 10000);

  it("a list that never went past its first page leaves nothing behind (the browser's own memory of the place is enough)", () => {
    installFakeObserver();
    const view = show();
    view.unmount();
    expect(loadGrid(`g:${window.location.pathname}${window.location.search}`)).toBeNull();
  });
});
