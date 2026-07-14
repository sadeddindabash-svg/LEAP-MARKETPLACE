import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LeapHubPortalApp from './App';

const HUB_USER = { id: 'hub_staff_dev_seed', email: 'hub@leap.dev', name: 'Mei Lin', role: 'hub_staff', hubId: 'hub_guangzhou' };

const SHIPMENT_SUMMARY = { id: 42, status: 'awaiting_receipt', createdAt: '2026-07-14T00:00:00.000Z', updatedAt: '2026-07-14T00:00:00.000Z', subOrderId: 100, orderId: 'LP-200999', supplierName: 'Guangzhou AutoParts Co.' };
const SHIPMENT_DETAIL = {
  id: 42, status: 'awaiting_receipt', createdAt: '2026-07-14T00:00:00.000Z', updatedAt: '2026-07-14T00:00:00.000Z',
  orderId: 'LP-200999', supplierName: 'Guangzhou AutoParts Co.',
  items: [{ productId: 'p1', name: 'RIDEX Front Brake Disc, Vented 300mm', quantity: 1 }],
  events: [],
};

function mockFetchRouter({ eventStatus = 201 } = {}) {
  return vi.fn((url, options) => {
    const u = String(url);
    const method = options?.method || 'GET';
    if (u.includes('/auth/login')) return Promise.resolve({ ok: true, json: async () => ({ token: 'fake.jwt.token', user: HUB_USER }) });
    if (u.includes('/auth/me')) return Promise.resolve({ ok: true, json: async () => HUB_USER });
    if (u.endsWith('/hub/me/shipments')) return Promise.resolve({ ok: true, json: async () => [SHIPMENT_SUMMARY] });
    if (u.endsWith('/hub/me/shipments/42')) return Promise.resolve({ ok: true, json: async () => SHIPMENT_DETAIL });
    if (method === 'POST' && u.endsWith('/hub/me/shipments/42/events')) {
      if (eventStatus === 401) return Promise.resolve({ ok: false, status: 401, json: async () => ({ error: 'unauthorized' }) });
      return Promise.resolve({ ok: true, status: 201, json: async () => ({ id: 42, status: 'received' }) });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
}

async function login() {
  await waitFor(() => screen.getByLabelText(/email/i));
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'hub@leap.dev' } });
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'hub_dev_password_123' } });
  fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
  await waitFor(() => expect(screen.getByText('Inbound shipments')).toBeInTheDocument());
}

beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('Hub Portal — real login and step workflow (mocked fetch, real component tree)', () => {
  it('logs in and shows the real inbound queue', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapHubPortalApp />);
    await login();

    await waitFor(() => expect(screen.getByText('LP-200999')).toBeInTheDocument());
    expect(screen.getByText('Guangzhou AutoParts Co.')).toBeInTheDocument();
  });

  it('rejects a successful login for a non-hub_staff role', async () => {
    globalThis.fetch = mockFetchRouter();
    const buyerRouter = vi.fn((url) => {
      const u = String(url);
      if (u.includes('/auth/login')) return Promise.resolve({ ok: true, json: async () => ({ token: 'fake.jwt.token', user: { ...HUB_USER, role: 'buyer' } }) });
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
    globalThis.fetch = buyerRouter;
    render(<LeapHubPortalApp />);

    await waitFor(() => screen.getByLabelText(/email/i));
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'someone@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'whatever123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(screen.getByText(/doesn't have inspection hub access/i)).toBeInTheDocument());
    expect(screen.queryByText('Inbound shipments')).not.toBeInTheDocument();
  });

  it('opening a shipment shows real items and the current step prompt', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapHubPortalApp />);
    await login();

    fireEvent.click(await screen.findByText('LP-200999'));
    await waitFor(() => expect(screen.getByText('Receiving this shipment')).toBeInTheDocument());
    expect(screen.getByText(/RIDEX Front Brake Disc/)).toBeInTheDocument();
  });

  it('cannot confirm a step with zero photos attached', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapHubPortalApp />);
    await login();

    fireEvent.click(await screen.findByText('LP-200999'));
    await waitFor(() => screen.getByRole('button', { name: /confirm received/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm received/i }));

    await waitFor(() => expect(screen.getByText(/at least 1 evidence photo is required/i)).toBeInTheDocument());
  });

  it('the "flag a quality issue" panel opens and can be cancelled back to the normal step view', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapHubPortalApp />);
    await login();

    fireEvent.click(await screen.findByText('LP-200999'));
    await waitFor(() => screen.getByRole('button', { name: /flag a quality issue instead/i }));
    fireEvent.click(screen.getByRole('button', { name: /flag a quality issue instead/i }));

    await waitFor(() => expect(screen.getByText('Flag a quality issue')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    await waitFor(() => expect(screen.getByText('Receiving this shipment')).toBeInTheDocument());
  });

  it('logs out correctly, clearing the session and returning to the login page', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapHubPortalApp />);
    await login();

    fireEvent.click(screen.getByRole('button', { name: /log out/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument());
    expect(localStorage.getItem('leap_hub_token')).toBeNull();
  });
});
