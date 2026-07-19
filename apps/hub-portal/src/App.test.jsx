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

describe('Hub Portal — real Confirm Delivered UI (new, migration 027)', () => {
  const SHIPPED_TO_BUYER_DETAIL = {
    ...SHIPMENT_DETAIL, status: 'shipped_to_buyer',
    events: [{ id: 1, step: 'shipped_to_buyer', notes: null, trackingNumber: 'INTL-TEST-001', photos: [], performedBy: 'Mei Lin', createdAt: '2026-07-14T00:00:00.000Z' }],
  };

  function mockFetchRouterShippedToBuyer({ confirmStatus = 200 } = {}) {
    let currentDetail = { ...SHIPPED_TO_BUYER_DETAIL };
    return vi.fn((url, options) => {
      const u = String(url);
      const method = options?.method || 'GET';
      if (u.includes('/auth/login')) return Promise.resolve({ ok: true, json: async () => ({ token: 'fake.jwt.token', user: HUB_USER }) });
      if (u.includes('/auth/me')) return Promise.resolve({ ok: true, json: async () => HUB_USER });
      if (u.endsWith('/hub/me/shipments')) return Promise.resolve({ ok: true, json: async () => [{ ...SHIPMENT_SUMMARY, status: 'shipped_to_buyer' }] });
      if (u.endsWith('/hub/me/shipments/42') && method === 'GET') return Promise.resolve({ ok: true, json: async () => currentDetail });
      if (method === 'PATCH' && u.endsWith('/hub/me/shipments/42/confirm-delivery')) {
        const body = JSON.parse(options.body);
        if (!body.deliveryNote || !body.deliveryNote.trim()) {
          return Promise.resolve({ ok: false, status: 400, json: async () => ({ error: 'A short note is required when manually confirming delivery yourself.' }) });
        }
        if (confirmStatus !== 200) return Promise.resolve({ ok: false, status: confirmStatus, json: async () => ({ error: 'This order was already confirmed delivered by real carrier tracking.' }) });
        currentDetail = { ...currentDetail, status: 'delivered' };
        return Promise.resolve({ ok: true, json: async () => ({ id: 42, status: 'delivered', deliveredAt: new Date().toISOString(), deliveryConfirmedBy: 'hub_manual' }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
  }

  it('CRITICAL: shows the real Confirm Delivered action once a shipment reaches shipped_to_buyer, not before', async () => {
    globalThis.fetch = mockFetchRouterShippedToBuyer();
    render(<LeapHubPortalApp />);
    await login();

    await waitFor(() => expect(screen.getByText('LP-200999')).toBeInTheDocument());
    fireEvent.click(screen.getByText('LP-200999'));
    await waitFor(() => expect(screen.getAllByText(/confirm delivered/i).length).toBeGreaterThan(0));
  });

  it('CRITICAL: confirming delivery without a real note is rejected; with one, it succeeds and the shipment moves to delivered', async () => {
    globalThis.fetch = mockFetchRouterShippedToBuyer();
    render(<LeapHubPortalApp />);
    await login();
    await waitFor(() => expect(screen.getByText('LP-200999')).toBeInTheDocument());
    fireEvent.click(screen.getByText('LP-200999'));
    await waitFor(() => expect(screen.getAllByText(/confirm delivered/i).length).toBeGreaterThan(0));

    const confirmButtons = screen.getAllByText(/confirm delivered/i);
    const confirmButton = confirmButtons.find((el) => el.tagName === 'BUTTON');
    expect(confirmButton.disabled).toBe(true); // real: disabled with no note typed yet

    const textarea = screen.getByPlaceholderText(/tracking never updated/i);
    fireEvent.change(textarea, { target: { value: 'Buyer confirmed receipt via chat' } });
    fireEvent.click(confirmButton);

    await waitFor(() => expect(screen.getByText(/completed its journey/i)).toBeInTheDocument());
  });

  it('shows the real backend rejection message if already carrier-confirmed', async () => {
    globalThis.fetch = mockFetchRouterShippedToBuyer({ confirmStatus: 400 });
    render(<LeapHubPortalApp />);
    await login();
    await waitFor(() => expect(screen.getByText('LP-200999')).toBeInTheDocument());
    fireEvent.click(screen.getByText('LP-200999'));
    await waitFor(() => expect(screen.getAllByText(/confirm delivered/i).length).toBeGreaterThan(0));

    const textarea = screen.getByPlaceholderText(/tracking never updated/i);
    fireEvent.change(textarea, { target: { value: 'trying anyway' } });
    const confirmButtons = screen.getAllByText(/confirm delivered/i);
    fireEvent.click(confirmButtons.find((el) => el.tagName === 'BUTTON'));

    await waitFor(() => expect(screen.getByText(/already confirmed delivered by real carrier tracking/i)).toBeInTheDocument());
  });
});
