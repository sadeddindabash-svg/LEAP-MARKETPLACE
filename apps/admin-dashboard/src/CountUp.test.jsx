import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { CountUpText, CountUpValue, COUNT_UP_MS } from './components/CountUp';

// The big numbers (the overview's cards, the payout amounts) count up from 0 to their value in 1 second.
const realMatchMedia = window.matchMedia;
const realRaf = window.requestAnimationFrame;
afterEach(() => { window.matchMedia = realMatchMedia; window.requestAnimationFrame = realRaf; vi.restoreAllMocks(); });

function animatingBrowser(reduce = false) {
  window.matchMedia = (q) => ({ matches: q.includes('reduce') ? reduce : false, media: q, addEventListener() {}, removeEventListener() {} });
  let now = 1000; vi.spyOn(performance, 'now').mockImplementation(() => now);
  const queue = [];
  window.requestAnimationFrame = (cb) => { queue.push(cb); return queue.length; };
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  return { frameAt(ms) { now = 1000 + ms; const cbs = queue.splice(0); act(() => { cbs.forEach((cb) => cb(now)); }); } };
}

describe('count up', () => {
  it('starts at 0 and lands on the value after 1 second, slowing down as it lands', () => {
    const b = animatingBrowser();
    render(<p data-testid="n"><CountUpText text="1,284" /></p>);
    expect(screen.getByTestId('n').textContent).toBe('0');
    b.frameAt(COUNT_UP_MS / 2); expect(screen.getByTestId('n').textContent).toBe('1,124');      // 1284 x (1 - 0.5^3)
    b.frameAt(COUNT_UP_MS); expect(screen.getByTestId('n').textContent).toBe('1,284');
  });
  it('money counts up in its own format', () => {
    const b = animatingBrowser();
    render(<p data-testid="m"><CountUpValue value={344} format={(n) => `¥${n.toFixed(2)}`} /></p>);
    expect(screen.getByTestId('m').textContent).toBe('¥0.00');
    b.frameAt(COUNT_UP_MS); expect(screen.getByTestId('m').textContent).toBe('¥344.00');
  });
  it('text that is not a plain number is shown as it is; 0 stays 0', () => {
    animatingBrowser();
    render(<><p data-testid="a"><CountUpText text="n/a" /></p><p data-testid="z"><CountUpText text="0" /></p></>);
    expect(screen.getByTestId('a').textContent).toBe('n/a'); expect(screen.getByTestId('z').textContent).toBe('0');
  });
  it('people who asked for less motion, and browsers that cannot tell, see the value straight away', () => {
    animatingBrowser(true); const v = render(<p data-testid="n"><CountUpText text="355" /></p>); expect(screen.getByTestId('n').textContent).toBe('355'); v.unmount();
    window.matchMedia = undefined; render(<p data-testid="k"><CountUpText text="19" /></p>); expect(screen.getByTestId('k').textContent).toBe('19');
  });
});
