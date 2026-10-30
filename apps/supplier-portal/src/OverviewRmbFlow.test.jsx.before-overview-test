import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import LeapSupplierPortalApp from './App';

// The supplier Overview: Payout summary FIRST, one pie chart of how the orders ended up, everything in RMB (¥), and the rest of the page kept in the same order (mocked fetch, real component tree).
const SUPPLIER_USER = { id: 'supplier_dev_seed', email: 'supplier@leap.dev', name: 'Wei Zhang', role: 'supplier', supplierId: 's1' };
const SUPPLIER_PROFILE = { id: 's1', name: 'Guangzhou AutoParts Co.', country: 'China', contactEmail: 'wei@gz.cn', verificationStatus: 'verified', listingCount: 2, createdAt: '2025-11-02T00:00:00.000Z' };
const OUTCOMES = { total: 50, succeeded: 31, inProgress: 9, cancelled: 6, returned: 4 };
const overview = (analytics = {}) => ({
  totalOrders: 50, pendingOrders: 9, totalListings: 5, pendingReturns: 1,
  ordersByDay: [{ day: '2026-07-13T00:00:00.000Z', count: 4 }], topProducts: [{ id: 'p1', name: 'RIDEX Front Brake Disc', units: 20 }],
  recentOrders: [{ subOrderId: 1, orderId: 'LP-200900', status: 'pending', placedAt: '2026-07-13T00:00:00.000Z' }],
  analytics: {
    payoutSummary: { totalPaid: 12480, amountOwed: 3260, currencyCode: 'CNY' }, revenueAndVolume: [{ day: '2026-07-13T00:00:00.000Z', orderCount: 2, revenue: 5200 }],
    topProducts: [{ productId: 'p1', name: 'RIDEX Front Brake Disc', unitsSold: 20, revenue: 2600 }], statusBreakdown: [{ status: 'pending', count: 2 }], lowStockProducts: [{ productId: 'p2', name: 'Low part', stockQuantity: 1, lowStockThreshold: 5 }],
    outcomes: OUTCOMES, ...analytics,
  },
});
function mockFetchRouter(data) {
  return vi.fn((url) => {
    const u = String(url); const ok = (body) => Promise.resolve({ ok: true, json: async () => body });
    if (u.includes('/auth/login')) return ok({ token: 'fake.jwt.token', user: SUPPLIER_USER }); if (u.includes('/auth/me')) return ok(SUPPLIER_USER);
    if (u.endsWith('/supplier/me')) return ok(SUPPLIER_PROFILE); if (u.endsWith('/supplier/me/overview')) return ok(data);
    return ok({});
  });
}
async function open(data = overview()) {
  globalThis.fetch = mockFetchRouter(data); render(<LeapSupplierPortalApp />);
  await waitFor(() => screen.getByLabelText(/邮箱|email/i)); fireEvent.change(screen.getByLabelText(/邮箱|email/i), { target: { value: 'supplier@leap.dev' } }); fireEvent.change(screen.getByLabelText(/密码|password/i), { target: { value: 'supplier_dev_password_123' } });
  fireEvent.click(screen.getByRole('button', { name: /登录|log in/i })); await waitFor(() => expect(screen.getAllByText('Guangzhou AutoParts Co.')[0]).toBeInTheDocument()); await screen.findByTestId('payout-summary');
}
const before = (a, b) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('Supplier Overview: the order of the page', () => {
  it('CRITICAL: Payout summary is at the TOP of the page, then the Total orders tile, then the pie chart, then the sections that were there before, in their old order', async () => {
    await open(); fireEvent.click(screen.getByRole('button', { name: 'EN' })); const payout = await screen.findByTestId('payout-summary'); const pie = screen.getByTestId('outcomes-pie'); const tile = screen.getAllByText('Total orders')[0];      // the tile (the pie has the same words in its middle)
    expect(within(pie).queryByText('Total orders')).toBeInTheDocument(); expect(pie.contains(tile)).toBe(false);
    expect(before(payout, tile)).toBe(true); expect(before(tile, pie)).toBe(true);
    const titles = ['Revenue trend (last 30 days)', 'Top-selling products', 'Order status breakdown', 'Low-stock products', 'Orders per day (last 7 days)', 'Top products (by units sold)', 'Recent orders'];
    const els = titles.map((t) => screen.getByText(t)); els.forEach((el, i) => { expect(before(pie, el), titles[i]).toBe(true); if (i > 0) expect(before(els[i - 1], el), `${titles[i - 1]} before ${titles[i]}`).toBe(true); });
    expect(payout.parentElement.firstElementChild).toBe(payout);      // the very first thing in the page body
  });
  it('the Total orders tile (50), Orders per day, Top products and Recent orders are all still there', async () => {
    await open(); fireEvent.click(screen.getByRole('button', { name: 'EN' })); await screen.findAllByText('Total orders'); expect(screen.getByText('LP-200900')).toBeInTheDocument(); expect(screen.getByText('Orders per day (last 7 days)')).toBeInTheDocument(); expect(screen.getByText('Top products (by units sold)')).toBeInTheDocument();
    const tile = screen.getAllByText('Total orders')[0].closest('div').parentElement; expect(screen.getByTestId('outcomes-pie').contains(tile)).toBe(false); expect(tile).toHaveTextContent('50');
  });
});
describe('Supplier Overview: everything in RMB', () => {
  it('CRITICAL: the Payout summary shows ¥ amounts, and there is no dollar amount anywhere on the page', async () => {
    await open(); const p = screen.getByTestId('payout-summary'); expect(p).toHaveTextContent('¥12,480.00'); expect(p).toHaveTextContent('¥3,260.00');
    expect(screen.getByText(/¥2,600\.00/)).toBeInTheDocument();                           // top-selling product revenue
    expect(document.body.textContent).not.toMatch(/\$\s?\d/); expect(document.body.textContent).not.toMatch(/USD/);
  });
});
describe('Supplier Overview: the orders pie chart', () => {
  it('CRITICAL: one chart with the four totals and the total in the middle: 31 succeeded, 9 in progress, 6 refused / cancelled, 4 returns of 50', async () => {
    await open(); expect(screen.getByTestId('outcomes-total')).toHaveTextContent('50');
    for (const [k, n, pct] of [['succeeded', 31, '62%'], ['inProgress', 9, '18%'], ['cancelled', 6, '12%'], ['returned', 4, '8%']]) { const row = screen.getByTestId(`outcome-${k}`); expect(row).toHaveTextContent(String(n)); expect(row).toHaveTextContent(pct); }
    expect(31 + 9 + 6 + 4).toBe(OUTCOMES.total);
  });
  it('each slice is drawn in proportion to its count (the arc is that share of the circle), in the order: succeeded, in progress, refused, returns', async () => {
    await open(); const CIRC = 2 * Math.PI * 56; const arcs = ['succeeded', 'inProgress', 'cancelled', 'returned'].map((k) => screen.getByTestId(`outcome-slice-${k}`));
    const share = (el) => Number(el.getAttribute('stroke-dasharray').split(' ')[0]) / CIRC; [31 / 50, 9 / 50, 6 / 50, 4 / 50].forEach((want, i) => expect(share(arcs[i])).toBeCloseTo(want, 3));
    let start = 0; arcs.forEach((el, i) => { expect(-Number(el.getAttribute('stroke-dashoffset'))).toBeCloseTo(start, 2); start += share(el) * CIRC; }); expect(start).toBeCloseTo(CIRC, 1);
    const colors = arcs.map((el) => el.getAttribute('stroke')); expect(new Set(colors).size).toBe(4);
  });
  it('a group with no orders has no slice but still has its row (0, 0%)', async () => {
    await open(overview({ outcomes: { total: 10, succeeded: 10, inProgress: 0, cancelled: 0, returned: 0 } })); expect(screen.queryByTestId('outcome-slice-cancelled')).not.toBeInTheDocument(); expect(screen.getByTestId('outcome-cancelled')).toHaveTextContent('0'); expect(screen.getByTestId('outcome-succeeded')).toHaveTextContent('100%');
  });
  it('no orders yet: an empty ring and an honest empty message, no slices, no division by zero', async () => {
    await open(overview({ outcomes: { total: 0, succeeded: 0, inProgress: 0, cancelled: 0, returned: 0 } })); expect(screen.getByTestId('outcomes-total')).toHaveTextContent('0'); expect(screen.queryByTestId('outcome-slice-succeeded')).not.toBeInTheDocument(); expect(document.body.textContent).not.toMatch(/NaN|Infinity/);
  });
  it('a server that does not send the counts yet shows no pie (and does not crash)', async () => { const d = overview(); delete d.analytics.outcomes; await open(d); expect(screen.queryByTestId('outcomes-pie')).not.toBeInTheDocument(); expect(screen.getByTestId('payout-summary')).toBeInTheDocument(); });
});
