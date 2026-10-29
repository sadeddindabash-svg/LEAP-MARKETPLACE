import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, fireEvent, waitFor, act, renderHook } from '@testing-library/react';
import LeapAdminApp from './App';
import { REFRESH_MS, sameData, setIfChanged, useAutoRefresh } from './autoRefresh';

// The admin portal reads its screens again every 5 seconds (quietly): new orders, refused orders, counts and the sidebar badges appear by themselves; a failed refresh keeps what is on screen; nothing is loaded while the tab is hidden. Real app, mocked server.
const ADMIN_USER = { id: 'admin_dev_seed', email: 'admin@leap.dev', name: 'Dev Admin', role: 'admin', isOwner: true, allowedPages: 'all' };
const orderRow = (id, status = 'to_ship') => ({ id, userId: 'u_1', guestEmail: null, status, displayStatus: status, total: 76.7, currencyCode: 'USD', placedAt: '2026-07-04T10:00:00.000Z' });
const refused = (subOrderId, orderId) => ({ subOrderId, orderId, kind: 'refused', status: 'cancelled', orderStatus: 'cancelled', placedAt: '2026-10-27T08:00:00Z', supplierId: 's1', supplierName: 'Guangzhou AutoParts Co.', buyerId: 'u1', buyerContact: 'buyer@example.com', reason: 'out_of_stock', reasonText: 'Out of stock', note: null, refusedAt: '2026-10-27T10:00:00Z', respondBy: null, escalatedAt: null, handledAt: null, handledBy: null, handledNote: null, reassignedToSubOrderId: null, items: [{ productId: 'p1', name: 'RIDEX Brake Disc', oemNumber: 'OEM-1', quantity: 2, buyerUnitPriceUsd: 30, supplierUnitPriceCny: 52 }] });
const overview = (totalOrders, pendingSuppliers = 0) => ({ totalOrders, activeSuppliers: 3, pendingSuppliers, openDisputes: 0, pendingModeration: 0, pendingReturns: 0, openTickets: 0, ordersByDay: [], unitsByCategory: [], topProducts: [], recentOrders: [] });
let state; let calls;
function mockBackend() {
  return vi.fn((url, options) => {
    const u = String(url); const method = options?.method || 'GET'; calls.push(`${method} ${u.replace(/^https?:\/\/[^/]+/, '')}`);
    const ok = (body) => Promise.resolve({ ok: true, status: 200, json: async () => body }); const down = () => Promise.resolve({ ok: false, status: 500, json: async () => ({ error: 'down' }) });
    if (u.includes('/auth/login')) return ok({ token: 'fake.jwt.token', user: ADMIN_USER }); if (u.includes('/auth/me')) return ok(ADMIN_USER);
    if (u.includes('/supplier-responses?filter=open')) return state.failing ? down() : ok(state.refused); if (u.includes('/supplier-responses?filter=handled')) return ok([]);
    if (u.endsWith('/overview')) return state.failing ? down() : ok(state.overview); if (u.endsWith('/order')) return state.failing ? down() : ok(state.orders);
    if (u.includes('/flagged-shipments') || u.includes('/fault-cases')) return ok([]);
    return ok([]);
  });
}
const count = (fragment) => calls.filter((c) => c.includes(fragment)).length;
async function login() {
  fireEvent.click(await screen.findByRole('button', { name: /log in/i })); await waitFor(() => screen.getByLabelText(/email/i)); fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'admin@leap.dev' } }); fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'admin_dev_password_123' } });
  fireEvent.click(screen.getByRole('button', { name: /log in/i })); await waitFor(() => expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument());
}
const goOrders = async () => { fireEvent.click(screen.getByRole('button', { name: /^orders$/i })); await screen.findByTestId('refused-section'); };
const tick = async (ms) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
const setHidden = (hidden) => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden }); };
beforeEach(() => { localStorage.clear(); calls = []; state = { orders: [orderRow('LP-900001')], refused: [refused(7001, 'LP-910100')], overview: overview(777), failing: false }; globalThis.fetch = mockBackend(); vi.useFakeTimers({ shouldAdvanceTime: true }); setHidden(false); });
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
describe('the helpers', () => { it('the interval is 5 seconds; a refresh that changed nothing keeps the old state', () => { expect(REFRESH_MS).toBe(5000); expect(sameData([1, { a: 2 }], [1, { a: 2 }])).toBe(true); const prev = [1]; let s = prev; setIfChanged((fn) => { s = fn(s); })([1]); expect(s).toBe(prev); }); });
describe('the admin portal refreshes itself', () => {
  it('CRITICAL: a new order appears in the Orders list within 5 seconds, without leaving the page', async () => {
    render(<LeapAdminApp />); await login(); await goOrders(); await screen.findByText('LP-900001'); expect(screen.queryByText('LP-900002')).not.toBeInTheDocument(); state.orders = [orderRow('LP-900002'), ...state.orders]; await tick(5000); expect(await screen.findByText('LP-900002')).toBeInTheDocument(); expect(screen.getByText('LP-900001')).toBeInTheDocument();
  });
  it('CRITICAL: a refused order appears in "Refused by a supplier" within 5 seconds', async () => {
    render(<LeapAdminApp />); await login(); await goOrders(); expect(await screen.findByTestId('refused-row-7001')).toBeInTheDocument(); state.refused = [refused(7002, 'LP-910200'), ...state.refused]; await tick(5000); expect(await screen.findByTestId('refused-row-7002')).toBeInTheDocument(); expect(screen.getByTestId('refused-row-7001')).toBeInTheDocument();
  });
  it('CRITICAL: a failed refresh keeps the lists on screen (no error, no empty list), and the next good one updates them', async () => {
    render(<LeapAdminApp />); await login(); await goOrders(); await screen.findByText('LP-900001'); state.failing = true; await tick(5000); await tick(5000); expect(screen.getByText('LP-900001')).toBeInTheDocument(); expect(screen.getByTestId('refused-row-7001')).toBeInTheDocument();
    state.failing = false; state.orders = [orderRow('LP-900001'), orderRow('LP-900003')]; await tick(5000); expect(await screen.findByText('LP-900003')).toBeInTheDocument();
  });
  it('CRITICAL: nothing is loaded while the tab is hidden, and it refreshes AT ONCE when the tab is visible again', async () => {
    render(<LeapAdminApp />); await login(); await goOrders(); await screen.findByText('LP-900001'); setHidden(true); const before = count('/order'); await tick(30000); expect(count('/order')).toBe(before);
    state.orders = [orderRow('LP-900001'), orderRow('LP-900004')]; setHidden(false); await act(async () => { document.dispatchEvent(new Event('visibilitychange')); await vi.advanceTimersByTimeAsync(0); }); expect(await screen.findByText('LP-900004')).toBeInTheDocument();
  });
  it('the Overview shows a number that changed elsewhere within 5 seconds', async () => {
    render(<LeapAdminApp />); await login(); await waitFor(() => expect(screen.getAllByText('777').length).toBeGreaterThan(0)); state.overview = overview(888); await tick(5000); await waitFor(() => expect(screen.getAllByText('888').length).toBeGreaterThan(0)); expect(screen.queryByText('777')).not.toBeInTheDocument();
  });
  it('the sidebar badge (pending suppliers) follows the platform by itself, on any page', async () => {
    state.overview = overview(10, 0); render(<LeapAdminApp />); await login(); const before = count('/overview'); state.overview = overview(10, 7); await tick(5000); await waitFor(() => expect(count('/overview')).toBeGreaterThan(before)); await waitFor(() => expect(screen.getAllByText('7').length).toBeGreaterThan(0));
  });
});
