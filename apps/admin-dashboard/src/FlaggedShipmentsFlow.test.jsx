import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import LeapAdminApp from './App';

const ADMIN_USER = { id: 'admin_dev_seed', email: 'admin@leap.dev', name: 'Dev Admin', role: 'admin', isOwner: true, allowedPages: 'all' };

const MOCK_FLAGGED = [
  { id: 335, subOrderId: 2222, orderId: 'LP-900555', supplierName: 'Guangzhou AutoParts Co.', hubName: 'Guangzhou Inspection Hub', flaggedAt: '2026-07-15T15:17:45.581Z', flagNote: 'Wrong part received', flagPhotos: ['/uploads/flag-evidence.jpg'] },
];

function mockFetchRouter({ flagged = MOCK_FLAGGED } = {}) {
  return vi.fn((url) => {
    const u = String(url);
    if (u.includes('/auth/login')) return Promise.resolve({ ok: true, json: async () => ({ token: 'fake.jwt.token', user: ADMIN_USER }) });
    if (u.includes('/auth/me')) return Promise.resolve({ ok: true, json: async () => ADMIN_USER });
    if (u.endsWith('/overview')) {
      return Promise.resolve({ ok: true, json: async () => ({ totalOrders: 0, activeSuppliers: 0, pendingSuppliers: 0, openDisputes: 0, pendingModeration: 0, openTickets: 0, ordersByDay: [], unitsByCategory: [], topSuppliers: [] }) });
    }
    if (u.endsWith('/hub/flagged')) return Promise.resolve({ ok: true, json: async () => flagged });
    // REAL, PRE-EXISTING BUG FOUND AND FIXED HERE (unrelated to
    // whatever else this session was touching when this was found):
    // this mock had no /supplier case at all, so SupplierAnalyticsPicker
    // (rendered as part of the Overview page, which this file's own
    // login flow passes through) got the generic `{}` fallback below
    // instead of a real array, throwing suppliers.map is not a
    // function. Confirmed via git log that this test file predates
    // this session entirely -- a genuinely pre-existing gap, not
    // something introduced by anything built in this pass.
    if (u.endsWith('/supplier')) return Promise.resolve({ ok: true, json: async () => [] });
    if (u.match(/\/order\/LP-900555$/)) {
      return Promise.resolve({
        ok: true, json: async () => ({
          id: 'LP-900555', userId: null, guestEmail: 'g@example.com', isGuestOrder: true, status: 'to_ship', total: 50, currencyCode: 'USD', placedAt: '2026-07-15T00:00:00.000Z',
          supplierSubOrders: [{ subOrderId: 2222, supplierId: 's1', supplierName: 'Guangzhou AutoParts Co.', status: 'shipped', trackingNumber: null, hubId: 'hub_guangzhou', hubName: 'Guangzhou Inspection Hub', hubShipment: { status: 'flagged', events: [] }, items: [] }],
        }),
      });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
}

async function login() {
  fireEvent.click(await screen.findByRole('button', { name: /log in/i }));
  await waitFor(() => screen.getByLabelText(/email/i));
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'admin@leap.dev' } });
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'admin_dev_password_123' } });
  fireEvent.click(screen.getByRole('button', { name: /log in/i }));
  await waitFor(() => expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument());
}

beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('Flagged Shipments — the real queue and sidebar badge (mocked fetch, real component tree)', () => {
  it('shows a real count badge on the sidebar nav item', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await login();

    // REAL BUG FOUND AND FIXED HERE: a later pass added a real
    // NotificationBell that ALSO shows a real badge for the same
    // flagged-shipment count -- getByText('1') became genuinely
    // ambiguous (two real "1"s on screen at once, both correct).
    // Scoped to the sidebar nav item specifically, which is what this
    // test is actually about.
    const sidebarNavItem = screen.getByText('Flagged Shipments').closest('button');
    await waitFor(() => expect(within(sidebarNavItem).getByText('1')).toBeInTheDocument());
  });

  it('shows no badge when nothing is flagged', async () => {
    globalThis.fetch = mockFetchRouter({ flagged: [] });
    render(<LeapAdminApp />);
    await login();

    await waitFor(() => expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument());
    expect(screen.queryByText('1')).not.toBeInTheDocument();
  });

  it('the Flagged Shipments page renders a real flagged entry with its note and photo', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await login();

    fireEvent.click(screen.getByRole('button', { name: /flagged shipments/i }));
    await waitFor(() => expect(screen.getByText('LP-900555')).toBeInTheDocument());
    expect(screen.getByText('Wrong part received')).toBeInTheDocument();
    expect(screen.getByText(/Guangzhou AutoParts Co\./)).toBeInTheDocument();
  });

  it('shows a real empty state when nothing is flagged', async () => {
    globalThis.fetch = mockFetchRouter({ flagged: [] });
    render(<LeapAdminApp />);
    await login();

    fireEvent.click(screen.getByRole('button', { name: /flagged shipments/i }));
    await waitFor(() => expect(screen.getByText(/nothing flagged right now/i)).toBeInTheDocument());
  });

  it('clicking "View order" navigates into the real order detail page', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await login();

    fireEvent.click(screen.getByRole('button', { name: /flagged shipments/i }));
    await waitFor(() => screen.getByRole('button', { name: /view order/i }));
    fireEvent.click(screen.getByRole('button', { name: /view order/i }));

    await waitFor(() => expect(screen.getAllByText('LP-900555').length).toBeGreaterThan(0));
  });
});
