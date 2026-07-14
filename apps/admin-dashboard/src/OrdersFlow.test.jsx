import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LeapAdminApp from './App';

const ADMIN_USER = { id: 'admin_dev_seed', email: 'admin@leap.dev', name: 'Dev Admin', role: 'admin' };

const MOCK_ORDER_LIST = [
  { id: 'LP-900001', userId: 'u_1', guestEmail: null, status: 'to_ship', total: 76.7, currencyCode: 'USD', placedAt: '2026-07-04T10:00:00.000Z' },
  { id: 'LP-900002', userId: null, guestEmail: 'guest@example.com', status: 'dispute', total: 41.2, currencyCode: 'USD', placedAt: '2026-07-02T10:00:00.000Z' },
];

const MOCK_ORDER_DETAIL = {
  id: 'LP-900001',
  userId: 'u_1',
  guestEmail: null,
  isGuestOrder: false,
  status: 'to_ship',
  total: 76.7,
  currencyCode: 'USD',
  placedAt: '2026-07-04T10:00:00.000Z',
  supplierSubOrders: [
    { supplierId: 's1', supplierName: 'Guangzhou AutoParts Co.', status: 'pending', trackingNumber: null, items: [{ productId: 'p1', name: 'RIDEX Front Brake Disc', quantity: 2, unitPrice: 34.9 }] },
  ],
};

/** Routes a mocked fetch based on the URL, simulating the real API surface. */
function mockFetchRouter({ orderListStatus = 200 } = {}) {
  return vi.fn((url) => {
    const u = String(url);
    if (u.includes('/auth/login')) {
      return Promise.resolve({ ok: true, json: async () => ({ token: 'fake.jwt.token', user: ADMIN_USER }) });
    }
    if (u.includes('/auth/me')) {
      return Promise.resolve({ ok: true, json: async () => ADMIN_USER });
    }
    if (u.match(/\/order\/LP-900001$/)) {
      return Promise.resolve({ ok: true, json: async () => MOCK_ORDER_DETAIL });
    }
    if (u.endsWith('/order')) {
      if (orderListStatus === 401) {
        return Promise.resolve({ ok: false, status: 401, json: async () => ({ error: 'unauthorized' }) });
      }
      return Promise.resolve({ ok: true, json: async () => MOCK_ORDER_LIST });
    }
    // Overview is the admin dashboard's default landing page after
    // login -- this test logs in before navigating elsewhere, so it
    // needs a valid shape here or the whole app crashes rendering it
    // first (same class of bug found and fixed in ModerationFlow.test.jsx).
    if (u.endsWith('/overview')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ totalOrders: 0, activeSuppliers: 0, pendingSuppliers: 0, openDisputes: 0, pendingModeration: 0, openTickets: 0, ordersByDay: [], unitsByCategory: [], topSuppliers: [] }),
      });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
}

async function loginAndGoToOrders() {
  fireEvent.click(await screen.findByRole('button', { name: /log in/i }));
  await waitFor(() => screen.getByLabelText(/email/i));
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'admin@leap.dev' } });
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'admin_dev_password_123' } });
  fireEvent.click(screen.getByRole('button', { name: /log in/i }));
  await waitFor(() => expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: /orders/i }));
}

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('Orders page — real data flow (mocked fetch, but exercising the real component tree)', () => {
  it('renders real order rows fetched from the backend, not hardcoded mock data', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAndGoToOrders();

    await waitFor(() => expect(screen.getByText('LP-900001')).toBeInTheDocument());
    expect(screen.getByText('LP-900002')).toBeInTheDocument();
    expect(screen.getByText(/guest@example\.com/)).toBeInTheDocument();
    // The old hardcoded mock buyer name should be gone entirely.
    expect(screen.queryByText('Sara Hasan')).not.toBeInTheDocument();
  });

  it('opens order detail and shows real supplier sub-order items on click', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAndGoToOrders();

    await waitFor(() => expect(screen.getByText('LP-900001')).toBeInTheDocument());
    fireEvent.click(screen.getByText('LP-900001'));

    await waitFor(() => expect(screen.getByText('Guangzhou AutoParts Co.')).toBeInTheDocument());
    expect(screen.getByText(/RIDEX Front Brake Disc/)).toBeInTheDocument();
  });

  it('logs the admin out automatically if the orders request comes back 401 (expired session)', async () => {
    globalThis.fetch = mockFetchRouter({ orderListStatus: 401 });
    render(<LeapAdminApp />);
    await loginAndGoToOrders();

    // Session-expired handling should kick back to the login screen rather
    // than showing a broken/empty orders page.
    await waitFor(() => expect(screen.getByRole('button', { name: /^log in$/i })).toBeInTheDocument());
    expect(localStorage.getItem('leap_admin_token')).toBeNull();
  });
});
