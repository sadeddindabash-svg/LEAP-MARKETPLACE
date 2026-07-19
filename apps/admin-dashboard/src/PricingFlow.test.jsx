import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LeapAdminApp from './App';

const ADMIN_USER = { id: 'admin_dev_seed', email: 'admin@leap.dev', name: 'Dev Admin', role: 'admin', isOwner: true, allowedPages: 'all' };

function mockFetchRouter() {
  let fees = [
    { id: 'fee_leap', name: 'Leap Platform Fee', type: 'percentage', value: 15, sortOrder: 10, isActive: true, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fee_bank', name: 'Bank Fee', type: 'percentage', value: 2, sortOrder: 20, isActive: true, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  ];
  let fxRate = { currencyPair: 'CNY_USD', rate: 0.14, source: 'manual', updatedAt: '2026-01-01T00:00:00.000Z' };
  let fxRateMode = 'manual';

  return vi.fn((url, options) => {
    const u = String(url);
    const method = options?.method || 'GET';
    if (u.includes('/auth/login')) return Promise.resolve({ ok: true, json: async () => ({ token: 'fake.jwt.token', user: ADMIN_USER }) });
    if (u.includes('/auth/me')) return Promise.resolve({ ok: true, json: async () => ADMIN_USER });
    if (u.endsWith('/overview')) {
      return Promise.resolve({ ok: true, json: async () => ({ totalOrders: 0, activeSuppliers: 0, pendingSuppliers: 0, openDisputes: 0, pendingModeration: 0, openTickets: 0, ordersByDay: [], unitsByCategory: [], topSuppliers: [] }) });
    }
    if (method === 'POST' && u.match(/\/pricing\/fee-components\/.+\/move$/)) {
      const id = u.split('/').slice(-2)[0];
      const { direction } = JSON.parse(options.body);
      const sorted = [...fees].sort((a, b) => a.sortOrder - b.sortOrder);
      const idx = sorted.findIndex((f) => f.id === id);
      const neighborIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (neighborIdx < 0 || neighborIdx >= sorted.length) {
        return Promise.resolve({ ok: false, status: 400, json: async () => ({ error: `This is already the ${direction === 'up' ? 'first' : 'last'} fee component.` }) });
      }
      const currentSort = sorted[idx].sortOrder;
      const neighborSort = sorted[neighborIdx].sortOrder;
      fees = fees.map((f) => {
        if (f.id === sorted[idx].id) return { ...f, sortOrder: neighborSort };
        if (f.id === sorted[neighborIdx].id) return { ...f, sortOrder: currentSort };
        return f;
      });
      return Promise.resolve({ ok: true, json: async () => fees });
    }
    if (method === 'POST' && u.endsWith('/pricing/fee-components')) {
      const b = JSON.parse(options.body);
      const newFee = { id: 'fee_new', name: b.name, type: b.type, value: b.value, sortOrder: b.sortOrder, isActive: true, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
      fees = [...fees, newFee];
      return Promise.resolve({ ok: true, status: 201, json: async () => newFee });
    }
    if (u.endsWith('/pricing/fee-components')) return Promise.resolve({ ok: true, json: async () => [...fees].sort((a, b) => a.sortOrder - b.sortOrder) });
    if (method === 'PATCH' && u.endsWith('/pricing/fx-rate')) {
      const b = JSON.parse(options.body);
      fxRate = { ...fxRate, rate: b.rate };
      return Promise.resolve({ ok: true, json: async () => fxRate });
    }
    if (u.endsWith('/pricing/fx-rate')) return Promise.resolve({ ok: true, json: async () => fxRate });
    if (method === 'PATCH' && u.endsWith('/pricing/fx-rate-mode')) {
      const b = JSON.parse(options.body);
      if (!['automatic', 'manual'].includes(b.mode)) return Promise.resolve({ ok: false, status: 400, json: async () => ({ error: "mode must be 'automatic' or 'manual'" }) });
      fxRateMode = b.mode;
      return Promise.resolve({ ok: true, json: async () => ({ mode: fxRateMode }) });
    }
    if (u.endsWith('/pricing/fx-rate-mode')) return Promise.resolve({ ok: true, json: async () => ({ mode: fxRateMode }) });
    if (method === 'POST' && u.endsWith('/pricing/preview')) {
      const b = JSON.parse(options.body);
      return Promise.resolve({
        ok: true,
        json: async () => ({
          buyerPriceUsd: 14.0,
          landedCostCny: 100.0,
          fxRate: 0.14,
          fxSource: 'manual',
          breakdown: [
            { step: 'Supplier cost (RMB)', amountCny: b.supplierCostCny, runningTotalCny: b.supplierCostCny },
            { step: 'Leap Platform Fee', type: 'percentage', amountCny: 15, runningTotalCny: 100 },
          ],
        }),
      });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
}

async function loginAndGoToPricing() {
  fireEvent.click(await screen.findByRole('button', { name: /log in/i }));
  await waitFor(() => screen.getByLabelText(/email/i));
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'admin@leap.dev' } });
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'admin_dev_password_123' } });
  fireEvent.click(screen.getByRole('button', { name: /log in/i }));
  await waitFor(() => expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: /^pricing$/i }));
}

beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('Pricing page — real fee/FX-rate management and preview calculator (mocked fetch, real component tree)', () => {
  it('renders the real seeded fee component and current FX rate', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAndGoToPricing();

    await waitFor(() => expect(screen.getByText('Leap Platform Fee')).toBeInTheDocument());
    expect(screen.getByDisplayValue('0.14')).toBeInTheDocument();
  });

  it('adding a new fee component calls the real create endpoint and shows it immediately', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAndGoToPricing();

    await waitFor(() => screen.getByPlaceholderText(/fee name/i));
    fireEvent.change(screen.getByPlaceholderText(/fee name/i), { target: { value: 'Insurance' } });
    fireEvent.change(screen.getByPlaceholderText(/^value$/i), { target: { value: '1.5' } });
    fireEvent.click(screen.getByRole('button', { name: /add fee/i }));

    await waitFor(() => expect(screen.getByText('Insurance')).toBeInTheDocument());
  });

  it('updating the FX rate calls the real update endpoint', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAndGoToPricing();

    await waitFor(() => screen.getByDisplayValue('0.14'));
    fireEvent.change(screen.getByDisplayValue('0.14'), { target: { value: '0.15' } });
    fireEvent.click(screen.getByRole('button', { name: /update rate/i }));

    await waitFor(() => expect(screen.getByDisplayValue('0.15')).toBeInTheDocument());
  });

  it('the preview calculator shows a real computed breakdown and final USD price', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAndGoToPricing();

    await waitFor(() => screen.getByPlaceholderText(/supplier cost/i));
    fireEvent.change(screen.getByPlaceholderText(/supplier cost/i), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: /calculate/i }));

    await waitFor(() => expect(screen.getByText(/\$14\.00 USD/)).toBeInTheDocument());
  });

  it('the preview calculator shows a clear error without a cost entered', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAndGoToPricing();

    await waitFor(() => screen.getByRole('button', { name: /calculate/i }));
    fireEvent.click(screen.getByRole('button', { name: /calculate/i }));

    await waitFor(() => expect(screen.getByText(/enter a supplier cost/i)).toBeInTheDocument());
  });

  it('CRITICAL: clicking the real move-down arrow calls the real move endpoint and the fee order updates', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAndGoToPricing();

    await waitFor(() => screen.getByText('Leap Platform Fee'));
    // Before: Leap Platform Fee (10) is above Bank Fee (20).
    const beforeRows = screen.getAllByText(/Leap Platform Fee|Bank Fee/);
    expect(beforeRows[0].textContent).toBe('Leap Platform Fee');

    fireEvent.click(screen.getAllByTitle('Move down')[0]);

    await waitFor(() => {
      const afterRows = screen.getAllByText(/Leap Platform Fee|Bank Fee/);
      expect(afterRows[0].textContent).toBe('Bank Fee');
    });
  });

  it('the real move-up arrow is disabled for the first fee component', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAndGoToPricing();

    await waitFor(() => screen.getByText('Leap Platform Fee'));
    expect(screen.getAllByTitle('Move up')[0]).toBeDisabled();
  });

  it('CRITICAL: defaults to Manual mode, showing the real editable rate input', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAndGoToPricing();

    await waitFor(() => screen.getByDisplayValue('0.14'));
    expect(screen.getAllByText('Manual').length).toBeGreaterThan(0);
  });

  it('CRITICAL: toggling to Automatic calls the real endpoint and hides the manual rate input', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAndGoToPricing();

    await waitFor(() => screen.getByDisplayValue('0.14'));
    fireEvent.click(screen.getByRole('button', { name: 'Manual' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Automatic' })).toBeInTheDocument());
    expect(screen.queryByDisplayValue('0.14')).not.toBeInTheDocument();
  });
});
