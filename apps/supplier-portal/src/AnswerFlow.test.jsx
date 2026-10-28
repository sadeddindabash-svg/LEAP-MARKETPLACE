import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import LeapSupplierPortalApp from './App';

// A NEW order: the supplier sees THEIR price in RMB and can ACCEPT or REFUSE it (24 hours to answer). Mocked backend, real component tree.
const SUPPLIER_USER = { id: 'supplier_dev_seed', email: 'supplier@leap.dev', name: 'Wei Zhang', role: 'supplier', supplierId: 's1' };
const PROFILE = { id: 's1', name: 'Guangzhou AutoParts Co.', country: 'China', contactEmail: 'wei@gz.cn', verificationStatus: 'verified', listingCount: 2, createdAt: '2026-07-01T00:00:00Z' };
const hoursFromNow = (h) => new Date(Date.now() + h * 3600e3).toISOString();
const order = (over = {}) => ({
  subOrderId: 7001, orderId: 'LP-910100', status: 'pending', trackingNumber: null, hubId: 'hub_guangzhou', hubName: 'Guangzhou Inspection Hub', hubAddress: 'Panyu District', hubShipmentId: null, placedAt: '2026-07-01T00:00:00Z',
  items: [{ productId: 'p1', name: 'RIDEX Front Brake Disc', quantity: 2, unitPriceCny: 52 }, { productId: 'p2', name: 'Pad set', quantity: 1, unitPriceCny: 100 }],
  locked: false, lockReason: null, allowedStatuses: ['preparing', 'shipped'], canEditTracking: true, canAccept: true, canRefuse: true, respondBy: hoursFromNow(20), acceptedAt: null, refusedAt: null, refusalReason: null, ...over,
});
function mockBackend(initial, calls = [], overrides = {}) {
  return vi.fn((url, options) => {
    const u = String(url); const method = options?.method || 'GET'; const ok = (body, status = 200) => Promise.resolve({ ok: status < 400, status, json: async () => body });
    if (u.includes('/auth/login')) return ok({ token: 'fake.jwt.token', user: SUPPLIER_USER }); if (u.includes('/auth/me')) return ok(SUPPLIER_USER);
    if (u.endsWith('/returns/supplier/me') || u.endsWith('/fault-cases/supplier/me')) return ok([]);
    if (u.endsWith('/supplier/me/overview')) return ok({ totalOrders: 0, pendingOrders: 0, totalListings: 0, pendingReturns: 0, ordersByDay: [], topProducts: [], recentOrders: [] });
    if (u.endsWith('/supplier/me/orders') && method === 'GET') return ok([initial]); if (u.endsWith('/supplier/me')) return ok(PROFILE);
    const m = u.match(/\/supplier\/me\/orders\/7001\/(accept|refuse)$/);
    if (m && method === 'POST') { const body = JSON.parse(options.body || '{}'); calls.push({ action: m[1], body }); if (overrides[m[1]]) return overrides[m[1]](body);
      if (m[1] === 'accept') return ok({ subOrderId: 7001, orderId: initial.orderId, status: 'preparing', acceptedAt: new Date().toISOString(), locked: false, lockReason: null, allowedStatuses: ['shipped'], canEditTracking: true, canAccept: false, canRefuse: false });
      return ok({ subOrderId: 7001, orderId: initial.orderId, status: 'cancelled', refusalReason: body.reason, orderCancelled: true, locked: true, lockReason: 'cancelled', allowedStatuses: [], canEditTracking: false, canAccept: false, canRefuse: false }); }
    return ok({});
  });
}
async function openOrder(initial, calls, overrides) {
  globalThis.fetch = mockBackend(initial, calls, overrides); render(<LeapSupplierPortalApp />);
  await waitFor(() => screen.getByLabelText(/邮箱|email/i)); fireEvent.change(screen.getByLabelText(/邮箱|email/i), { target: { value: 'supplier@leap.dev' } }); fireEvent.change(screen.getByLabelText(/密码|password/i), { target: { value: 'supplier_dev_password_123' } });
  fireEvent.click(screen.getByRole('button', { name: /登录|log in/i })); await waitFor(() => expect(screen.getAllByText('Guangzhou AutoParts Co.')[0]).toBeInTheDocument());
  fireEvent.click(screen.getByText(/^(订单管理|Orders)$/)); fireEvent.click(await screen.findByText('LP-910100'));
}
const T = (id) => screen.getByTestId(id);
beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('Order details: the supplier\'s own price, in RMB', () => {
  it('CRITICAL: each item shows the price the supplier set, in ¥, and no dollar price (Leap\'s selling price) anywhere', async () => {
    await openOrder(order()); await screen.findByTestId('answer-block'); expect(screen.getByText(/¥52\.00/)).toBeInTheDocument(); expect(screen.getByText(/¥100\.00/)).toBeInTheDocument(); expect(document.body.textContent).not.toMatch(/\$\s?\d/);
  });
  it('an item with no RMB price yet shows a dash, never a made-up number', async () => { await openOrder(order({ items: [{ productId: 'p1', name: 'RIDEX Front Brake Disc', quantity: 1, unitPriceCny: null }] })); await screen.findByTestId('answer-block'); expect(screen.getByText(/—/)).toBeInTheDocument(); });
  it('the order LIST shows the order total in ¥ (price x quantity, added up: 2 x 52 + 100)', async () => {
    globalThis.fetch = mockBackend(order()); render(<LeapSupplierPortalApp />); await waitFor(() => screen.getByLabelText(/邮箱|email/i)); fireEvent.change(screen.getByLabelText(/邮箱|email/i), { target: { value: 'supplier@leap.dev' } }); fireEvent.change(screen.getByLabelText(/密码|password/i), { target: { value: 'supplier_dev_password_123' } });
    fireEvent.click(screen.getByRole('button', { name: /登录|log in/i })); await waitFor(() => expect(screen.getAllByText('Guangzhou AutoParts Co.')[0]).toBeInTheDocument()); fireEvent.click(screen.getByText(/^(订单管理|Orders)$/));
    const row = (await screen.findByText('LP-910100')).closest('tr'); expect(row).toHaveTextContent('¥204.00'); expect(row.textContent).not.toMatch(/\$/);
  });
});
describe('Order details: accept or refuse a new order', () => {
  it('CRITICAL: a NEW order shows Accept and Refuse with the time left, and not the preparing / shipped steps (answer first)', async () => {
    await openOrder(order()); const block = await screen.findByTestId('answer-block'); expect(within(block).getByTestId('answer-accept')).toBeEnabled(); expect(within(block).getByTestId('answer-refuse')).toBeEnabled(); expect(T('answer-deadline')).toHaveTextContent(/20/);
    expect(screen.queryByRole('button', { name: /^(备货中|Preparing)$/ })).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: /^(已发货|Shipped)$/ })).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: /(Mark shipped|标记.*发货)/ })).not.toBeInTheDocument();
  });
  it('CRITICAL: Accept sends the answer, then the order goes on as before: the answer block is gone and the steps appear', async () => {
    const calls = []; await openOrder(order(), calls); fireEvent.click(await screen.findByTestId('answer-accept'));
    await waitFor(() => expect(calls).toEqual([{ action: 'accept', body: {} }])); await waitFor(() => expect(screen.queryByTestId('answer-block')).not.toBeInTheDocument()); expect(screen.getByRole('button', { name: /^(已发货|Shipped)$/ })).toBeEnabled();
  });
  it('CRITICAL: Refuse asks for a reason first (five), and the button stays off until one is chosen; nothing is sent by opening the question or by Back', async () => {
    const calls = []; await openOrder(order(), calls); fireEvent.click(await screen.findByTestId('answer-refuse')); const dlg = await screen.findByTestId('refuse-dialog');
    for (const k of ['out_of_stock', 'price_changed', 'discontinued', 'cannot_ship_in_time', 'other']) expect(within(dlg).getByTestId(`answer-reason-${k}`)).toBeInTheDocument(); expect(T('answer-confirm-refuse')).toBeDisabled();
    fireEvent.click(T('answer-reason-out_of_stock')); expect(T('answer-confirm-refuse')).toBeEnabled(); fireEvent.click(T('answer-back')); expect(screen.queryByTestId('refuse-dialog')).not.toBeInTheDocument(); expect(screen.getByTestId('answer-accept')).toBeInTheDocument(); expect(calls).toEqual([]);
    fireEvent.click(T('answer-refuse')); expect(T('answer-confirm-refuse')).toBeDisabled();      // the choice was cleared
  });
  it('CRITICAL: refusing sends the reason; the order becomes cancelled, the block goes, and the panel says the order was refused and why', async () => {
    const calls = []; await openOrder(order(), calls); fireEvent.click(await screen.findByTestId('answer-refuse')); fireEvent.click(T('answer-reason-out_of_stock')); fireEvent.click(T('answer-confirm-refuse'));
    await waitFor(() => expect(calls).toEqual([{ action: 'refuse', body: { reason: 'out_of_stock', note: '' } }])); await waitFor(() => expect(screen.queryByTestId('answer-block')).not.toBeInTheDocument()); expect(screen.getByRole('status')).toHaveTextContent(/refused|拒绝/); expect(screen.getByRole('status')).toHaveTextContent(/Out of stock|缺货/);
  });
  it('"Other" needs a short note: the button stays off until it has one, and the note is sent', async () => {
    const calls = []; await openOrder(order(), calls); fireEvent.click(await screen.findByTestId('answer-refuse')); fireEvent.click(T('answer-reason-other')); expect(T('answer-confirm-refuse')).toBeDisabled(); fireEvent.change(T('answer-note'), { target: { value: 'ab' } }); expect(T('answer-confirm-refuse')).toBeDisabled();
    fireEvent.change(T('answer-note'), { target: { value: 'Factory closed for the holiday' } }); expect(T('answer-confirm-refuse')).toBeEnabled(); fireEvent.click(T('answer-confirm-refuse')); await waitFor(() => expect(calls).toEqual([{ action: 'refuse', body: { reason: 'other', note: 'Factory closed for the holiday' } }]));
  });
  it('a refusal the server rejects (for example: it was already accepted) shows the server\'s message and keeps the order as it was', async () => {
    const overrides = { refuse: () => Promise.resolve({ ok: false, status: 409, json: async () => ({ error: 'You already accepted this order, so it can no longer be refused here.' }) }) }; await openOrder(order(), [], overrides);
    fireEvent.click(await screen.findByTestId('answer-refuse')); fireEvent.click(T('answer-reason-price_changed')); fireEvent.click(T('answer-confirm-refuse')); expect(await screen.findByRole('alert')).toHaveTextContent('already accepted'); expect(screen.getByTestId('answer-block')).toBeInTheDocument();
  });
  it('an answer that is late says so (Leap has been told) instead of counting hours', async () => { await openOrder(order({ respondBy: hoursFromNow(-2) })); expect(await screen.findByTestId('answer-deadline')).toHaveTextContent(/Leap/); expect(T('answer-deadline').textContent).not.toMatch(/-\d/); });
  it('an order that is NOT waiting for an answer (already accepted, or an older server) has no Accept / Refuse and keeps the steps it had', async () => {
    await openOrder(order({ canAccept: false, canRefuse: false, status: 'preparing', allowedStatuses: ['shipped'] })); await screen.findByText('LP-910100'); await screen.findByRole('button', { name: /^(已发货|Shipped)$/ }); expect(screen.queryByTestId('answer-block')).not.toBeInTheDocument();
  });
  it('a refused order opened later says it was refused, with the reason, and nothing can be changed', async () => {
    await openOrder(order({ canAccept: false, canRefuse: false, status: 'cancelled', locked: true, lockReason: 'cancelled', allowedStatuses: [], canEditTracking: false, refusalReason: 'discontinued', refusedAt: new Date().toISOString() })); const s = await screen.findByRole('status'); expect(s).toHaveTextContent(/refused|拒绝/); expect(s).toHaveTextContent(/discontinued|停产/);
  });
});
