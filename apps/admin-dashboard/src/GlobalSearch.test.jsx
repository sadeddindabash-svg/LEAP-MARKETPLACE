import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LeapAdminApp from './App';

const ADMIN_USER = { id: 'admin_dev_seed', email: 'admin@leap.dev', name: 'Dev Admin', role: 'admin', isOwner: true, allowedPages: 'all' };

const MOCK_SEARCH_RESULTS = {
  orders: [{ id: 'LP-200999', label: 'LP-200999', sublabel: 'USD 37.88 · to ship' }],
  suppliers: [],
  tickets: [],
};

const MOCK_ORDER_DETAIL = {
  id: 'LP-200999', userId: 'u1', guestEmail: null, status: 'to_ship', displayStatus: 'to_ship',
  total: 37.88, currencyCode: 'USD', placedAt: '2026-07-14T00:00:00.000Z', supplierSubOrders: [],
};

function mockFetchRouter() {
  return vi.fn((url) => {
    const u = String(url);
    if (u.includes('/auth/login')) return Promise.resolve({ ok: true, json: async () => ({ token: 'fake.jwt.token', user: ADMIN_USER }) });
    if (u.includes('/auth/me')) return Promise.resolve({ ok: true, json: async () => ADMIN_USER });
    if (u.includes('/admin/search')) return Promise.resolve({ ok: true, json: async () => MOCK_SEARCH_RESULTS });
    if (u.includes('/hub/flagged')) return Promise.resolve({ ok: true, json: async () => [] });
    // SupplierAnalyticsPicker (an unrelated component that also renders
    // on the Overview page this test starts from) fetches this in the
    // background -- without a real array here it throws suppliers.map
    // is not a function, the exact same pre-existing flakiness found
    // earlier this session, unrelated to search itself.
    if (u.endsWith('/supplier')) return Promise.resolve({ ok: true, json: async () => [] });
    if (u.endsWith('/order/LP-200999')) return Promise.resolve({ ok: true, json: async () => MOCK_ORDER_DETAIL });
    if (u.endsWith('/overview')) return Promise.resolve({ ok: true, json: async () => ({ totalOrders: 1, activeSuppliers: 1, pendingSuppliers: 0, openDisputes: 0, pendingModeration: 0, openTickets: 0, ordersByDay: [], unitsByCategory: [], topSuppliers: [] }) });
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
}

async function loginAsAdmin() {
  fireEvent.click(await screen.findByRole('button', { name: /log in/i }));
  await waitFor(() => screen.getByLabelText(/email/i));
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'admin@leap.dev' } });
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'admin_dev_password_123' } });
  fireEvent.click(screen.getByRole('button', { name: /log in/i }));
  await waitFor(() => expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument());
}

beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

// REAL BUG FOUND AND FIXED HERE: the TopBar's search box was 100%
// decorative before this -- a <span> with placeholder text, not even
// a real <input>. This test would have been impossible to write
// against the OLD component at all (there was no real input to type
// into, and no real navigation to assert on).
describe('Global search — real search across orders/suppliers/tickets (mocked fetch, real component tree)', () => {
  it('CRITICAL: typing a real order ID shows a real result, and clicking it opens the real order detail page', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAsAdmin();

    const searchInput = screen.getByPlaceholderText(/search orders, suppliers, tickets/i);
    fireEvent.change(searchInput, { target: { value: 'LP-2009' } });

    await waitFor(() => expect(screen.getByText('LP-200999')).toBeInTheDocument());
    fireEvent.click(screen.getByText('LP-200999'));

    // Real navigation actually happened -- the order detail page's own
    // real "Supplier sub-orders" card now renders, not just the
    // search dropdown item (which also shows the same order ID text).
    await waitFor(() => expect(screen.getByText('Supplier sub-orders')).toBeInTheDocument());
  });

  it('does not search on a 1-character query, avoiding a real request for something too short to mean anything', async () => {
    const fetchSpy = mockFetchRouter();
    globalThis.fetch = fetchSpy;
    render(<LeapAdminApp />);
    await loginAsAdmin();

    const searchInput = screen.getByPlaceholderText(/search orders, suppliers, tickets/i);
    fireEvent.change(searchInput, { target: { value: 'L' } });

    await new Promise((r) => setTimeout(r, 400)); // real debounce window
    const searchCalls = fetchSpy.mock.calls.filter(([url]) => String(url).includes('/admin/search'));
    expect(searchCalls.length).toBe(0);
  });
});
