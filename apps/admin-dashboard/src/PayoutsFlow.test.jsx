import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LeapAdminApp from './App';

const OWNER_USER = { id: 'admin_dev_seed', email: 'admin@leap.dev', name: 'Dev Admin', role: 'admin', isOwner: true, allowedPages: 'all' };

const MOCK_OWED = [
  { supplierId: 's1', supplierName: 'Guangzhou AutoParts Co.', amountOwed: 140.76, eligibleSubOrderCount: 3 },
];
const MOCK_HISTORY_INITIAL = [
  { id: 1, supplierId: 's2', supplierName: 'Ningbo Filtration Ltd.', amount: 88.50, currencyCode: 'USD', notes: 'Prior payout', subOrderCount: 2, createdAt: '2026-06-01T00:00:00.000Z' },
];

function mockFetchRouter() {
  let owed = [...MOCK_OWED];
  let history = [...MOCK_HISTORY_INITIAL];
  return vi.fn((url, options) => {
    const u = String(url);
    const method = options?.method || 'GET';
    if (u.includes('/auth/login')) return Promise.resolve({ ok: true, json: async () => ({ token: 'fake.jwt.token', user: OWNER_USER }) });
    if (u.includes('/auth/me')) return Promise.resolve({ ok: true, json: async () => OWNER_USER });
    if (u.endsWith('/payouts/owed')) return Promise.resolve({ ok: true, json: async () => owed });
    if (method === 'POST' && u.endsWith('/payouts')) {
      const body = JSON.parse(options.body);
      const paidEntry = owed.find((o) => o.supplierId === body.supplierId);
      if (!paidEntry) return Promise.resolve({ ok: false, status: 400, json: async () => ({ error: 'This supplier has no real amount currently owed.' }) });
      const newPayout = { id: history.length + 1, supplierId: body.supplierId, supplierName: paidEntry.supplierName, amount: paidEntry.amountOwed, currencyCode: 'USD', notes: body.notes || null, subOrderCount: paidEntry.eligibleSubOrderCount, createdAt: new Date().toISOString() };
      history = [newPayout, ...history];
      owed = owed.filter((o) => o.supplierId !== body.supplierId);
      return Promise.resolve({ ok: true, status: 201, json: async () => newPayout });
    }
    if (u.endsWith('/payouts')) return Promise.resolve({ ok: true, json: async () => history });
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
}

async function loginAndGoToPayouts() {
  fireEvent.click(await screen.findByRole('button', { name: /log in/i }));
  await waitFor(() => screen.getByLabelText(/email/i));
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'admin@leap.dev' } });
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'admin_dev_password_123' } });
  fireEvent.click(screen.getByRole('button', { name: /log in/i }));
  await waitFor(() => expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: /payouts/i }));
}

beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('Real Payouts page (mocked fetch, full component tree)', () => {
  it('CRITICAL: shows the real amount owed per supplier, not fabricated numbers or a fake schedule', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAndGoToPayouts();

    await waitFor(() => screen.getByText('Guangzhou AutoParts Co.'));
    expect(screen.getAllByText('$140.76').length).toBeGreaterThan(0);
    expect(screen.queryByText(/next scheduled payout run/i)).not.toBeInTheDocument();
  });

  it('CRITICAL: recording a payout calls the real endpoint, clears the supplier from amount owed, and adds it to real history', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAndGoToPayouts();

    await waitFor(() => screen.getByText('Guangzhou AutoParts Co.'));
    fireEvent.click(screen.getByRole('button', { name: /record payout/i }));

    await waitFor(() => expect(screen.queryByRole('button', { name: /record payout/i })).not.toBeInTheDocument());
    // The supplier now legitimately appears in History instead of Owed.
    expect(screen.getAllByText('$140.76').length).toBeGreaterThan(0);
  });

  it('shows real existing payout history, including a prior payout never triggered in this session', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAndGoToPayouts();

    await waitFor(() => screen.getByText('Ningbo Filtration Ltd.'));
    expect(screen.getByText('$88.50')).toBeInTheDocument();
    expect(screen.getByText('Prior payout')).toBeInTheDocument();
  });

  it('shows a real empty state when nothing is owed to any supplier', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAndGoToPayouts();

    await waitFor(() => screen.getByText('Guangzhou AutoParts Co.'));
    fireEvent.click(screen.getByRole('button', { name: /record payout/i }));

    await waitFor(() => expect(screen.getByText(/nothing is currently owed/i)).toBeInTheDocument());
  });
});
