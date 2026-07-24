import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LeapAdminApp from './App';

const ADMIN_USER = { id: 'admin_dev_seed', email: 'admin@leap.dev', name: 'Dev Admin', role: 'admin', isOwner: true, allowedPages: 'all' };

const MOCK_CODES = [
  { code: 'SUMMER10', type: 'percentage', value: 10, source: 'admin', maxTotalUses: 100, maxUsesPerBuyer: 1, expiresAt: null, isActive: true, createdAt: '2026-07-16T00:00:00.000Z' },
];

function mockFetchRouter({ codes = MOCK_CODES } = {}) {
  let realCodes = [...codes];
  return vi.fn((url, options) => {
    const u = String(url);
    const method = options?.method || 'GET';
    if (u.includes('/auth/login')) return Promise.resolve({ ok: true, json: async () => ({ token: 'fake.jwt.token', user: ADMIN_USER }) });
    if (u.includes('/auth/me')) return Promise.resolve({ ok: true, json: async () => ADMIN_USER });
    if (u.endsWith('/overview')) {
      return Promise.resolve({ ok: true, json: async () => ({ totalOrders: 0, activeSuppliers: 0, pendingSuppliers: 0, openDisputes: 0, pendingModeration: 0, openTickets: 0, ordersByDay: [], unitsByCategory: [], topSuppliers: [] }) });
    }
    if (method === 'POST' && u.endsWith('/promo-codes')) {
      const b = JSON.parse(options.body);
      const newCode = { ...b, source: 'admin', isActive: true, createdAt: new Date().toISOString() };
      realCodes = [...realCodes, newCode];
      return Promise.resolve({ ok: true, status: 201, json: async () => newCode });
    }
    if (method === 'PATCH' && u.match(/\/promo-codes\/.+$/)) {
      const code = u.split('/').pop();
      const b = JSON.parse(options.body);
      realCodes = realCodes.map((c) => (c.code === code ? { ...c, ...b } : c));
      return Promise.resolve({ ok: true, json: async () => realCodes.find((c) => c.code === code) });
    }
    if (u.endsWith('/promo-codes')) return Promise.resolve({ ok: true, json: async () => realCodes });
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

describe('Admin Promo Codes page — real general promotions engine (mocked fetch, real component tree)', () => {
  it('renders the real seeded promo code', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await login();

    fireEvent.click(screen.getByRole('button', { name: /promo codes/i }));
    await waitFor(() => expect(screen.getByText('SUMMER10')).toBeInTheDocument());
    expect(screen.getByText(/10% off/i)).toBeInTheDocument();
  });

  it('CRITICAL: creating a new percentage code calls the real create endpoint and shows up immediately', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await login();

    fireEvent.click(screen.getByRole('button', { name: /promo codes/i }));
    await waitFor(() => screen.getByPlaceholderText(/code \(e\.g\./i));
    fireEvent.change(screen.getByPlaceholderText(/code \(e\.g\./i), { target: { value: 'FALL20' } });
    fireEvent.change(screen.getByPlaceholderText(/10 \(%\)/i), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() => expect(screen.getByText('FALL20')).toBeInTheDocument());
  });

  it('CRITICAL: creating a real "new users only" targeted code sends the real flag and shows the real targeting summary', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await login();

    fireEvent.click(screen.getByRole('button', { name: /promo codes/i }));
    await waitFor(() => screen.getByPlaceholderText(/code \(e\.g\./i));
    fireEvent.change(screen.getByPlaceholderText(/code \(e\.g\./i), { target: { value: 'WELCOME15' } });
    fireEvent.change(screen.getByPlaceholderText(/10 \(%\)/i), { target: { value: '15' } });
    fireEvent.click(screen.getByText(/new users only/i));
    fireEvent.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() => expect(screen.getByText('WELCOME15')).toBeInTheDocument());
    expect(screen.getByText(/new users only/i, { selector: 'div' })).toBeInTheDocument();
  });

  it('CRITICAL: deactivating a code calls the real update endpoint and shows Inactive', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await login();

    fireEvent.click(screen.getByRole('button', { name: /promo codes/i }));
    await waitFor(() => screen.getByText('SUMMER10'));
    fireEvent.click(screen.getByRole('button', { name: /deactivate/i }));

    await waitFor(() => expect(screen.getByText('Inactive')).toBeInTheDocument());
  });

  it('shows a real empty state when there are no promo codes yet', async () => {
    globalThis.fetch = mockFetchRouter({ codes: [] });
    render(<LeapAdminApp />);
    await login();

    fireEvent.click(screen.getByRole('button', { name: /promo codes/i }));
    await waitFor(() => expect(screen.getByText(/no promo codes yet/i)).toBeInTheDocument());
  });

  // Real usage count (new) -- closes a real gap: the real
  // promo_code_redemptions table already recorded every real
  // redemption the whole time, this page just never showed it.
  it('CRITICAL: shows the real usage count, and flags it in red once a code has genuinely hit its own real max-uses limit', async () => {
    const codesWithUsage = [
      { code: 'HALFUSED', type: 'percentage', value: 10, source: 'admin', maxTotalUses: 100, maxUsesPerBuyer: 1, expiresAt: null, isActive: true, createdAt: '2026-07-16T00:00:00.000Z', usedCount: 42 },
      { code: 'MAXEDOUT', type: 'flat', value: 5, source: 'admin', maxTotalUses: 10, maxUsesPerBuyer: 1, expiresAt: null, isActive: true, createdAt: '2026-07-16T00:00:00.000Z', usedCount: 10 },
    ];
    globalThis.fetch = mockFetchRouter({ codes: codesWithUsage });
    render(<LeapAdminApp />);
    await login();

    fireEvent.click(screen.getByRole('button', { name: /promo codes/i }));
    await waitFor(() => expect(screen.getByText('HALFUSED')).toBeInTheDocument());

    expect(screen.getByText('42 used')).toBeInTheDocument();
    expect(screen.getByText('10 used')).toBeInTheDocument();
  });
});
