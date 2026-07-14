import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LeapSupplierPortalApp from './App';

const SUPPLIER_USER = { id: 'supplier_dev_seed', email: 'supplier@leap.dev', name: 'Wei Zhang', role: 'supplier', supplierId: 's1' };
const SUPPLIER_PROFILE = { id: 's1', name: 'Guangzhou AutoParts Co.', country: 'China', contactEmail: 'wei@gz.cn', verificationStatus: 'verified', listingCount: 2, createdAt: '2025-11-02T00:00:00.000Z' };

const MOCK_OVERVIEW = {
  totalOrders: 12,
  pendingOrders: 3,
  totalListings: 5,
  pendingReturns: 1,
  ordersByDay: [{ day: '2026-07-13T00:00:00.000Z', count: 4 }],
  topProducts: [{ id: 'p1', name: 'RIDEX Front Brake Disc, Vented 300mm', units: 20 }],
  recentOrders: [{ subOrderId: 1, orderId: 'LP-200900', status: 'pending', placedAt: '2026-07-13T00:00:00.000Z' }],
};

function mockFetchRouter() {
  return vi.fn((url) => {
    const u = String(url);
    if (u.includes('/auth/login')) return Promise.resolve({ ok: true, json: async () => ({ token: 'fake.jwt.token', user: SUPPLIER_USER }) });
    if (u.includes('/auth/me')) return Promise.resolve({ ok: true, json: async () => SUPPLIER_USER });
    if (u.endsWith('/supplier/me')) return Promise.resolve({ ok: true, json: async () => SUPPLIER_PROFILE });
    if (u.endsWith('/supplier/me/overview')) return Promise.resolve({ ok: true, json: async () => MOCK_OVERVIEW });
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
}

async function loginAsSupplier() {
  await waitFor(() => screen.getByLabelText(/邮箱|email/i));
  fireEvent.change(screen.getByLabelText(/邮箱|email/i), { target: { value: 'supplier@leap.dev' } });
  fireEvent.change(screen.getByLabelText(/密码|password/i), { target: { value: 'supplier_dev_password_123' } });
  fireEvent.click(screen.getByRole('button', { name: /登录|log in/i }));
  await waitFor(() => expect(screen.getAllByText('Guangzhou AutoParts Co.')[0]).toBeInTheDocument());
}

beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('Supplier Overview page — real aggregate data (mocked fetch, real component tree)', () => {
  it('renders real counts on login (Overview is the default landing page), not fabricated ¥ sales/rating', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapSupplierPortalApp />);
    await loginAsSupplier();

    await waitFor(() => expect(screen.getByText('12')).toBeInTheDocument()); // totalOrders
    expect(screen.getByText('5')).toBeInTheDocument(); // totalListings
    // The old mock's fabricated figures should be completely gone.
    expect(screen.queryByText('¥78,250')).not.toBeInTheDocument();
    expect(screen.queryByText('4.6')).not.toBeInTheDocument();
  });

  it('renders real recent order and top product data', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapSupplierPortalApp />);
    await loginAsSupplier();

    await waitFor(() => expect(screen.getByText('LP-200900')).toBeInTheDocument());
    expect(screen.getByText(/RIDEX Front Brake Disc/)).toBeInTheDocument();
  });
});
