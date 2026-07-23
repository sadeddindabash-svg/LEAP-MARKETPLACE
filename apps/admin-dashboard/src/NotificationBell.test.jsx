import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LeapAdminApp from './App';

const ADMIN_USER = { id: 'admin_dev_seed', email: 'admin@leap.dev', name: 'Dev Admin', role: 'admin', isOwner: true, allowedPages: 'all' };

// REAL BUG FOUND AND FIXED HERE: the Bell icon in TopBar was 100%
// decorative before this -- no badge, no click handler, nothing. This
// test would have been impossible to write meaningfully against the
// OLD component at all (there was no real badge or dropdown to assert
// on). Reuses the SAME real aggregate counts the Overview page already
// computes, plus the same real flagged-shipments count the sidebar
// badge already uses.
const MOCK_OVERVIEW = {
  totalOrders: 42, activeSuppliers: 3, pendingSuppliers: 2, openDisputes: 1, pendingModeration: 4, openTickets: 0,
  ordersByDay: [], unitsByCategory: [], topSuppliers: [],
};

function mockFetchRouter() {
  return vi.fn((url) => {
    const u = String(url);
    if (u.includes('/auth/login')) return Promise.resolve({ ok: true, json: async () => ({ token: 'fake.jwt.token', user: ADMIN_USER }) });
    if (u.includes('/auth/me')) return Promise.resolve({ ok: true, json: async () => ADMIN_USER });
    if (u.endsWith('/overview')) return Promise.resolve({ ok: true, json: async () => MOCK_OVERVIEW });
    if (u.endsWith('/hub/flagged')) return Promise.resolve({ ok: true, json: async () => [{ id: 1 }] }); // 1 real flagged shipment
    if (u.endsWith('/supplier')) return Promise.resolve({ ok: true, json: async () => [] });
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

describe('NotificationBell — real pending-action counts (mocked fetch, real component tree)', () => {
  it('CRITICAL: shows a real badge with the correct total across suppliers/disputes/moderation/flagged, and a real breakdown dropdown', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAsAdmin();

    // Real total: 2 (pendingSuppliers) + 1 (openDisputes) + 4 (pendingModeration) + 0 (openTickets) + 1 (flagged) = 8
    await waitFor(() => expect(screen.getByText('8')).toBeInTheDocument());

    fireEvent.click(screen.getByText('8'));
    await waitFor(() => expect(screen.getByText('Suppliers pending review')).toBeInTheDocument());
    expect(screen.getByText('Open returns/disputes')).toBeInTheDocument();
    expect(screen.getByText('Products pending moderation')).toBeInTheDocument();
    expect(screen.getByText('Flagged shipments')).toBeInTheDocument();
    // Open support tickets is 0 in this real data -- correctly NOT
    // shown, matching the real filter (i.count > 0), not a stale
    // leftover row for a category with nothing pending.
    expect(screen.queryByText('Open support tickets')).not.toBeInTheDocument();
  });

  it('clicking a real dropdown item navigates to that real page', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAsAdmin();

    await waitFor(() => expect(screen.getByText('8')).toBeInTheDocument());
    fireEvent.click(screen.getByText('8'));
    await waitFor(() => screen.getByText('Suppliers pending review'));
    fireEvent.click(screen.getByText('Suppliers pending review'));

    // Real navigation actually happened -- the real Suppliers page
    // content now renders.
    await waitFor(() => expect(screen.getByText(/verified.*pending review/i)).toBeInTheDocument());
  });

  it('shows no badge and an honest empty state when nothing real needs attention', async () => {
    globalThis.fetch = vi.fn((url) => {
      const u = String(url);
      if (u.includes('/auth/login')) return Promise.resolve({ ok: true, json: async () => ({ token: 'fake.jwt.token', user: ADMIN_USER }) });
      if (u.includes('/auth/me')) return Promise.resolve({ ok: true, json: async () => ADMIN_USER });
      if (u.endsWith('/overview')) return Promise.resolve({ ok: true, json: async () => ({ ...MOCK_OVERVIEW, pendingSuppliers: 0, openDisputes: 0, pendingModeration: 0, openTickets: 0 }) });
      if (u.endsWith('/hub/flagged')) return Promise.resolve({ ok: true, json: async () => [] });
      if (u.endsWith('/supplier')) return Promise.resolve({ ok: true, json: async () => [] });
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
    render(<LeapAdminApp />);
    await loginAsAdmin();

    await waitFor(() => expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument());
    // Real, honest empty state -- clicking the bell with a genuine
    // zero total shows a real message, not an empty or broken dropdown.
    const bellButtons = screen.getAllByRole('button').filter((b) => b.querySelector('svg.lucide-bell'));
    fireEvent.click(bellButtons[0]);
    await waitFor(() => expect(screen.getByText('Nothing needs your attention right now.')).toBeInTheDocument());
  });
});
