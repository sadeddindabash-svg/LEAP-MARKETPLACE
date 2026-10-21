import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import LeapSupplierPortalApp from './App';

// The Orders page of the supplier portal, through the real App (mocked backend, real component tree): the new Car column in the list and the car under each item in the order detail.
// The portal opens in Chinese; the English wording is covered in OrderVehicle.test.jsx.
const SUPPLIER_USER = { id: 'supplier_dev_seed', email: 'supplier@leap.dev', name: 'Wei Zhang', role: 'supplier', supplierId: 's1' };
const PROFILE = { id: 's1', name: 'Guangzhou AutoParts Co.', country: 'China', contactEmail: 'wei@gz.cn', verificationStatus: 'verified', listingCount: 2, createdAt: '2026-07-01T00:00:00Z' };

const name = (en, zh) => ({ en, ar: null, zh });
const car = (over = {}) => ({ year: 2022, seats: 5, photoUrl: '/uploads/ver.png', brand: name('BAIC', '北汽'), model: name('BJ60', 'BJ60'), version: name('May Day', '五一'), engine: name('2.0T (190 kW)', '2.0T (190 kW)'), ...over });
const listed = (over) => ({ status: 'listed', isDefaultCar: true, car: car(over) });
const item = (productId, productName, vehicle) => ({ productId, name: productName, quantity: 1, unitPrice: 10, vehicle });
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

describe('Supplier portal Orders page: the car each part is for', () => {
  it('the list has a Car column with the first car, its photo, "+N" for more, and a warning mark when a car is not on a fitment list', async () => {
    await openOrdersPage([
      order(7001, 'LP-910100', [item('p1', 'Brake Pad Set', listed()), item('p2', 'Oil Filter', { status: 'listed', isDefaultCar: false, car: car({ year: 2018, brand: name('Toyota', '丰田'), model: name('Corolla', '卡罗拉'), photoUrl: null }) })]),
      order(7002, 'LP-910200', [item('p3', 'Brake Disc', { status: 'not_listed', isDefaultCar: true, car: car({ year: 2021 }) })]),
      order(7003, 'LP-910300', [item('p4', 'Wiper Blade Set', { status: 'universal', isDefaultCar: null, car: null })]),
      order(7004, 'LP-910400', [item('p5', 'Spark Plug', { status: 'no_car', isDefaultCar: null, car: null })]),
      order(7005, 'LP-910500', [item('p6', 'Old order item', null)]),
    ]);
    const rowOf = async (id) => (await screen.findByText(id)).closest('tr');
    expect(await screen.findByRole('columnheader', { name: '车辆' })).toBeInTheDocument();
    const r1 = within(await rowOf('LP-910100')); expect(r1.getByText(/北汽 BJ60 · 2022/)).toBeInTheDocument(); expect(r1.getByText(/另有1辆/)).toBeInTheDocument();
    expect(r1.getByRole('img')).toHaveAttribute('src', 'http://localhost:4000/uploads/ver.png');
    const r2 = within(await rowOf('LP-910200')); expect(r2.getByText(/北汽 BJ60 · 2021/)).toBeInTheDocument(); expect(r2.getByText(/请核对/)).toBeInTheDocument();
    expect(within(await rowOf('LP-910300')).getByText('通用件')).toBeInTheDocument();
    expect(within(await rowOf('LP-910400')).getByText('无车辆信息')).toBeInTheDocument();
    expect(within(await rowOf('LP-910500')).getByText('—')).toBeInTheDocument();
  });

  it('the order detail shows, under each item, the car (names, year, version, engine, seats), its photo and the fit check', async () => {
    await openOrdersPage([order(7001, 'LP-910100', [
      item('p1', 'Brake Pad Set', listed()),
      item('p2', 'Brake Disc', { status: 'not_listed', isDefaultCar: true, car: car({ year: 2021, photoUrl: null }) }),
      item('p3', 'Wiper Blade Set', { status: 'universal', isDefaultCar: null, car: null }),
      item('p4', 'Spark Plug', { status: 'no_car', isDefaultCar: null, car: null }),
      item('p5', 'Old order item', null),
    ])]);
    fireEvent.click(await screen.findByText('LP-910100'));
    await screen.findByText('Brake Pad Set');
    expect(screen.getAllByText(/买家车辆:/, { selector: 'div' })).toHaveLength(2);                // the two items that have a car
    expect(screen.getAllByText(/北汽 BJ60 · 2022/).length).toBeGreaterThan(0); expect(screen.getAllByText('五一 · 2.0T (190 kW) · 5座')).toHaveLength(2);
    expect(screen.getByRole('img', { name: /北汽 BJ60 · 2022/ })).toHaveAttribute('src', 'http://localhost:4000/uploads/ver.png');
    expect(screen.getByText('该商品适配此车型')).toBeInTheDocument();
    expect(screen.getByText('该商品的适配列表中没有此车型，发货前请核对')).toBeInTheDocument();
    expect(screen.getByText('通用件，适配任意车型，未记录车辆')).toBeInTheDocument();
    expect(screen.getByText('无车辆信息：买家的车库中没有车辆')).toBeInTheDocument();
    expect(screen.getByText('Old order item')).toBeInTheDocument();
  });
});
