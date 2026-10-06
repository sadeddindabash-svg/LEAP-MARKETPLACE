import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LeapSupplierPortalApp from './App';

const SUPPLIER_USER = { id: 'supplier_dev_seed', email: 'supplier@leap.dev', name: 'Wei Zhang', role: 'supplier', supplierId: 's1' };
const profile = (over) => ({
  id: 's1', name: 'Guangzhou AutoParts Co.', country: 'China', countryAr: 'الصين', contactEmail: 'wei@gz.cn',
  verificationStatus: 'verified', listingCount: 2, createdAt: '2026-07-01T00:00:00Z', ...over,
});

function mockBackend(supplierProfile) {
  return vi.fn((url) => {
    const u = String(url);
    const ok = (body) => Promise.resolve({ ok: true, json: async () => body });
    if (u.includes('/auth/login')) return ok({ token: 'fake.jwt.token', user: SUPPLIER_USER });
    if (u.includes('/auth/me')) return ok(SUPPLIER_USER);
    if (u.endsWith('/supplier/me')) return ok(supplierProfile);
    if (u.endsWith('/supplier/me/overview')) {
      return ok({ totalOrders: 0, pendingOrders: 0, totalListings: 0, pendingReturns: 0, ordersByDay: [], topProducts: [], recentOrders: [] });
    }
    return ok({});
  });
}

async function openSettings(supplierProfile) {
  globalThis.fetch = mockBackend(supplierProfile);
  render(<LeapSupplierPortalApp />);
  await waitFor(() => screen.getByLabelText(/邮箱|email/i));
  fireEvent.change(screen.getByLabelText(/邮箱|email/i), { target: { value: 'supplier@leap.dev' } });
  fireEvent.change(screen.getByLabelText(/密码|password/i), { target: { value: 'supplier_dev_password_123' } });
  fireEvent.click(screen.getByRole('button', { name: /登录|log in/i }));
  await waitFor(() => expect(screen.getAllByText('Guangzhou AutoParts Co.')[0]).toBeInTheDocument());
  fireEvent.click(screen.getByText(/^(店铺设置|Settings)$/));
  await screen.findByText('企业信息');
}

beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('Supplier Settings page — real profile data only (mocked fetch, real component tree)', () => {
  it('CRITICAL: shows the real company name, country, contact email and verification status', async () => {
    await openSettings(profile());
    expect(screen.getAllByText('Guangzhou AutoParts Co.').length).toBeGreaterThan(0);
    expect(screen.getByText('China')).toBeInTheDocument();
    expect(screen.getByText('wei@gz.cn')).toBeInTheDocument();
    expect(screen.getByText('已认证')).toBeInTheDocument();
  });

  it('CRITICAL: no longer shows the placeholder license number or the made-up category list', async () => {
    await openSettings(profile());
    expect(screen.queryByText(/91440101MA5XXXXXXX/)).not.toBeInTheDocument();
    expect(screen.queryByText('统一社会信用代码')).not.toBeInTheDocument();
    expect(screen.queryByText('主营类目')).not.toBeInTheDocument();
    expect(screen.queryByText(/刹车系统、发动机部件、照明系统/)).not.toBeInTheDocument();
  });

  it('CRITICAL: a supplier who is NOT verified is not told they are -- pending and rejected show their real state', async () => {
    await openSettings(profile({ verificationStatus: 'pending' }));
    expect(screen.getByText('审核中')).toBeInTheDocument();
    expect(screen.queryByText('已认证')).not.toBeInTheDocument();
  });

  it('a rejected supplier sees "not approved"', async () => {
    await openSettings(profile({ verificationStatus: 'rejected' }));
    expect(screen.getByText('未通过')).toBeInTheDocument();
    expect(screen.queryByText('已认证')).not.toBeInTheDocument();
  });
});
