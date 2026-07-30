import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LeapAdminApp from './App';

const OWNER_USER = { id: 'admin_dev_seed', email: 'admin@leap.dev', name: 'Dev Admin', role: 'admin', isOwner: true, allowedPages: 'all' };

function mockFetchRouter({ testEmailResult = { ok: true, status: 200, body: { sent: true, recipientEmail: 'admin@leap.dev' } } } = {}) {
  return vi.fn((url, options) => {
    const u = String(url);
    const method = options?.method || 'GET';
    if (u.includes('/auth/login')) return Promise.resolve({ ok: true, json: async () => ({ token: 'fake.jwt.token', user: OWNER_USER }) });
    if (u.includes('/auth/me')) return Promise.resolve({ ok: true, json: async () => OWNER_USER });
    if (u.endsWith('/overview')) {
      return Promise.resolve({ ok: true, json: async () => ({ totalOrders: 0, activeSuppliers: 0, pendingSuppliers: 0, openDisputes: 0, pendingModeration: 0, openTickets: 0, ordersByDay: [], unitsByCategory: [], topSuppliers: [] }) });
    }
    if (u.endsWith('/catalog/categories')) return Promise.resolve({ ok: true, json: async () => [] });
    if (u.endsWith('/platform-settings/return-window')) return Promise.resolve({ ok: true, json: async () => ({ returnWindowDays: 7 }) });
    if (u.endsWith('/admin-users')) return Promise.resolve({ ok: true, json: async () => [] });
    if (method === 'POST' && u.endsWith('/platform-settings/test-email')) {
      return Promise.resolve({ ok: testEmailResult.ok, status: testEmailResult.status, json: async () => testEmailResult.body });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
}

async function loginAndGoToSettings() {
  fireEvent.click(await screen.findByRole('button', { name: /log in/i }));
  await waitFor(() => screen.getByLabelText(/email/i));
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'admin@leap.dev' } });
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'admin_dev_password_123' } });
  fireEvent.click(screen.getByRole('button', { name: /log in/i }));
  await waitFor(() => expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: /settings/i }));
}

beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

// Real "send test email" feature (new) -- closes a real gap: an admin
// configuring real SMTP credentials had no way to verify email
// delivery actually works without waiting for a real customer event.
describe('Settings — real "Send test email" (mocked fetch, real component tree)', () => {
  it('CRITICAL: a successful send shows the real recipient email it was sent to', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAndGoToSettings();

    fireEvent.click(await screen.findByRole('button', { name: /send test email/i }));

    await waitFor(() => expect(screen.getByText(/admin@leap\.dev/i)).toBeInTheDocument());
  });

  it('CRITICAL: a real failure (e.g. SMTP not configured) shows the real, honest error message, not a generic one', async () => {
    globalThis.fetch = mockFetchRouter({
      testEmailResult: { ok: false, status: 400, body: { error: 'No real SMTP credentials are configured (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM_EMAIL) — set these environment variables first.' } },
    });
    render(<LeapAdminApp />);
    await loginAndGoToSettings();

    fireEvent.click(await screen.findByRole('button', { name: /send test email/i }));

    await waitFor(() => expect(screen.getByText(/no real smtp credentials are configured/i)).toBeInTheDocument());
  });
});
