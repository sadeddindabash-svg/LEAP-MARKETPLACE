import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import LeapSupplierPortalApp from './App';

// The Orders page of the supplier portal, through the real App (mocked backend, real component tree): the part's photo, an arrow, and the car the product belongs to. The portal opens in Chinese.
const SUPPLIER_USER = { id: 'supplier_dev_seed', email: 'supplier@leap.dev', name: 'Wei Zhang', role: 'supplier', supplierId: 's1' };
const PROFILE = { id: 's1', name: 'Guangzhou AutoParts Co.', country: 'China', contactEmail: 'wei@gz.cn', verificationStatus: 'verified', listingCount: 2, createdAt: '2026-07-01T00:00:00Z' };

const name = (en, zh) => ({ en, ar: null, zh });
const car = (over = {}) => ({ year: 2022, brand: name('BAIC', '北汽'), model: name('BJ60', 'BJ60'), engine: '2.0T', transmission: 'Automatic', photoUrl: '/uploads/car.png', ...over });
const vehicle = (cars, over = {}) => ({ partPhotoUrl: '/uploads/part.png', fitsAnyCar: cars.length === 0, carCount: cars.length, cars, ...over });
const item = (productId, productName, v) => ({ productId, name: productName, quantity: 1, unitPrice: 10, vehicle: v });
const order = (subOrderId, orderId, items) => ({ subOrderId, orderId, status: 'pending', trackingNumber: null, hubId: 'hub_gz', hubName: 'Guangzhou Hub', hubAddress: 'Panyu', hubShipmentId: null, placedAt: '2026-07-01T00:00:00Z', items,
  locked: false, lockReason: null, allowedStatuses: ['preparing', 'shipped'], canEditTracking: true });

function mockBackend(orders) {
  return vi.fn((url, options) => {
    const u = String(url), method = options?.method || 'GET';
    const ok = (body) => Promise.resolve({ ok: true, status: 200, json: async () => body });
    if (u.includes('/auth/login')) return ok({ token: 'fake.jwt.token', user: SUPPLIER_USER });
    if (u.includes('/auth/me')) return ok(SUPPLIER_USER);
    if (u.endsWith('/returns/supplier/me') || u.endsWith('/fault-cases/supplier/me')) return ok([]);
    if (u.endsWith('/supplier/me/overview')) return ok({ totalOrders: 0, pendingOrders: 0, totalListings: 0, pendingReturns: 0, ordersByDay: [], topProducts: [], recentOrders: [] });
    if (u.endsWith('/supplier/me/orders') && method === 'GET') return ok(orders);
    if (u.endsWith('/supplier/me')) return ok(PROFILE);
    return ok({});
  });
}
async function openOrdersPage(orders) {
  globalThis.fetch = mockBackend(orders);
  render(<LeapSupplierPortalApp />);
  await waitFor(() => screen.getByLabelText(/邮箱|email/i));
  fireEvent.change(screen.getByLabelText(/邮箱|email/i), { target: { value: 'supplier@leap.dev' } });
  fireEvent.change(screen.getByLabelText(/密码|password/i), { target: { value: 'supplier_dev_password_123' } });
  fireEvent.click(screen.getByRole('button', { name: /登录|log in/i }));
  await waitFor(() => expect(screen.getAllByText('Guangzhou AutoParts Co.')[0]).toBeInTheDocument());
  fireEvent.click(screen.getByText(/^(订单管理|Orders)$/));
}
beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('Supplier portal Orders page: the part and the car it belongs to', () => {
  it('the list shows, for the first item, the part photo, an arrow and the car; "+N more"; "fits any car"; and never anything about the buyer', async () => {
    await openOrdersPage([
      order(7001, 'LP-910100', [item('p1', 'Brake Pad Set', vehicle([car(), car({ year: 2019, brand: name('Toyota', '丰田'), model: name('Corolla', '卡罗拉'), photoUrl: null })])), item('p2', 'Oil Filter', vehicle([car({ year: 2018 })]))]),
      order(7002, 'LP-910200', [item('p3', 'Wiper Blade Set', vehicle([]))]),
      order(7003, 'LP-910300', [item('p4', 'Spark Plug', vehicle([car()], { carCount: 6 }))]),
    ]);
    const rowOf = async (id) => (await screen.findByText(id)).closest('tr');
    expect(await screen.findByRole('columnheader', { name: '零件 → 车辆' })).toBeInTheDocument();
    const r1 = within(await rowOf('LP-910100')); expect(r1.getByText(/北汽 BJ60 · 2022/)).toBeInTheDocument(); expect(r1.getByText(/另有2款/)).toBeInTheDocument();
    expect(r1.getAllByRole('img').map((i) => i.getAttribute('src'))).toEqual(['http://localhost:4000/uploads/part.png', 'http://localhost:4000/uploads/car.png']);
    const r2 = within(await rowOf('LP-910200')); expect(r2.getByText('通用件')).toBeInTheDocument(); expect(r2.getAllByRole('img')).toHaveLength(1);
    expect(within(await rowOf('LP-910300')).getByText(/另有5款/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/买家车辆|Buyer/);
  });

  it('the order detail shows, for each item, the part photo, an arrow, the car photo, its name and engine, and the other cars it is listed for', async () => {
    await openOrdersPage([order(7001, 'LP-910100', [
      item('p1', 'Brake Pad Set', vehicle([car(), car({ year: 2018, brand: name('Toyota', '丰田'), model: name('Corolla', '卡罗拉'), engine: null, transmission: null }), car({ year: 2019, brand: name('Honda', '本田'), model: name('Civic', '思域') })], { carCount: 4 })),
      item('p2', 'Wiper Blade Set', vehicle([])),
      item('p3', 'Item without photos', vehicle([car({ photoUrl: null })], { partPhotoUrl: null })),
    ])]);
    fireEvent.click(await screen.findByText('LP-910100'));
    await screen.findByText('Brake Pad Set');
    expect(screen.getAllByText('北汽 BJ60 · 2022').length).toBeGreaterThan(0); expect(screen.getAllByText('2.0T · Automatic').length).toBe(2);
    expect(screen.getByText(/同时适配： 丰田 卡罗拉 · 2018, 本田 思域 · 2019 另有1款/)).toBeInTheDocument();
    expect(screen.getAllByText('零件').length).toBe(3); expect(screen.getAllByText('适配此车型').length).toBe(2);
    expect(screen.getByText('通用件，适配任意车型')).toBeInTheDocument();
    const photos = screen.getAllByRole('img').map((i) => i.getAttribute('src'));
    expect(photos).toContain('http://localhost:4000/uploads/part.png'); expect(photos).toContain('http://localhost:4000/uploads/car.png');
    expect(document.body.textContent).not.toMatch(/买家车辆|Buyer/);
  });
});
