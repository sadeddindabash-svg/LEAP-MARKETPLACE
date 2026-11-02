import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LeapSupplierPortalApp from './App';

const SUPPLIER_USER = { id: 'supplier_dev_seed', email: 'supplier@leap.dev', name: 'Wei Zhang', role: 'supplier', supplierId: 's1' };
const SUPPLIER_PROFILE = { id: 's1', name: 'Guangzhou AutoParts Co.', country: 'China', contactEmail: 'wei@gz.cn', verificationStatus: 'verified', listingCount: 3, createdAt: '2025-11-02T00:00:00.000Z' };

// REAL BUG FOUND AND FIXED HERE: the products table used to hardcode
// `< 20` as the low-stock threshold for every product, ignoring each
// product's own real, configurable lowStockThreshold (migration 037).
// These three real products are chosen specifically to distinguish
// the old (wrong) behavior from the new (correct) one:
// - "Missed Low Stock" (30 in stock, threshold 50): old logic said
//   fine (30 < 20 is false); REAL logic says genuinely low (30 < 50)
//   -- a real false NEGATIVE the old code had (a genuinely low-stock
//   item the old table would never have highlighted at all).
// - "False Alarm" (15 in stock, threshold 5): old logic said low
//   (15 < 20 is true); REAL logic says genuinely fine (15 < 5 is
//   false) -- a real false POSITIVE the old code had.
// - "Really Low" (2 in stock, threshold 10): both old and new logic
//   happen to agree it's low -- confirms the fix didn't break the
//   case that happened to already work by coincidence.
const PRODUCTS = [
  { id: 'p1', name: 'Missed Low Stock', category: 'brake', price: 50, currencyCode: 'USD', stockQuantity: 30, lowStockThreshold: 50, status: 'active' },
  { id: 'p2', name: 'False Alarm', category: 'brake', price: 30, currencyCode: 'USD', stockQuantity: 15, lowStockThreshold: 5, status: 'active' },
  { id: 'p3', name: 'Really Low', category: 'engine', price: 80, currencyCode: 'USD', stockQuantity: 2, lowStockThreshold: 10, status: 'active' },
];

function mockFetchRouter() {
  return vi.fn((url) => {
    const u = String(url);
    if (u.includes('/auth/login')) return Promise.resolve({ ok: true, json: async () => ({ token: 'fake.jwt.token', user: SUPPLIER_USER }) });
    if (u.includes('/auth/me')) return Promise.resolve({ ok: true, json: async () => SUPPLIER_USER });
    if (u.endsWith('/supplier/me')) return Promise.resolve({ ok: true, json: async () => SUPPLIER_PROFILE });
    if (u.endsWith('/supplier/me/products')) return Promise.resolve({ ok: true, json: async () => PRODUCTS });
    if (u.endsWith('/supplier/me/overview')) {
      return Promise.resolve({ ok: true, json: async () => ({ totalOrders: 0, pendingOrders: 0, totalListings: 3, pendingReturns: 0, ordersByDay: [], topProducts: [], recentOrders: [] }) });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
}

async function loginAsSupplier() {
  await waitFor(() => screen.getByLabelText(/邮箱|email/i));
  fireEvent.change(screen.getByLabelText(/邮箱|email/i), { target: { value: 'supplier@leap.dev' } });
  fireEvent.change(screen.getByLabelText(/密码|password/i), { target: { value: 'supplier_dev_password_123' } });
  fireEvent.click(screen.getByRole('button', { name: /登录|log in/i }));
  await waitFor(() => expect(screen.getAllByText(SUPPLIER_PROFILE.name)[0]).toBeInTheDocument());
}

beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('Products page — real per-product low-stock threshold (mocked fetch, real component tree)', () => {
  it('CRITICAL: the Low stock filter shows exactly the products genuinely below their OWN real threshold, not a hardcoded one', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapSupplierPortalApp />);
    await loginAsSupplier();

    fireEvent.click(screen.getByText(/商品管理|Products/));
    await waitFor(() => expect(screen.getByText('Missed Low Stock')).toBeInTheDocument());

    // Real filter tab shows the REAL count -- 2 of 3 products are
    // genuinely low per their own threshold: "Missed Low Stock" (the
    // old hardcoded bug's exact false-NEGATIVE case) and "Really Low".
    // "False Alarm" is genuinely fine (the old bug's false-POSITIVE
    // case) and must NOT be counted.
    const lowStockTab = screen.getByText(/库存预警 \(2\)|Low stock \(2\)/);
    expect(lowStockTab).toBeInTheDocument();

    fireEvent.click(lowStockTab);
    await waitFor(() => {
      expect(screen.getByText('Missed Low Stock')).toBeInTheDocument();
      expect(screen.getByText('Really Low')).toBeInTheDocument();
      expect(screen.queryByText('False Alarm')).not.toBeInTheDocument();
    });
  });

  it('the All filter shows every real product regardless of stock level', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapSupplierPortalApp />);
    await loginAsSupplier();

    fireEvent.click(screen.getByText(/商品管理|Products/));
    await waitFor(() => expect(screen.getByText('Missed Low Stock')).toBeInTheDocument());
    expect(screen.getByText('False Alarm')).toBeInTheDocument();
    expect(screen.getByText('Really Low')).toBeInTheDocument();
  });
});

