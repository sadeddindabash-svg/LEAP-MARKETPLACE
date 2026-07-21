import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LeapSupplierPortalApp from './App';

const SUPPLIER_USER = { id: 'supplier_dev_seed', email: 'supplier@leap.dev', name: 'Wei Zhang', role: 'supplier', supplierId: 's1' };
const SUPPLIER_PROFILE = { id: 's1', name: 'Guangzhou AutoParts Co.', country: 'China', contactEmail: 'wei@gz.cn', verificationStatus: 'verified', listingCount: 2, createdAt: '2025-11-02T00:00:00.000Z' };

function mockFetchRouter({ existingPayoutMethod = null } = {}) {
  let payoutMethod = existingPayoutMethod;
  return vi.fn((url, options) => {
    const u = String(url);
    const method = options?.method || 'GET';
    if (u.includes('/auth/login')) return Promise.resolve({ ok: true, json: async () => ({ token: 'fake.jwt.token', user: SUPPLIER_USER }) });
    if (u.includes('/auth/me')) return Promise.resolve({ ok: true, json: async () => SUPPLIER_USER });
    if (u.endsWith('/supplier/me')) return Promise.resolve({ ok: true, json: async () => SUPPLIER_PROFILE });
    if (u.endsWith('/supplier/me/overview')) return Promise.resolve({ ok: true, json: async () => ({}) });
    if (method === 'PUT' && u.endsWith('/supplier/me/payout-method')) {
      const body = JSON.parse(options.body);
      if (!body.bankName || !body.accountNumber || !body.accountHolderName) {
        return Promise.resolve({ ok: false, status: 400, json: async () => ({ error: 'bankName, accountNumber, and accountHolderName are all required.' }) });
      }
      payoutMethod = { ...body, updatedAt: new Date().toISOString() };
      return Promise.resolve({ ok: true, json: async () => payoutMethod });
    }
    if (u.endsWith('/supplier/me/payout-method')) return Promise.resolve({ ok: true, json: async () => payoutMethod });
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

function goToFinance() {
  fireEvent.click(screen.getByText(/^(财务结算|Finance)$/));
}

beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('Supplier Finance page — real payout method (mocked fetch, real component tree)', () => {
  it('CRITICAL: with no real payout method on file, goes straight to the real editable form, not a fake placeholder card', async () => {
    globalThis.fetch = mockFetchRouter({ existingPayoutMethod: null });
    render(<LeapSupplierPortalApp />);
    await loginAsSupplier();
    goToFinance();

    await waitFor(() => expect(screen.getByPlaceholderText('银行名称')).toBeInTheDocument());
    // The old, entirely fake hardcoded bank details must be gone.
    expect(screen.queryByText(/China Construction Bank/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/8842/)).not.toBeInTheDocument();
  });

  it('CRITICAL: saving without every real field is rejected; with all three, it succeeds and shows the real saved details', async () => {
    globalThis.fetch = mockFetchRouter({ existingPayoutMethod: null });
    render(<LeapSupplierPortalApp />);
    await loginAsSupplier();
    goToFinance();
    await waitFor(() => screen.getByPlaceholderText('银行名称'));

    fireEvent.click(screen.getByText('保存'));
    await waitFor(() => expect(screen.getByText('请填写所有字段')).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText('银行名称'), { target: { value: 'Bank of China' } });
    fireEvent.change(screen.getByPlaceholderText('账号'), { target: { value: '999888777' } });
    fireEvent.change(screen.getByPlaceholderText('账户持有人姓名'), { target: { value: 'Guangzhou AutoParts Co.' } });
    fireEvent.click(screen.getByText('保存'));

    await waitFor(() => expect(screen.getByText(/Bank of China — 999888777/)).toBeInTheDocument());
    expect(screen.getByText(/户名：Guangzhou AutoParts Co\./)).toBeInTheDocument();
  });

  it('CRITICAL: with a real existing payout method, shows it read-only with an Edit action, not the form directly', async () => {
    globalThis.fetch = mockFetchRouter({
      existingPayoutMethod: { bankName: 'ICBC', accountNumber: '111222333', accountHolderName: 'Guangzhou AutoParts Co.', updatedAt: '2026-01-01T00:00:00.000Z' },
    });
    render(<LeapSupplierPortalApp />);
    await loginAsSupplier();
    goToFinance();

    await waitFor(() => expect(screen.getByText(/ICBC — 111222333/)).toBeInTheDocument());
    expect(screen.queryByPlaceholderText('银行名称')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('编辑'));
    await waitFor(() => expect(screen.getByPlaceholderText('银行名称')).toBeInTheDocument());
    expect(screen.getByPlaceholderText('银行名称').value).toBe('ICBC');

    fireEvent.click(screen.getByText('取消'));
    await waitFor(() => expect(screen.getByText(/ICBC — 111222333/)).toBeInTheDocument());
  });
});
