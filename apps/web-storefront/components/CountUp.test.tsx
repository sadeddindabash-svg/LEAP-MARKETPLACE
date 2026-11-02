import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";

// Numbers that count up from 0 to their value in 1 second (the home page totals, the account numbers, the orders page numbers).
vi.mock("./CurrencyProvider", () => ({ useCurrency: () => ({ format: (usd: number) => `$${Math.round(usd)}` }) }));
import { CountUp, CountUpText, CountUpPrice, COUNT_UP_MS } from "./CountUp";

const realMatchMedia = window.matchMedia;
const realRaf = window.requestAnimationFrame;
afterEach(() => { window.matchMedia = realMatchMedia; window.requestAnimationFrame = realRaf; vi.restoreAllMocks(); });

// A browser that animates: no "less motion" wish, and frames we step by hand.
function animatingBrowser(reduce = false) {
  window.matchMedia = ((q: string) => ({ matches: q.includes("reduce") ? reduce : false, media: q, addEventListener() {}, removeEventListener() {} })) as never;
  let now = 1000; vi.spyOn(performance, "now").mockImplementation(() => now);
  const queue: FrameRequestCallback[] = [];
  window.requestAnimationFrame = ((cb: FrameRequestCallback) => { queue.push(cb); return queue.length; }) as never;
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  return { frameAt(ms: number) { now = 1000 + ms; const cbs = queue.splice(0); act(() => { cbs.forEach((cb) => cb(now)); }); } };
}

describe("count up", () => {
  it("starts at 0 and lands on the value after 1 second, slowing down as it lands", () => {
    const b = animatingBrowser();
    render(<p data-testid="n"><CountUp value={552} /></p>);
    expect(screen.getByTestId("n").textContent).toBe("0");
    b.frameAt(COUNT_UP_MS / 2); expect(screen.getByTestId("n").textContent).toBe("483");      // 552 x (1 - 0.5^3), past the middle at half time
    b.frameAt(COUNT_UP_MS); expect(screen.getByTestId("n").textContent).toBe("552");
  });
  it("numbers written as text count up too and keep their thousands separators; other text is shown as it is", () => {
    const b = animatingBrowser();
    render(<><p data-testid="a"><CountUpText text="1,284" /></p><p data-testid="b"><CountUpText text="n/a" /></p></>);
    expect(screen.getByTestId("a").textContent).toBe("0"); expect(screen.getByTestId("b").textContent).toBe("n/a");
    b.frameAt(COUNT_UP_MS); expect(screen.getByTestId("a").textContent).toBe("1,284");
  });
  it("a price counts up in the visitor's currency", () => {
    const b = animatingBrowser();
    render(<CountUpPrice usd={344} />);
    expect(screen.getByText("$0")).toBeInTheDocument();
    b.frameAt(COUNT_UP_MS); expect(screen.getByText("$344")).toBeInTheDocument();
  });
  it("when the value changes it counts from the old value to the new one", () => {
    const b = animatingBrowser();
    const v = render(<p data-testid="n"><CountUp value={2} /></p>); b.frameAt(COUNT_UP_MS);
    v.rerender(<p data-testid="n"><CountUp value={40} /></p>); expect(screen.getByTestId("n").textContent).toBe("2");
    b.frameAt(COUNT_UP_MS * 2); expect(screen.getByTestId("n").textContent).toBe("40");
  });
  it("0 stays 0, with no movement", () => {
    animatingBrowser(); render(<p data-testid="n"><CountUp value={0} /></p>); expect(screen.getByTestId("n").textContent).toBe("0");
  });
  it("people who asked for less motion see the value straight away", () => {
    animatingBrowser(true); render(<p data-testid="n"><CountUp value={146} /></p>); expect(screen.getByTestId("n").textContent).toBe("146");
  });
  it("a browser that cannot tell shows the value straight away", () => {
    (window as unknown as { matchMedia: unknown }).matchMedia = undefined;
    render(<><p data-testid="n"><CountUp value={25} /></p><p data-testid="t"><CountUpText text="1,284" /></p></>);
    expect(screen.getByTestId("n").textContent).toBe("25"); expect(screen.getByTestId("t").textContent).toBe("1,284");
  });
});
