import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LeapAdminApp from './App';

const OWNER_USER = { id: 'admin_dev_seed', email: 'admin@leap.dev', name: 'Dev Admin', role: 'admin', isOwner: true, allowedPages: 'all' };
const SCOPED_USER = { id: 'u_scoped', email: 'scoped@leap.dev', name: 'Scoped Admin', role: 'admin', isOwner: false, allowedPages: ['tickets', 'returns'] };

const MOCK_ADMINS = [
  { id: 'admin_dev_seed', email: 'admin@leap.dev', name: 'Dev Admin', isOwner: true, allowedPages: 'all', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'u_scoped', email: 'scoped@leap.dev', name: 'Scoped Admin', isOwner: false, allowedPages: ['tickets', 'returns'], createdAt: '2026-01-02T00:00:00.000Z' },
];

function mockFetchRouter({ loginAs = OWNER_USER, admins = MOCK_ADMINS } = {}) {
  let realAdmins = [...admins];
  return vi.fn((url, options) => {
    const u = String(url);
    const method = options?.method || 'GET';
    if (u.includes('/auth/login')) return Promise.resolve({ ok: true, json: async () => ({ token: 'fake.jwt.token', user: loginAs }) });
    if (u.includes('/auth/me')) return Promise.resolve({ ok: true, json: async () => loginAs });
    if (u.endsWith('/overview')) {
      return Promise.resolve({ ok: true, json: async () => ({ totalOrders: 0, activeSuppliers: 0, pendingSuppliers: 0, openDisputes: 0, pendingModeration: 0, openTickets: 0, ordersByDay: [], unitsByCategory: [], topSuppliers: [] }) });
    }
    if (u.endsWith('/support/tickets')) return Promise.resolve({ ok: true, json: async () => [] });
    if (u.endsWith('/returns')) return Promise.resolve({ ok: true, json: async () => [] });
    if (method === 'POST' && u.endsWith('/admin-users')) {
      const b = JSON.parse(options.body);
      const newAdmin = { id: `u_${Date.now()}`, email: b.email, name: b.name, isOwner: false, allowedPages: b.allowedPages || [], createdAt: new Date().toISOString() };
      realAdmins = [...realAdmins, newAdmin];
      return Promise.resolve({ ok: true, status: 201, json: async () => newAdmin });
    }
    if (method === 'PATCH' && u.match(/\/admin-users\/.+\/permissions$/)) {
      const id = u.split('/').slice(-2)[0];
      const b = JSON.parse(options.body);
      realAdmins = realAdmins.map((a) => (a.id === id ? { ...a, allowedPages: b.allowedPages } : a));
      return Promise.resolve({ ok: true, json: async () => realAdmins.find((a) => a.id === id) });
    }
    if (method === 'DELETE' && u.match(/\/admin-users\/.+$/)) {
      const id = u.split('/').pop();
      realAdmins = realAdmins.filter((a) => a.id !== id);
      return Promise.resolve({ ok: true, status: 204, json: async () => null });
    }
    if (u.endsWith('/admin-users')) return Promise.resolve({ ok: true, json: async () => realAdmins });
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
}

async function login(email = 'admin@leap.dev', password = 'admin_dev_password_123') {
  fireEvent.click(await screen.findByRole('button', { name: /log in/i }));
  await waitFor(() => screen.getByLabelText(/email/i));
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: email } });
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: /log in/i }));
  await waitFor(() => expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument());
}

beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('Real Team & Permissions UI and nav filtering (mocked fetch, real component tree)', () => {
  it('CRITICAL: an owner sees every real nav page, including Settings', async () => {
    globalThis.fetch = mockFetchRouter({ loginAs: OWNER_USER });
    render(<LeapAdminApp />);
    await login();

    expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pricing/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /promo codes/i })).toBeInTheDocument();
  });

  it('CRITICAL: a real scoped admin only sees their real allowed pages in the nav, and lands on one of them (not a blank Overview they can\'t access)', async () => {
    globalThis.fetch = mockFetchRouter({ loginAs: SCOPED_USER });
    render(<LeapAdminApp />);
    await login('scoped@leap.dev', 'test_password_123');

    expect(screen.getByRole('button', { name: /^support$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /returns/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /pricing/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /promo codes/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /settings/i })).not.toBeInTheDocument();
  });

  it('CRITICAL: the owner sees the real Team & Permissions management UI in Settings, listing every real admin', async () => {
    globalThis.fetch = mockFetchRouter({ loginAs: OWNER_USER });
    render(<LeapAdminApp />);
    await login();

    fireEvent.click(screen.getByRole('button', { name: /settings/i }));
    await waitFor(() => screen.getByText('Team & permissions'));
    expect(screen.getByText('scoped@leap.dev')).toBeInTheDocument();
    expect(screen.getByText(/owner — full access/i)).toBeInTheDocument();
  });

  it('CRITICAL: creating a new scoped admin with specific pages calls the real create endpoint', async () => {
    globalThis.fetch = mockFetchRouter({ loginAs: OWNER_USER });
    render(<LeapAdminApp />);
    await login();

    fireEvent.click(screen.getByRole('button', { name: /settings/i }));
    await waitFor(() => screen.getByText('Team & permissions'));
    fireEvent.click(screen.getByRole('button', { name: /add admin/i }));

    await waitFor(() => screen.getByPlaceholderText(/^email$/i));
    fireEvent.change(screen.getByPlaceholderText(/^email$/i), { target: { value: 'newfinance@leap.dev' } });
    fireEvent.change(screen.getByPlaceholderText(/password/i), { target: { value: 'test_password_123' } });

    // Check the Pricing permission checkbox specifically within the create form.
    const pricingCheckboxes = screen.getAllByRole('checkbox', { name: /pricing/i });
    fireEvent.click(pricingCheckboxes[pricingCheckboxes.length - 1]);

    fireEvent.click(screen.getByRole('button', { name: /create admin/i }));
    await waitFor(() => expect(screen.getAllByText('newfinance@leap.dev').length).toBeGreaterThan(0));
  });

  it('CRITICAL: a non-owner sees a real restricted message instead of the management UI, even with Settings access', async () => {
    const scopedWithSettings = { ...SCOPED_USER, allowedPages: ['tickets', 'settings'] };
    globalThis.fetch = mockFetchRouter({ loginAs: scopedWithSettings });
    render(<LeapAdminApp />);
    await login('scoped@leap.dev', 'test_password_123');

    fireEvent.click(screen.getByRole('button', { name: /settings/i }));
    await waitFor(() => expect(screen.getByText(/only the owner account can manage/i)).toBeInTheDocument());
  });

  it('deleting a scoped admin calls the real delete endpoint and removes them from the list', async () => {
    globalThis.fetch = mockFetchRouter({ loginAs: OWNER_USER });
    render(<LeapAdminApp />);
    await login();

    fireEvent.click(screen.getByRole('button', { name: /settings/i }));
    await waitFor(() => screen.getByText('scoped@leap.dev'));
    fireEvent.click(screen.getByTitle('Remove admin'));

    await waitFor(() => expect(screen.queryByText('scoped@leap.dev')).not.toBeInTheDocument());
  });
});
