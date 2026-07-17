import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LeapAdminApp from './App';

const ADMIN_USER = { id: 'admin_dev_seed', email: 'admin@leap.dev', name: 'Dev Admin', role: 'admin', isOwner: true, allowedPages: 'all' };

function makeSupplierList() {
  return [
    { id: 's1', name: 'Guangzhou AutoParts Co.', country: 'China', contactEmail: 'wei@gz.cn', verificationStatus: 'verified', listingCount: 12, createdAt: '2025-11-02T00:00:00.000Z' },
    { id: 's3', name: 'Qingdao Transmission Works', country: 'China', contactEmail: 'hao@qd.cn', verificationStatus: 'pending', listingCount: 0, createdAt: '2026-07-08T00:00:00.000Z' },
  ];
}

function mockFetchRouter({ verifyStatus = 200 } = {}) {
  let suppliers = makeSupplierList();
  return vi.fn((url, options) => {
    const u = String(url);
    if (u.includes('/auth/login')) return Promise.resolve({ ok: true, json: async () => ({ token: 'fake.jwt.token', user: ADMIN_USER }) });
    if (u.includes('/auth/me')) return Promise.resolve({ ok: true, json: async () => ADMIN_USER });
    if (u.match(/\/supplier\/s3\/verify$/)) {
      if (verifyStatus === 401) return Promise.resolve({ ok: false, status: 401, json: async () => ({ error: 'unauthorized' }) });
      const body = JSON.parse(options.body);
      suppliers = suppliers.map((s) => (s.id === 's3' ? { ...s, verificationStatus: body.status } : s));
      return Promise.resolve({ ok: true, json: async () => ({ id: 's3', verificationStatus: body.status }) });
    }
    if (u.endsWith('/supplier')) return Promise.resolve({ ok: true, json: async () => suppliers });
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

async function loginAndGoToSuppliers() {
  fireEvent.click(await screen.findByRole('button', { name: /log in/i }));
  await waitFor(() => screen.getByLabelText(/email/i));
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'admin@leap.dev' } });
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'admin_dev_password_123' } });
  fireEvent.click(screen.getByRole('button', { name: /log in/i }));
  await waitFor(() => expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: /suppliers/i }));
}

beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('Suppliers page — real approve/reject flow (mocked fetch, real component tree)', () => {
  it('renders real supplier rows, including the pending one with action buttons', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAndGoToSuppliers();

    await waitFor(() => expect(screen.getByText('Qingdao Transmission Works')).toBeInTheDocument());
    expect(screen.getByText('Guangzhou AutoParts Co.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument();
  });

  it('approving a pending supplier calls the real verify endpoint and updates the row', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAndGoToSuppliers();

    await waitFor(() => expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /approve/i }));

    // After approval, the row re-fetches and s3 should now show "Verified"
    // instead of "Pending review", and the Approve/Reject buttons for it
    // should be gone.
    await waitFor(() => expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument());
    expect(screen.getAllByText('Verified').length).toBeGreaterThan(0);
  });

  it('logs out automatically if the verify action returns 401 (expired session)', async () => {
    globalThis.fetch = mockFetchRouter({ verifyStatus: 401 });
    render(<LeapAdminApp />);
    await loginAndGoToSuppliers();

    await waitFor(() => expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /approve/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /^log in$/i })).toBeInTheDocument());
  });
});
