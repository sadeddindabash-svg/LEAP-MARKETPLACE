import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LeapSupplierPortalApp from './App';

const SUPPLIER_USER = { id: 'supplier_dev_seed', email: 'supplier@leap.dev', name: 'Wei Zhang', role: 'supplier', supplierId: 's1' };
const PROFILE = { id: 's1', name: 'Guangzhou AutoParts Co.', country: 'China', contactEmail: 'wei@gz.cn', verificationStatus: 'verified', listingCount: 2, createdAt: '2026-07-01T00:00:00Z' };
const ADDRESS = { contactName: 'Wang Fang', phone: '+86 20 8888 1234', address: 'Building 3, 88 Huangpu Avenue, Tianhe District, Guangzhou 510000', updatedAt: '2026-07-20T00:00:00Z' };

// Mocked backend. `initial` is what GET /supplier/me/return-address returns (null = nothing entered yet); every PUT is recorded.
function mockBackend({ initial = null, puts = [], putStatus = 200, putError } = {}) {
  let current = initial;
  return vi.fn((url, options) => {
    const u = String(url);
    const method = options?.method || 'GET';
    const ok = (body, status = 200) => Promise.resolve({ ok: true, status, json: async () => body });
    if (u.includes('/auth/login')) return ok({ token: 'fake.jwt.token', user: SUPPLIER_USER });
    if (u.includes('/auth/me')) return ok(SUPPLIER_USER);
    if (u.endsWith('/supplier/me/return-address')) {
      if (method === 'PUT') {
        const body = JSON.parse(options.body);
        puts.push(body);
        if (putStatus !== 200) return Promise.resolve({ ok: false, status: putStatus, json: async () => ({ error: putError }) });
        current = { ...body, updatedAt: new Date().toISOString() };
        return ok(current);
      }
      return ok(current);
    }
    if (u.endsWith('/supplier/me')) return ok(PROFILE);
    if (u.endsWith('/supplier/me/overview')) return ok({ totalOrders: 0, pendingOrders: 0, totalListings: 0, pendingReturns: 0, ordersByDay: [], topProducts: [], recentOrders: [] });
    return ok({});
  });
}

async function openSettings(options) {
  globalThis.fetch = mockBackend(options);
  render(<LeapSupplierPortalApp />);
  await waitFor(() => screen.getByLabelText(/邮箱|email/i));
  fireEvent.change(screen.getByLabelText(/邮箱|email/i), { target: { value: 'supplier@leap.dev' } });
  fireEvent.change(screen.getByLabelText(/密码|password/i), { target: { value: 'supplier_dev_password_123' } });
  fireEvent.click(screen.getByRole('button', { name: /登录|log in/i }));
  await waitFor(() => expect(screen.getAllByText('Guangzhou AutoParts Co.')[0]).toBeInTheDocument());
  fireEvent.click(screen.getByText(/^(店铺设置|Settings)$/));
  await screen.findByText('退货地址');
}

beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('Supplier Settings — return address (mocked fetch, real component tree)', () => {
  it('CRITICAL: with nothing entered yet it says the hub will not know where to send a faulty item, and shows an empty form', async () => {
    await openSettings({ initial: null });
    expect(await screen.findByText(/尚未填写——质检仓将不知道把问题商品寄到哪里/)).toBeInTheDocument();
    expect(screen.getByLabelText('联系人').value).toBe('');
    expect(screen.getByLabelText('详细地址').value).toBe('');
  });

  it('an address already on file is shown, with no warning', async () => {
    await openSettings({ initial: ADDRESS });
    await waitFor(() => expect(screen.getByLabelText('联系人').value).toBe('Wang Fang'));
    expect(screen.getByLabelText('联系电话').value).toBe('+86 20 8888 1234');
    expect(screen.getByLabelText('详细地址').value).toContain('Huangpu Avenue');
    expect(screen.queryByText(/尚未填写/)).not.toBeInTheDocument();
  });

  it('CRITICAL: all three fields are required (nothing is sent without them); then it sends them and confirms "Saved"', async () => {
    const puts = [];
    await openSettings({ initial: null, puts });
    await screen.findByText(/尚未填写/);

    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(await screen.findByText('请填写联系人、联系电话和详细地址。')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('联系人'), { target: { value: 'Wang Fang' } });
    fireEvent.change(screen.getByLabelText('联系电话'), { target: { value: '+86 20 8888 1234' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' })); // address still empty
    expect(await screen.findByText('请填写联系人、联系电话和详细地址。')).toBeInTheDocument();
    expect(puts).toHaveLength(0);

    fireEvent.change(screen.getByLabelText('详细地址'), { target: { value: ADDRESS.address } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]).toEqual({ contactName: 'Wang Fang', phone: '+86 20 8888 1234', address: ADDRESS.address });
    expect(await screen.findByText('已保存')).toBeInTheDocument();
    expect(screen.queryByText('请填写联系人、联系电话和详细地址。')).not.toBeInTheDocument();
  });

  it('editing after a save removes the "Saved" tick, so it never claims unsaved changes are saved', async () => {
    await openSettings({ initial: ADDRESS });
    await waitFor(() => expect(screen.getByLabelText('联系人').value).toBe('Wang Fang'));
    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(await screen.findByText('已保存')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('联系电话'), { target: { value: '+86 20 0000 0000' } });
    expect(screen.queryByText('已保存')).not.toBeInTheDocument();
  });

  it('a server refusal (e.g. a bad phone number) is shown, and nothing is claimed as saved', async () => {
    await openSettings({ initial: ADDRESS, putStatus: 400, putError: 'Phone number may only contain digits, spaces and + - ( ) .' });
    await waitFor(() => expect(screen.getByLabelText('联系人').value).toBe('Wang Fang'));
    fireEvent.change(screen.getByLabelText('联系电话'), { target: { value: 'call me' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(await screen.findByText('Phone number may only contain digits, spaces and + - ( ) .')).toBeInTheDocument();
    expect(screen.queryByText('已保存')).not.toBeInTheDocument();
  });
});
