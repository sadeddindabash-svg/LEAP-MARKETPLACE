import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LeapSupplierPortalApp from './App';

const SUPPLIER_USER = { id: 'supplier_dev_seed', email: 'supplier@leap.dev', name: 'Wei Zhang', role: 'supplier', supplierId: 's1' };
const SUPPLIER_PROFILE = { id: 's1', name: 'Guangzhou AutoParts Co.', country: 'China', contactEmail: 'wei@gz.cn', verificationStatus: 'verified', listingCount: 2, createdAt: '2025-11-02T00:00:00.000Z' };

const MOCK_NOTIFICATIONS = [
  { id: 1, type: 'supplier_message', title: 'New message from Leap', body: 'Thanks for the update.', linkType: 'supplier_message', linkId: 's1', isRead: false, createdAt: '2026-07-16T00:00:00.000Z' },
];

function mockFetchRouter({ notifications = MOCK_NOTIFICATIONS, unreadCount } = {}) {
  let realNotifications = [...notifications];
  return vi.fn((url, options) => {
    const u = String(url);
    const method = options?.method || 'GET';
    if (u.includes('/auth/login')) return Promise.resolve({ ok: true, json: async () => ({ token: 'fake.jwt.token', user: SUPPLIER_USER }) });
    if (u.includes('/auth/me')) return Promise.resolve({ ok: true, json: async () => SUPPLIER_USER });
    if (u.endsWith('/supplier/me')) return Promise.resolve({ ok: true, json: async () => SUPPLIER_PROFILE });
    if (u.endsWith('/supplier/me/overview')) {
      return Promise.resolve({ ok: true, json: async () => ({ totalOrders: 0, pendingOrders: 0, totalListings: 0, pendingReturns: 0, ordersByDay: [], topProducts: [], recentOrders: [] }) });
    }
    if (u.endsWith('/notifications/me/unread-count')) {
      // Computed fresh on every real call from the current (possibly
      // mutated by a prior PATCH) state -- a real, dynamic count, not a
      // stale value captured once at router setup time.
      const count = unreadCount ?? realNotifications.filter((n) => !n.isRead).length;
      return Promise.resolve({ ok: true, json: async () => ({ count }) });
    }
    if (method === 'PATCH' && u.endsWith('/notifications/me/read-all')) {
      realNotifications = realNotifications.map((n) => ({ ...n, isRead: true }));
      return Promise.resolve({ ok: true, status: 204 });
    }
    if (method === 'PATCH' && u.match(/\/notifications\/me\/\d+\/read$/)) {
      const id = Number(u.match(/\/notifications\/me\/(\d+)\/read$/)[1]);
      realNotifications = realNotifications.map((n) => (n.id === id ? { ...n, isRead: true } : n));
      return Promise.resolve({ ok: true, json: async () => realNotifications.find((n) => n.id === id) });
    }
    if (u.endsWith('/notifications/me')) return Promise.resolve({ ok: true, json: async () => realNotifications });
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
}

async function loginAsSupplier() {
  await waitFor(() => screen.getByLabelText(/邮箱|email/i));
  fireEvent.change(screen.getByLabelText(/邮箱|email/i), { target: { value: 'supplier@leap.dev' } });
  fireEvent.change(screen.getByLabelText(/密码|password/i), { target: { value: 'supplier_dev_password_123' } });
  fireEvent.click(screen.getByRole('button', { name: /登录|log in/i }));
  await waitFor(() => expect(screen.getAllByText('Guangzhou AutoParts Co.')[0]).toBeInTheDocument());
}

function clickBell() {
  fireEvent.click(screen.getByRole('button', { name: /notifications|通知/i }));
}

beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('Supplier portal notifications — real bell badge + page (mocked fetch, real component tree)', () => {
  it('CRITICAL: the real unread count shows a real badge on the Bell icon after login', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapSupplierPortalApp />);
    await loginAsSupplier();

    await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument());
  });

  it('shows no badge when there is genuinely nothing unread', async () => {
    globalThis.fetch = mockFetchRouter({ notifications: [], unreadCount: 0 });
    render(<LeapSupplierPortalApp />);
    await loginAsSupplier();

    await waitFor(() => expect(screen.getAllByText('Guangzhou AutoParts Co.')[0]).toBeInTheDocument());
    // Real absence check, scoped specifically to the bell -- the
    // Overview page's own real KPI cards also show "0" values (e.g.
    // pending orders), so a page-wide text search for "0" would be a
    // genuinely ambiguous, unreliable check.
    const bellButton = screen.getByRole('button', { name: /notifications|通知/i });
    expect(bellButton.textContent).not.toMatch(/\d/);
  });

  it('CRITICAL: clicking the Bell opens the real notifications list', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapSupplierPortalApp />);
    await loginAsSupplier();

    await waitFor(() => screen.getByText('1'));
    clickBell();

    await waitFor(() => expect(screen.getByText('New message from Leap')).toBeInTheDocument());
    expect(screen.getByText('Thanks for the update.')).toBeInTheDocument();
  });

  it('CRITICAL: tapping a real unread notification marks it read and the badge disappears', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapSupplierPortalApp />);
    await loginAsSupplier();

    await waitFor(() => screen.getByText('1'));
    clickBell();
    await waitFor(() => screen.getByText('New message from Leap'));

    fireEvent.click(screen.getByText('New message from Leap'));
    await waitFor(() => expect(screen.queryByText('1')).not.toBeInTheDocument());
  });

  it('shows a real empty state when there are no notifications at all', async () => {
    globalThis.fetch = mockFetchRouter({ notifications: [], unreadCount: 0 });
    render(<LeapSupplierPortalApp />);
    await loginAsSupplier();

    clickBell();
    await waitFor(() => expect(screen.getByText(/no notifications yet|暂无通知/i)).toBeInTheDocument());
  });

  it('CRITICAL: mark all read clears the real badge entirely', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapSupplierPortalApp />);
    await loginAsSupplier();

    await waitFor(() => screen.getByText('1'));
    clickBell();
    await waitFor(() => screen.getByText(/mark all read|全部标记为已读/i));
    fireEvent.click(screen.getByText(/mark all read|全部标记为已读/i));

    await waitFor(() => expect(screen.queryByText('1')).not.toBeInTheDocument());
  });
});