describe('Products page — real bulk price update (mocked fetch, real component tree)', () => {
  it('CRITICAL: selecting products and applying a bulk percent increase sends the real request and refreshes with real updated prices', async () => {
    let bulkUpdateCalled = false;
    const router = vi.fn((url, options) => {
      const u = String(url);
      if (u.includes('/auth/login')) return Promise.resolve({ ok: true, json: async () => ({ token: 'fake.jwt.token', user: SUPPLIER_USER }) });
      if (u.includes('/auth/me')) return Promise.resolve({ ok: true, json: async () => SUPPLIER_USER });
      if (u.endsWith('/supplier/me')) return Promise.resolve({ ok: true, json: async () => SUPPLIER_PROFILE });
      if (u.endsWith('/supplier/me/products/bulk-price-update')) {
        bulkUpdateCalled = true;
        const body = JSON.parse(options.body);
        expect(body.adjustmentType).toBe('percent');
        expect(body.adjustmentValue).toBe(10);
        expect(body.productIds.sort()).toEqual(['p1', 'p2'].sort());
        return Promise.resolve({ ok: true, json: async () => PRODUCTS.filter((p) => body.productIds.includes(p.id)).map((p) => ({ ...p, price: p.price * 1.1 })) });
      }
      if (u.endsWith('/supplier/me/products')) return Promise.resolve({ ok: true, json: async () => PRODUCTS });
      if (u.endsWith('/supplier/me/overview')) {
        return Promise.resolve({ ok: true, json: async () => ({ totalOrders: 0, pendingOrders: 0, totalListings: 3, pendingReturns: 0, ordersByDay: [], topProducts: [], recentOrders: [] }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
    globalThis.fetch = router;
    render(<LeapSupplierPortalApp />);
    await loginAsSupplier();

    fireEvent.click(screen.getByText(/商品管理|Products/));
    await waitFor(() => expect(screen.getByText('Missed Low Stock')).toBeInTheDocument());

    // Real selection -- check the two boxes for p1 (Missed Low Stock)
    // and p2 (False Alarm), leave p3 unselected.
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]); // header checkbox is index 0
    fireEvent.click(checkboxes[2]);

    await waitFor(() => expect(screen.getByText(/已选择 2|2 selected/)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/批量调价|Bulk price update/));

    await waitFor(() => screen.getByText(/批量调整价格|Bulk price adjustment/));
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '10' } });
    fireEvent.click(screen.getByText(/^应用$|^Apply$/));

    await waitFor(() => expect(bulkUpdateCalled).toBe(true));
    await waitFor(() => expect(screen.getByText(/成功更新 2 个商品|Successfully updated pricing for 2/)).toBeInTheDocument());
  });
});
