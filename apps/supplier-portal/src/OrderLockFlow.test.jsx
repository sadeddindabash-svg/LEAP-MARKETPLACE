import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LeapSupplierPortalApp from './App';

const SUPPLIER_USER = { id: 'supplier_dev_seed', email: 'supplier@leap.dev', name: 'Wei Zhang', role: 'supplier', supplierId: 's1' };
const PROFILE = { id: 's1', name: 'Guangzhou AutoParts Co.', country: 'China', contactEmail: 'wei@gz.cn', verificationStatus: 'verified', listingCount: 2, createdAt: '2026-07-01T00:00:00Z' };

// The labels of the supplier's own leg in the portal's default (Chinese) interface.
const PENDING = '待确认', PREPARING = '备货中', SHIPPED = '已发货';

const order = (over = {}) => ({
  subOrderId: 7001, orderId: 'LP-910100', status: 'pending', trackingNumber: null, hubId: 'hub_guangzhou', hubName: 'Guangzhou Inspection Hub', hubAddress: 'Panyu District',
  hubShipmentId: null, placedAt: '2026-07-01T00:00:00Z', items: [{ productId: 'p1', name: 'RIDEX Front Brake Disc', quantity: 1, unitPrice: 39.99 }],
  locked: false, lockReason: null, allowedStatuses: ['preparing', 'shipped'], canEditTracking: true, ...over,
});

// Mocked backend: the order list, and PATCH answers the way the real server does (new status + what is allowed next).
function mockBackend(initial, patches = []) {
  return vi.fn((url, options) => {
    const u = String(url);
    const method = options?.method || 'GET';
    const ok = (body) => Promise.resolve({ ok: true, status: 200, json: async () => body });
    if (u.includes('/auth/login')) return ok({ token: 'fake.jwt.token', user: SUPPLIER_USER });
    if (u.includes('/auth/me')) return ok(SUPPLIER_USER);
    if (u.endsWith('/returns/supplier/me')) return ok([]);
    if (u.endsWith('/fault-cases/supplier/me')) return ok([]);
    if (u.endsWith('/supplier/me/overview')) return ok({ totalOrders: 0, pendingOrders: 0, totalListings: 0, pendingReturns: 0, ordersByDay: [], topProducts: [], recentOrders: [] });
    if (u.endsWith('/supplier/me/orders') && method === 'GET') return ok([initial]);
    if (u.endsWith('/supplier/me')) return ok(PROFILE);
    if (u.match(/\/supplier\/me\/orders\/7001$/) && method === 'PATCH') {
      const body = JSON.parse(options.body);
      patches.push(body);
      const status = body.status || initial.status;
      const next = { preparing: ['shipped'], pending: ['preparing', 'shipped'], shipped: [] }[status] || [];
      return ok({ subOrderId: 7001, orderId: initial.orderId, status, trackingNumber: body.trackingNumber ?? initial.trackingNumber, locked: false, lockReason: null, allowedStatuses: next, canEditTracking: true });
    }
    return ok({});
  });
}

async function openOrder(initial, patches) {
  globalThis.fetch = mockBackend(initial, patches);
  render(<LeapSupplierPortalApp />);
  await waitFor(() => screen.getByLabelText(/邮箱|email/i));
  fireEvent.change(screen.getByLabelText(/邮箱|email/i), { target: { value: 'supplier@leap.dev' } });
  fireEvent.change(screen.getByLabelText(/密码|password/i), { target: { value: 'supplier_dev_password_123' } });
  fireEvent.click(screen.getByRole('button', { name: /登录|log in/i }));
  await waitFor(() => expect(screen.getAllByText('Guangzhou AutoParts Co.')[0]).toBeInTheDocument());
  fireEvent.click(screen.getByText(/^(订单管理|Orders)$/));
  fireEvent.click(await screen.findByText('LP-910100'));
  await screen.findByText('操作');
}
const statusButton = (label) => screen.getByRole('button', { name: label });

beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('Supplier order panel: forward only, and locked once the hub has the parcel (mocked fetch, real component tree)', () => {
  it('CRITICAL: a pending order offers only the steps ahead; once preparing, "pending" is no longer clickable and only "shipped" is left', async () => {
    const patches = [];
    await openOrder(order(), patches);
    expect(statusButton(PENDING)).toBeDisabled();            // where it is now
    expect(statusButton(PREPARING)).toBeEnabled();
    expect(statusButton(SHIPPED)).toBeEnabled();

    fireEvent.click(statusButton(PREPARING));
    await waitFor(() => expect(patches).toEqual([{ status: 'preparing' }]));
    await waitFor(() => expect(statusButton(SHIPPED)).toBeEnabled());
    expect(statusButton(PENDING)).toBeDisabled();             // cannot go back
    expect(statusButton(PREPARING)).toBeDisabled();           // where it is now
    expect(screen.getByText(/状态只能向前推进/)).toBeInTheDocument();   // and the portal says so
  });

  it('CRITICAL: a shipped order cannot go back to anything, but its tracking number can still be corrected (until the hub receives it)', async () => {
    const patches = [];
    await openOrder(order({ status: 'shipped', trackingNumber: 'SF-TYPO', allowedStatuses: [], hubShipmentId: 55 }), patches);
    for (const label of [PENDING, PREPARING, SHIPPED]) expect(statusButton(label)).toBeDisabled();
    expect(screen.queryByRole('button', { name: '标记已发货' })).not.toBeInTheDocument();   // it is already shipped
    const tracking = screen.getByPlaceholderText('请输入运单号');
    expect(tracking).toBeEnabled();
    fireEvent.change(tracking, { target: { value: 'SF-CORRECT' } });
    fireEvent.click(screen.getByRole('button', { name: '更新运单号' }));
    await waitFor(() => expect(patches).toEqual([{ trackingNumber: 'SF-CORRECT' }]));       // only the tracking number is sent, not "shipped" again
  });

  it('CRITICAL: once the hub has the parcel NOTHING can be clicked, the tracking number is read-only, and the portal explains where to go if there is a problem', async () => {
    await openOrder(order({ status: 'shipped', trackingNumber: 'SF-1', locked: true, lockReason: 'at_hub', allowedStatuses: [], canEditTracking: false, hubShipmentId: 55 }));
    for (const label of [PENDING, PREPARING, SHIPPED]) expect(statusButton(label)).toBeDisabled();
    expect(screen.getByPlaceholderText('请输入运单号')).toBeDisabled();
    expect(screen.queryByRole('button', { name: '标记已发货' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '更新运单号' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('此包裹已到达质检仓');
    expect(screen.getByRole('status')).toHaveTextContent('退货/售后');                          // where the fault case reply lives
    expect(screen.queryByText(/状态只能向前推进/)).not.toBeInTheDocument();                    // no "you can still..." hint when it is locked
  });

  it('a part the buyer cancelled is locked with its own message', async () => {
    await openOrder(order({ status: 'cancelled', locked: true, lockReason: 'cancelled', allowedStatuses: [], canEditTracking: false }));
    expect(screen.getByRole('status')).toHaveTextContent('买家已取消此部分订单');
    for (const label of [PENDING, PREPARING, SHIPPED]) expect(statusButton(label)).toBeDisabled();
  });

  it('there is no "dispute" button any more, and a reply without the new fields still behaves forward-only', async () => {
    const legacy = order({ status: 'preparing' });
    delete legacy.locked; delete legacy.allowedStatuses; delete legacy.canEditTracking; delete legacy.lockReason;
    await openOrder(legacy);
    expect(screen.queryByRole('button', { name: /异常\/纠纷|dispute/i })).not.toBeInTheDocument();
    expect(statusButton(PENDING)).toBeDisabled();
    expect(statusButton(SHIPPED)).toBeEnabled();
  });
});
