import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LeapSupplierPortalApp from './App';

const SUPPLIER_USER = { id: 'supplier_dev_seed', email: 'supplier@leap.dev', name: 'Wei Zhang', role: 'supplier', supplierId: 's1' };
const SUPPLIER_PROFILE = { id: 's1', name: 'Guangzhou AutoParts Co.', country: 'China', contactEmail: 'wei@gz.cn', verificationStatus: 'verified', listingCount: 2, createdAt: '2025-11-02T00:00:00.000Z' };

const MOCK_CATEGORIES = [
  { id: 'brake', nameEn: 'Brake System', nameAr: null, sortOrder: 10 },
  { id: 'filters', nameEn: 'Filters', nameAr: null, sortOrder: 40 },
];
const MOCK_BRAKE_PARTS = [
  { id: 'part_1', categoryId: 'brake', nameEn: 'Front Brake Disc', nameAr: null, sortOrder: 10 },
  { id: 'part_2', categoryId: 'brake', nameEn: 'Brake Caliper', nameAr: null, sortOrder: 50 },
];
const MOCK_FILTER_PARTS = [
  { id: 'part_3', categoryId: 'filters', nameEn: 'Air Filter', nameAr: null, sortOrder: 10 },
];

function mockFetchRouter() {
  return vi.fn((url) => {
    const u = String(url);
    if (u.includes('/auth/login')) return Promise.resolve({ ok: true, json: async () => ({ token: 'fake.jwt.token', user: SUPPLIER_USER }) });
    if (u.includes('/auth/me')) return Promise.resolve({ ok: true, json: async () => SUPPLIER_USER });
    if (u.endsWith('/supplier/me')) return Promise.resolve({ ok: true, json: async () => SUPPLIER_PROFILE });
    if (u.endsWith('/supplier/me/products')) return Promise.resolve({ ok: true, json: async () => [] });
    if (u.endsWith('/supplier/me/overview')) {
      return Promise.resolve({ ok: true, json: async () => ({ totalOrders: 0, pendingOrders: 0, totalListings: 0, pendingReturns: 0, ordersByDay: [], topProducts: [], recentOrders: [] }) });
    }
    if (u.endsWith('/catalog/categories')) return Promise.resolve({ ok: true, json: async () => MOCK_CATEGORIES });
    if (u.endsWith('/catalog/categories/brake/parts')) return Promise.resolve({ ok: true, json: async () => MOCK_BRAKE_PARTS });
    if (u.endsWith('/catalog/categories/filters/parts')) return Promise.resolve({ ok: true, json: async () => MOCK_FILTER_PARTS });
    if (u.endsWith('/fitment/brands')) return Promise.resolve({ ok: true, json: async () => [] });
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
}

async function loginAndOpenAddProduct() {
  await waitFor(() => screen.getByLabelText(/邮箱|email/i));
  fireEvent.change(screen.getByLabelText(/邮箱|email/i), { target: { value: 'supplier@leap.dev' } });
  fireEvent.change(screen.getByLabelText(/密码|password/i), { target: { value: 'supplier_dev_password_123' } });
  fireEvent.click(screen.getByRole('button', { name: /登录|log in/i }));
  await waitFor(() => expect(screen.getAllByText('Guangzhou AutoParts Co.')[0]).toBeInTheDocument());

  fireEvent.click(screen.getByText(/商品管理|products/i));
  await waitFor(() => screen.getByText(/手动添加商品|add product/i));
  fireEvent.click(screen.getByText(/手动添加商品|add product/i));
}

beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('Add Product form — real category/part cascading dropdowns (mocked fetch, real component tree)', () => {
  it('CRITICAL: loads real categories, and the Part dropdown shows real parts for the default selected category', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapSupplierPortalApp />);
    await loginAndOpenAddProduct();

    await waitFor(() => expect(screen.getByText('Front Brake Disc')).toBeInTheDocument());
    expect(screen.getByText('Brake Caliper')).toBeInTheDocument();
    // The other category's parts should NOT be pre-loaded into this dropdown.
    expect(screen.queryByText('Air Filter')).not.toBeInTheDocument();
  });

  it('CRITICAL: changing the Category real-fetches and swaps in that category\'s real parts (cascading)', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapSupplierPortalApp />);
    await loginAndOpenAddProduct();

    await waitFor(() => screen.getByText('Front Brake Disc'));
    const categorySelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(categorySelect, { target: { value: 'filters' } });

    await waitFor(() => expect(screen.getByText('Air Filter')).toBeInTheDocument());
    // The brake parts should no longer be in the Part dropdown's options.
    expect(screen.queryByText('Front Brake Disc')).not.toBeInTheDocument();
  });
});
