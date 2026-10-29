import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, fireEvent, waitFor, act, renderHook } from '@testing-library/react';
import LeapSupplierPortalApp from './App';
import { REFRESH_MS, sameData, setIfChanged, useAutoRefresh } from './autoRefresh';

// The supplier portal reads its screens again every 5 seconds (quietly): what changed elsewhere appears by itself; a failed refresh keeps what is on screen; nothing is loaded while the tab is hidden. Real app, mocked server.
const SUPPLIER_USER = { id: 'supplier_dev_seed', email: 'supplier@leap.dev', name: 'Wei Zhang', role: 'supplier', supplierId: 's1' };
const PROFILE = { id: 's1', name: 'Guangzhou AutoParts Co.', country: 'China', contactEmail: 'wei@gz.cn', verificationStatus: 'verified', listingCount: 2, createdAt: '2026-07-01T00:00:00Z' };
const item = (name) => ({ productId: 'p1', name, quantity: 1, unitPriceCny: 52, vehicle: null });
const order = (subOrderId, orderId, status, itemName = 'Brake Pad Set') => ({ subOrderId, orderId, status, trackingNumber: null, hubId: 'hub_gz', hubName: 'Guangzhou Hub', hubAddress: 'Panyu', hubShipmentId: null, placedAt: '2026-07-01T00:00:00Z', items: [item(itemName)], locked: false, lockReason: null, allowedStatuses: ['preparing', 'shipped'], canEditTracking: true, canAccept: false, canRefuse: false });
const overview = (totalOrders) => ({ totalOrders, pendingOrders: 0, totalListings: 0, pendingReturns: 0, ordersByDay: [], topProducts: [], recentOrders: [] });
let state; let calls;
function mockBackend() {
  return vi.fn((url, options) => {
    const u = String(url).replace(/^https?:\/\/[^/]+/, ''); const method = options?.method || 'GET'; calls.push(`${method} ${u}`);
    const ok = (body) => Promise.resolve({ ok: true, status: 200, json: async () => body }); const down = () => Promise.resolve({ ok: false, status: 500, json: async () => ({ error: 'down' }) });
    if (u.includes('/auth/login')) return ok({ token: 'fake.jwt.token', user: SUPPLIER_USER }); if (u.includes('/auth/me')) return ok(SUPPLIER_USER);
    if (u.endsWith('/returns/supplier/me') || u.endsWith('/fault-cases/supplier/me')) return ok([]);
    if (u.endsWith('/supplier/me/overview')) return state.failing ? down() : ok(state.overview);
    if (u.endsWith('/supplier/me/orders') && method === 'GET') return state.failing ? down() : ok(state.orders);
    if (u.endsWith('/supplier/me/products') && method === 'GET') return state.failing ? down() : ok(state.products);
    if (u.endsWith('/supplier/me')) return ok(PROFILE);
    if (u.endsWith('/catalog/product-requirements')) return ok({ minPhotos: 0, photosRequired: false, videoRequired: false, maxVideoDurationSeconds: 8 });
    if (u.includes('/fitment/') || u.includes('/catalog/')) return ok([]);
    return ok({});
  });
}
const count = (fragment) => calls.filter((c) => c.includes(fragment)).length;
async function login() {
  await waitFor(() => screen.getByLabelText(/邮箱|email/i)); fireEvent.change(screen.getByLabelText(/邮箱|email/i), { target: { value: 'supplier@leap.dev' } }); fireEvent.change(screen.getByLabelText(/密码|password/i), { target: { value: 'supplier_dev_password_123' } });
  fireEvent.click(screen.getByRole('button', { name: /登录|log in/i })); await waitFor(() => expect(screen.getAllByText('Guangzhou AutoParts Co.')[0]).toBeInTheDocument());
}
const open = async (name) => { fireEvent.click(screen.getByText(name)); };
const tick = async (ms) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
const setHidden = (hidden) => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden }); };
beforeEach(() => { localStorage.clear(); calls = []; state = { orders: [order(7001, 'LP-910100', 'pending')], overview: overview(4321), products: [], failing: false }; globalThis.fetch = mockBackend(); vi.useFakeTimers({ shouldAdvanceTime: true }); setHidden(false); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); setHidden(false); });

