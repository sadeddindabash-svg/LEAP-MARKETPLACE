import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import LeapSupplierPortalApp from './App';

const SUPPLIER_USER = { id: 'supplier_dev_seed', email: 'supplier@leap.dev', name: 'Wei Zhang', role: 'supplier', supplierId: 's1' };
const SUPPLIER_PROFILE = { id: 's1', name: 'Guangzhou AutoParts Co.', country: 'China', contactEmail: 'wei@gz.cn', verificationStatus: 'verified', listingCount: 2, createdAt: '2025-11-02T00:00:00.000Z' };

// What GET /supplier/me/finance returns (see services/api/src/modules/supplierFinance/queries.js).
const FINANCE = {
  currencyCode: 'USD', returnWindowDays: 7,
  readyToPay: { amount: 123.45, orderCount: 3 },
  inReturnWindow: { amount: 526.84, orderCount: 16 },
  totalPaid: 767.96,
  lastPayout: { amount: 33.19, paidAt: '2026-07-05T00:00:00.000Z' },
  commission: { minPercent: 17, maxPercent: 17, categories: [{ id: 'brake', nameEn: 'Brake System', nameAr: 'نظام الفرامل', percent: 17 }] },
  payouts: [{ id: 1, amount: 33.19, currencyCode: 'USD', notes: 'July payout', paidAt: '2026-07-05T00:00:00.000Z', orderCount: 1, sales: 39.99, commission: 6.8 }],
};

function mockFetchRouter({ existingPayoutMethod = null, finance = FINANCE, financeFails = false } = {}) {
  let payoutMethod = existingPayoutMethod;
  return vi.fn((url, options) => {
    const u = String(url);
    const method = options?.method || 'GET';
    if (u.includes('/auth/login')) return Promise.resolve({ ok: true, json: async () => ({ token: 'fake.jwt.token', user: SUPPLIER_USER }) });
    if (u.includes('/auth/me')) return Promise.resolve({ ok: true, json: async () => SUPPLIER_USER });
    if (u.endsWith('/supplier/me')) return Promise.resolve({ ok: true, json: async () => SUPPLIER_PROFILE });
    // A realistic (empty) overview: the Overview page is the landing page after login and renders
    // before the test clicks Finance, so an empty {} here used to crash it whenever it won the race.
    if (u.endsWith('/supplier/me/overview')) return Promise.resolve({ ok: true, json: async () => ({ totalOrders: 0, pendingOrders: 0, totalListings: 0, pendingReturns: 0, ordersByDay: [], topProducts: [], recentOrders: [] }) });
    if (u.endsWith('/supplier/me/finance')) {
      return financeFails
        ? Promise.resolve({ ok: false, status: 500, json: async () => ({ error: 'boom' }) })
        : Promise.resolve({ ok: true, json: async () => finance });
    }
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

describe('Supplier Finance page — real figures instead of typed-in ones (mocked fetch, real component tree)', () => {
  async function openFinance(options) {
    globalThis.fetch = mockFetchRouter({ existingPayoutMethod: { bankName: 'ICBC', accountNumber: '111222333', accountHolderName: 'Guangzhou AutoParts Co.' }, ...options });
    render(<LeapSupplierPortalApp />);
    await loginAsSupplier();
    goToFinance();
  }

  it('CRITICAL: payments Leap RELEASED for a shipment damaged in its care are listed by order and kind, with what they are, so a bigger "ready to pay" is never a mystery', async () => {
    await openFinance({ finance: { ...FINANCE, readyToPay: { amount: 175.95, orderCount: 3, adjustments: [
      { kind: 'original_order', amount: 41.2, orderId: 'LP-900555' },
      { kind: 'local_shipping', amount: 11.3, orderId: 'LP-900555' },
    ] } } });
    await waitFor(() => expect(screen.getByText('Leap 已放款')).toBeInTheDocument());
    const card = screen.getByText('Leap 已放款').closest('div').parentElement;
    expect(within(card).getAllByText('LP-900555')).toHaveLength(2);
    expect(within(card).getByText('原订单')).toBeInTheDocument();
    expect(within(card).getByText('国内运费')).toBeInTheDocument();
    expect(within(card).getByText('$41.20')).toBeInTheDocument();
    expect(within(card).getByText('$11.30')).toBeInTheDocument();
    expect(within(card).getByText(/因货物在 Leap 处受损/)).toBeInTheDocument();
    expect(screen.getByText(/175\.95/)).toBeInTheDocument();                     // and the total it is part of
  });

  it('a supplier with nothing released sees no such card (and no empty box)', async () => {
    await openFinance();
    await waitFor(() => expect(screen.getByText(/123\.45/)).toBeInTheDocument());
    expect(screen.queryByText('Leap 已放款')).not.toBeInTheDocument();
  });

  it('CRITICAL: shows the real figures in USD, and none of the old made-up ones (¥54,542, ¥60,210, 12%, fake history)', async () => {
    await openFinance();
    await waitFor(() => expect(screen.getByText(/123\.45/)).toBeInTheDocument());   // ready to be paid
    expect(screen.getByText(/526\.84/)).toBeInTheDocument();                       // still in the return window
    expect(screen.getAllByText(/767\.96/).length).toBeGreaterThan(0);              // paid out so far
    expect(screen.getByText('17%')).toBeInTheDocument();                            // the one real commission rate
    expect(screen.getByText('Brake System')).toBeInTheDocument();
    expect(screen.getByText(/USD/)).toBeInTheDocument();                            // says what currency it is

    // the history row is the real payout: sales, commission taken (negative), payout, note
    expect(screen.getByText(/39\.99/)).toBeInTheDocument();
    expect(screen.getByText(/-\$6\.80/)).toBeInTheDocument();
    expect(screen.getByText('July payout')).toBeInTheDocument();

    expect(document.body.textContent).not.toContain('¥');
    expect(screen.queryByText(/54,542/)).not.toBeInTheDocument();
    expect(screen.queryByText(/60,210/)).not.toBeInTheDocument();
    expect(screen.queryByText('12%')).not.toBeInTheDocument();
    expect(screen.queryByText(/68,420|61,980|20,140/)).not.toBeInTheDocument(); // the old fake history sales
  });

  it('commission rates that differ by category show as a range', async () => {
    await openFinance({
      finance: { ...FINANCE, commission: { minPercent: 12, maxPercent: 17, categories: [
        { id: 'brake', nameEn: 'Brake System', nameAr: '', percent: 17 }, { id: 'light', nameEn: 'Lighting', nameAr: '', percent: 12 },
      ] } },
    });
    await waitFor(() => expect(screen.getByText('12–17%')).toBeInTheDocument());
  });

  it('a supplier with no payouts yet sees an honest empty message, not invented history rows', async () => {
    await openFinance({ finance: { ...FINANCE, totalPaid: 0, lastPayout: null, payouts: [] } });
    await waitFor(() => expect(screen.getByText(/暂无结算记录。/)).toBeInTheDocument());
    expect(screen.queryByText('July payout')).not.toBeInTheDocument();
  });

  it('CRITICAL: if the figures cannot be loaded, it says so instead of showing zeros or stale numbers', async () => {
    await openFinance({ financeFails: true });
    await waitFor(() => expect(screen.getByText(/无法加载财务数据/)).toBeInTheDocument());
    expect(screen.getByText(/boom/)).toBeInTheDocument();
    expect(screen.queryByText(/123\.45/)).not.toBeInTheDocument();
  });
});
