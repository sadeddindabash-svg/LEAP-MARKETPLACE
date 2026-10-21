import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { t } from "@/lib/i18n";

// A row of parts that is only asked for when it is scrolled close to: nothing before, one request when near, nothing at all when there is nothing to show, a retry when it fails.
const m = vi.hoisted(() => ({ lang: { current: "en" as "en" | "ar" }, grid: vi.fn() }));
vi.mock("./LangProvider", () => ({ useLang: () => m.lang.current, useT: () => (key: string, vars?: Record<string, string | number>) => t(m.lang.current, key as never, vars) }));
vi.mock("./InfiniteProductGrid", () => ({ default: (props: Record<string, unknown>) => { m.grid(props); return <div data-testid="grid" />; } }));
import LazyProductRow from "./LazyProductRow";

type Watcher = { callback: (entries: { isIntersecting: boolean }[]) => void; disconnect: ReturnType<typeof vi.fn>; options?: IntersectionObserverInit };
let watchers: Watcher[] = []; const fetchMock = vi.fn();
const scrollNear = () => act(() => { for (const w of watchers) w.callback([{ isIntersecting: true }]); });
const answer = (items: unknown[], ok = true) => fetchMock.mockResolvedValue({ ok, status: ok ? 200 : 500, json: async () => ({ items, total: null }) });
const show = (props: Partial<React.ComponentProps<typeof LazyProductRow>> = {}) => render(<LazyProductRow id="model-h" title="More parts for BYD Seal" source={{ kind: "sameModel", productId: "p_1" }} pageSize={8} maxExtraPages={2} {...props} />);
beforeEach(() => {
  watchers = []; m.lang.current = "en"; m.grid.mockClear(); fetchMock.mockReset(); answer([{ id: "a" }, { id: "b" }]);
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("IntersectionObserver", class { constructor(callback: Watcher["callback"], options?: IntersectionObserverInit) { watchers.push({ callback, disconnect: vi.fn(), options }); (this as unknown as { w: Watcher }).w = watchers[watchers.length - 1]; } observe() {} disconnect() { ((this as unknown as { w: Watcher }).w.disconnect as unknown as () => void)(); } });
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("LazyProductRow", () => {
  it("asks for nothing, and shows nothing, until the buyer scrolls close to it", () => {
    show(); expect(fetchMock).not.toHaveBeenCalled(); expect(screen.queryByRole("heading")).not.toBeInTheDocument(); expect(watchers).toHaveLength(1);
    expect(watchers[0].options?.rootMargin).toBe("500px 0px");          // it starts a little BEFORE it comes into view, so the parts are there when it does
  });
  it("when it is near it asks the website's door for the first batch of that list, once", async () => {
    show({ source: { kind: "sameModel", productId: "p_1" } }); scrollNear(); await screen.findByTestId("grid");
    expect(fetchMock).toHaveBeenCalledTimes(1); expect(fetchMock.mock.calls[0][0]).toBe("/api/products?kind=sameModel&page=1&limit=8&productId=p_1");
    scrollNear(); expect(fetchMock).toHaveBeenCalledTimes(1); expect(watchers[0].disconnect).toHaveBeenCalled();
  });
  it("then draws its title and hands the first batch and its rules to the scrolling grid", async () => {
    show({ hiddenId: "p_1" }); scrollNear(); await screen.findByTestId("grid");
    expect(screen.getByRole("heading", { name: "More parts for BYD Seal" })).toHaveAttribute("id", "model-h");
    expect(m.grid.mock.calls[0][0]).toMatchObject({ id: "model-h-grid", source: { kind: "sameModel", productId: "p_1" }, initial: [{ id: "a" }, { id: "b" }], total: null, pageSize: 8, maxExtraPages: 2, hiddenId: "p_1" });
  });
  it("a row with no cap (the newest) is given none", async () => {
    show({ maxExtraPages: undefined }); scrollNear(); await screen.findByTestId("grid"); expect(m.grid.mock.calls[0][0].maxExtraPages).toBeUndefined();
  });
  it("says it is loading while the first batch is on its way", async () => {
    let release: (v: unknown) => void = () => {}; fetchMock.mockReturnValue(new Promise((r) => { release = r; }));
    show(); scrollNear(); expect(await screen.findByText("Loading more parts…")).toBeInTheDocument(); expect(screen.queryByTestId("grid")).not.toBeInTheDocument();
    release({ ok: true, status: 200, json: async () => ({ items: [{ id: "a" }] }) }); await screen.findByTestId("grid");
  });
  it("a row with nothing to show leaves no heading and no message: no parts, or only the part itself", async () => {
    answer([]); const first = show(); scrollNear(); await waitFor(() => expect(fetchMock).toHaveBeenCalled()); await waitFor(() => expect(first.container.querySelector("[aria-busy]")).toBeNull());
    expect(first.container).toBeEmptyDOMElement(); first.unmount();
    answer([{ id: "p_1" }]); watchers = []; const second = show({ hiddenId: "p_1" }); scrollNear(); await waitFor(() => expect(second.container.querySelector("[aria-busy]")).toBeNull()); expect(second.container).toBeEmptyDOMElement();
  });
  it("a failure shows the usual message and Try again, and Try again asks again and succeeds", async () => {
    answer([], false); show(); scrollNear(); expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't load more parts."); expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    answer([{ id: "a" }]); fireEvent.click(screen.getByRole("button", { name: "Try again" })); await screen.findByTestId("grid"); expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("a request that cannot even be sent (no connection) is a failure too, never a crash", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch")); show(); scrollNear(); expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
  it("in Arabic it asks for the Arabic list", async () => {
    m.lang.current = "ar"; show({ source: { kind: "newest" } }); scrollNear(); await screen.findByTestId("grid"); expect(fetchMock.mock.calls[0][0]).toBe("/api/products?kind=newest&page=1&limit=8&lang=ar");
  });
  it("where the browser cannot watch for scrolling, the row simply loads at once", async () => {
    vi.stubGlobal("IntersectionObserver", undefined); show(); await screen.findByTestId("grid"); expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("stops watching when the page is left", () => {
    const view = show(); view.unmount(); expect(watchers[0].disconnect).toHaveBeenCalled();
  });
});