describe('the message threads that already refreshed', () => {
  it('CRITICAL: they now refresh every 5 seconds (not 20), read from the code', () => {
    const source = readFileSync(join(__dirname, 'App.jsx'), 'utf8'); expect(source).toContain('const interval = setInterval(() => load(false), 5000);'); expect(source).not.toContain('setInterval(() => load(false), 20000)');
  });
});
describe('the quiet refresh hook', () => {
  it('CRITICAL: never two at a time: a slow answer is waited for, not piled up; and the next one runs after it', async () => {
    let finish = () => {}; const refresh = vi.fn(() => new Promise((resolve) => { finish = resolve; })); renderHook(() => useAutoRefresh(refresh));
    await tick(5000); expect(refresh).toHaveBeenCalledTimes(1); await tick(15000); expect(refresh).toHaveBeenCalledTimes(1); await act(async () => { finish(); await vi.advanceTimersByTimeAsync(0); }); await tick(5000); expect(refresh).toHaveBeenCalledTimes(2);
  });
  it('it is off while `enabled` is false, uses the LATEST function, and stops when unmounted', async () => {
    const first = vi.fn(async () => {}); const second = vi.fn(async () => {}); const { rerender, unmount } = renderHook(({ fn, on }) => useAutoRefresh(fn, { enabled: on }), { initialProps: { fn: first, on: false } });
    await tick(20000); expect(first).toHaveBeenCalledTimes(0); rerender({ fn: second, on: true }); await tick(5000); expect(first).toHaveBeenCalledTimes(0); expect(second).toHaveBeenCalledTimes(1); unmount(); await tick(20000); expect(second).toHaveBeenCalledTimes(1);
  });
});
describe('the helpers', () => {
  it('the interval is 5 seconds; sameData and setIfChanged keep the old state when nothing changed', () => {
    expect(REFRESH_MS).toBe(5000); expect(sameData({ a: [1, 2] }, { a: [1, 2] })).toBe(true); expect(sameData({ a: 1 }, { a: 2 })).toBe(false); const prev = { a: 1 }; let state2 = prev; setIfChanged((fn) => { state2 = fn(state2); })({ a: 1 }); expect(state2).toBe(prev); setIfChanged((fn) => { state2 = fn(state2); })({ a: 2 }); expect(state2).toEqual({ a: 2 });
  });
});
describe('the supplier portal refreshes itself', () => {
  it('CRITICAL: the overview shows a number that changed elsewhere within 5 seconds', async () => {
    render(<LeapSupplierPortalApp />); await login(); await waitFor(() => expect(screen.getAllByText('4321').length).toBeGreaterThan(0)); state.overview = overview(4999); await tick(5000); await waitFor(() => expect(screen.getAllByText('4999').length).toBeGreaterThan(0)); expect(screen.queryByText('4321')).not.toBeInTheDocument();
  });
  it('CRITICAL: a new order appears in the orders list within 5 seconds, without leaving the page', async () => {
    render(<LeapSupplierPortalApp />); await login(); fireEvent.click(screen.getByText(/^(订单管理|Orders)$/)); await screen.findByText('LP-910100'); expect(screen.queryByText('LP-910200')).not.toBeInTheDocument();
    state.orders = [order(7002, 'LP-910200', 'pending'), ...state.orders]; await tick(5000); expect(await screen.findByText('LP-910200')).toBeInTheDocument(); expect(screen.getByText('LP-910100')).toBeInTheDocument();
  });
  it('CRITICAL: a failed refresh keeps the list on screen (no error, no empty list)', async () => {
    render(<LeapSupplierPortalApp />); await login(); fireEvent.click(screen.getByText(/^(订单管理|Orders)$/)); await screen.findByText('LP-910100'); state.failing = true; await tick(5000); await tick(5000); expect(screen.getByText('LP-910100')).toBeInTheDocument();
    state.failing = false; state.orders = [order(7001, 'LP-910100', 'pending'), order(7003, 'LP-910300', 'pending')]; await tick(5000); expect(await screen.findByText('LP-910300')).toBeInTheDocument();
  });
  it('CRITICAL: nothing is loaded while the tab is hidden, and it refreshes AT ONCE when the tab is visible again', async () => {
    render(<LeapSupplierPortalApp />); await login(); fireEvent.click(screen.getByText(/^(订单管理|Orders)$/)); await screen.findByText('LP-910100'); setHidden(true); const before = count('/supplier/me/orders'); await tick(30000); expect(count('/supplier/me/orders')).toBe(before);
    state.orders = [order(7001, 'LP-910100', 'pending'), order(7004, 'LP-910400', 'pending')]; setHidden(false); await act(async () => { document.dispatchEvent(new Event('visibilitychange')); await vi.advanceTimersByTimeAsync(0); }); expect(await screen.findByText('LP-910400')).toBeInTheDocument();
  });
  it('CRITICAL: an order that is OPEN follows the supplier\'s orders: a change made elsewhere appears in the open order by itself', async () => {
    render(<LeapSupplierPortalApp />); await login(); fireEvent.click(screen.getByText(/^(订单管理|Orders)$/)); await screen.findByText('LP-910100'); await open('LP-910100'); expect(await screen.findByText('Brake Pad Set')).toBeInTheDocument();
    state.orders = [order(7001, 'LP-910100', 'pending', 'Brake Pad Set RENAMED')]; await tick(5000); expect(await screen.findByText('Brake Pad Set RENAMED')).toBeInTheDocument();
  });
  it('the products page shows a stock that changed elsewhere, but is NOT refreshed while a product is being added or edited', async () => {
    state.products = [{ id: 'p1', name: 'Front Disc', nameZh: '前刹车盘', category: 'brake', oemNumber: 'OEM-1', price: 120, currencyCode: 'CNY', stockQuantity: 777, lowStockThreshold: 5, status: 'active', images: [], videoUrl: null, fitment: [], attributes: [] }];
    render(<LeapSupplierPortalApp />); await login(); fireEvent.click(screen.getByText(/^(商品管理|Products)$/)); await waitFor(() => expect(screen.getAllByText('777').length).toBeGreaterThan(0)); state.products = [{ ...state.products[0], stockQuantity: 888 }]; await tick(5000); await waitFor(() => expect(screen.getAllByText('888').length).toBeGreaterThan(0));
    fireEvent.click(screen.getByText(/添加商品|Add product/i)); const before = count('/supplier/me/products'); await tick(15000); expect(count('/supplier/me/products')).toBe(before);
  });
});
