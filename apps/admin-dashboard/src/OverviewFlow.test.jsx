import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LeapAdminApp from './App';

const ADMIN_USER = { id: 'admin_dev_seed', email: 'admin@leap.dev', name: 'Dev Admin', role: 'admin', isOwner: true, allowedPages: 'all' };

const MOCK_OVERVIEW = {
  totalOrders: 42,
  activeSuppliers: 3,
  pendingSuppliers: 1,
  openDisputes: 2,
  pendingModeration: 4,
  openTickets: 5,
  ordersByDay: [
    { day: '2026-07-12T00:00:00.000Z', count: 10 },
    { day: '2026-07-13T00:00:00.000Z', count: 32 },
  ],
  unitsByCategory: [
    { category: 'brake', units: 80 },
    { category: 'filters', units: 20 },
  ],
  topSuppliers: [
    { id: 's1', name: 'Guangzhou AutoParts Co.', orderCount: 30 },
    { id: 's2', name: 'Ningbo Filtration Ltd.', orderCount: 12 },
  ],
};

function mockFetchRouter({ overviewStatus = 200 } = {}) {
  return vi.fn((url) => {
    const u = String(url);
    if (u.includes('/auth/login')) return Promise.resolve({ ok: true, json: async () => ({ token: 'fake.jwt.token', user: ADMIN_USER }) });
    if (u.includes('/auth/me')) return Promise.resolve({ ok: true, json: async () => ADMIN_USER });
    if (u.endsWith('/overview')) {
      if (overviewStatus === 401) return Promise.resolve({ ok: false, status: 401, json: async () => ({ error: 'unauthorized' }) });
      return Promise.resolve({ ok: true, json: async () => MOCK_OVERVIEW });
    }
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

describe('Overview page — real aggregate data (mocked fetch, real component tree)', () => {
  it('renders real counts fetched from the backend, not the old hardcoded mock numbers', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAsAdmin();

    await waitFor(() => expect(screen.getByText('42')).toBeInTheDocument()); // totalOrders
    expect(screen.getByText('3')).toBeInTheDocument(); // activeSuppliers
    // The old mock's fake numbers should be completely gone.
    expect(screen.queryByText('$171,450')).not.toBeInTheDocument();
    expect(screen.queryByText('2,384')).not.toBeInTheDocument();
  });

  it('renders real top suppliers by name, not the old fake "top markets by country"', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAsAdmin();

    await waitFor(() => expect(screen.getByText('Guangzhou AutoParts Co.')).toBeInTheDocument());
    expect(screen.getByText('Ningbo Filtration Ltd.')).toBeInTheDocument();
    // The old mock's fake countries should be completely gone.
    expect(screen.queryByText('United States')).not.toBeInTheDocument();
    expect(screen.queryByText('Saudi Arabia')).not.toBeInTheDocument();
  });

  it('logs out automatically if the overview request returns 401 (expired session)', async () => {
    globalThis.fetch = mockFetchRouter({ overviewStatus: 401 });
    render(<LeapAdminApp />);
    await loginAsAdmin();

    await waitFor(() => expect(screen.getByRole('button', { name: /^log in$/i })).toBeInTheDocument());
  });
});
