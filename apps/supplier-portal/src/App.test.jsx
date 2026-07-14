import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LeapSupplierPortalApp from './App';

const SUPPLIER_USER = { id: 'supplier_dev_seed', email: 'supplier@leap.dev', name: 'Wei Zhang', role: 'supplier', supplierId: 's1' };
const BUYER_USER = { id: 'u_123', email: 'buyer@example.com', name: 'A Buyer', role: 'buyer' };
const SUPPLIER_PROFILE = { id: 's1', name: 'Guangzhou AutoParts Co.', country: 'China', contactEmail: 'wei@gz.cn', verificationStatus: 'verified', listingCount: 2, createdAt: '2025-11-02T00:00:00.000Z' };

function mockFetchRouter({ loginUser = SUPPLIER_USER } = {}) {
  return vi.fn((url) => {
    const u = String(url);
    if (u.includes('/auth/login')) return Promise.resolve({ ok: true, json: async () => ({ token: 'fake.jwt.token', user: loginUser }) });
    if (u.includes('/auth/me')) return Promise.resolve({ ok: true, json: async () => loginUser });
    if (u.endsWith('/supplier/me')) return Promise.resolve({ ok: true, json: async () => SUPPLIER_PROFILE });
    if (u.endsWith('/supplier/me/products')) return Promise.resolve({ ok: true, json: async () => [] });
    // Overview is the default landing page after login, so it's the
    // first real page this test suite renders — it needs a valid shape
    // here or the whole app crashes rendering it (found via the standard
    // clean-merge verification process, same as the moderation test DB
    // bug from a previous pass; not something a first pass would reveal
    // by inspection since App.test.jsx wasn't touched when Overview was
    // built, only OverviewFlow.test.jsx was).
    if (u.endsWith('/supplier/me/overview')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ totalOrders: 0, pendingOrders: 0, totalListings: 0, pendingReturns: 0, ordersByDay: [], topProducts: [], recentOrders: [] }),
      });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
}

beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('Supplier portal auth gate', () => {
  it('shows the login page when no session is saved', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapSupplierPortalApp />);
    await waitFor(() => expect(screen.getByRole('button', { name: /登录|log in/i })).toBeInTheDocument());
  });

  it('logs in successfully as a supplier and shows the real company name in the sidebar', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapSupplierPortalApp />);

    await waitFor(() => screen.getByLabelText(/邮箱|email/i));
    fireEvent.change(screen.getByLabelText(/邮箱|email/i), { target: { value: 'supplier@leap.dev' } });
    fireEvent.change(screen.getByLabelText(/密码|password/i), { target: { value: 'supplier_dev_password_123' } });
    fireEvent.click(screen.getByRole('button', { name: /登录|log in/i }));

    await waitFor(() => expect(screen.getAllByText('Guangzhou AutoParts Co.')[0]).toBeInTheDocument());
  });

  it('rejects a successful login for a non-supplier role (e.g. a buyer account)', async () => {
    globalThis.fetch = mockFetchRouter({ loginUser: BUYER_USER });
    render(<LeapSupplierPortalApp />);

    await waitFor(() => screen.getByLabelText(/邮箱|email/i));
    fireEvent.change(screen.getByLabelText(/邮箱|email/i), { target: { value: 'buyer@example.com' } });
    fireEvent.change(screen.getByLabelText(/密码|password/i), { target: { value: 'whatever123' } });
    fireEvent.click(screen.getByRole('button', { name: /登录|log in/i }));

    await waitFor(() => expect(screen.getByText(/供应商门户访问权限|supplier portal access/i)).toBeInTheDocument());
    // Should still be on the login page, not the dashboard.
    expect(screen.queryByText('Guangzhou AutoParts Co.')).not.toBeInTheDocument();
  });

  it('language toggle works on the login page itself', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapSupplierPortalApp />);

    await waitFor(() => screen.getByText('供应商门户登录')); // default zh
    fireEvent.click(screen.getByRole('button', { name: 'EN' }));
    await waitFor(() => expect(screen.getByText('Supplier portal login')).toBeInTheDocument());
  });

  it('logs out correctly: clears token and returns to login page', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapSupplierPortalApp />);

    await waitFor(() => screen.getByLabelText(/邮箱|email/i));
    fireEvent.change(screen.getByLabelText(/邮箱|email/i), { target: { value: 'supplier@leap.dev' } });
    fireEvent.change(screen.getByLabelText(/密码|password/i), { target: { value: 'supplier_dev_password_123' } });
    fireEvent.click(screen.getByRole('button', { name: /登录|log in/i }));

    await waitFor(() => expect(screen.getAllByText('Guangzhou AutoParts Co.')[0]).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /退出登录|log out/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /登录|log in/i })).toBeInTheDocument());
    expect(localStorage.getItem('leap_supplier_token')).toBeNull();
  });
});
