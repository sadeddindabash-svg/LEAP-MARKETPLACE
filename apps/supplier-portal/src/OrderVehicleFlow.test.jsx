import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import LeapSupplierPortalApp from './App';

// The Orders page of the supplier portal, through the real App (mocked backend, real component tree): the part's photo, an arrow, and the car the product belongs to. The portal opens in Chinese.
const SUPPLIER_USER = { id: 'supplier_dev_seed', email: 'supplier@leap.dev', name: 'Wei Zhang', role: 'supplier', supplierId: 's1' };
const PROFILE = { id: 's1', name: 'Guangzhou AutoParts Co.', country: 'China', contactEmail: 'wei@gz.cn', verificationStatus: 'verified', listingCount: 2, createdAt: '2026-07-01T00:00:00Z' };

const name = (en, zh) => ({ en, ar: null, zh });
const GEN = { name: 'Gen One', yearStart: 2020, yearEnd: null, versionCount: 3 };
const ver = (id, en, zh) => ({ id, name: name(en, zh), engine: '2 motors', seats: 5 });
const car = (over = {}) => ({ generation: GEN, versions: null, year: 2022, brand: name('BAIC', '北汽'), model: name('BJ60', 'BJ60'), engine: '2.0T', transmission: 'Automatic', photoUrl: '/uploads/car.png', ...over });
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


describe('Supplier portal Orders page: the part and the car it belongs to, in full', () => {
  it('the list shows each item\'s car (the first two items), "+N more items", "fits any car", the versions, and never anything about the buyer', async () => {
    await openOrdersPage([
      order(7001, 'LP-910100', [item('p1', 'Brake Pad Set', vehicle([car(), car({ year: 2019, brand: name('Toyota', '\u4e30\u7530'), model: name('Corolla', '\u5361\u7f57\u62c9'), photoUrl: null })])), item('p2', 'Oil Filter', vehicle([car({ year: 2018 })]))]),
      order(7002, 'LP-910200', [item('p3', 'Wiper Blade Set', vehicle([]))]),
      order(7003, 'LP-910300', [item('p4', 'Spark Plug', vehicle([car()], { carCount: 6 }))]),
      order(7004, 'LP-910400', [item('p5', 'Disc A', vehicle([car({ versions: [ver('v2', 'Performance AWD', '\u6027\u80fd\u56db\u9a71'), ver('v3', 'Excellence AWD', '\u65d7\u8230\u56db\u9a71')] })])), item('p6', 'Disc B', vehicle([car({ year: 2021 })])), item('p7', 'Disc C', vehicle([car({ year: 2020 })]))]),
    ]);
    const rowOf = async (id) => (await screen.findByText(id)).closest('tr');
    expect(await screen.findByRole('columnheader', { name: '\u96f6\u4ef6 \u2192 \u8f66\u8f86' })).toBeInTheDocument();
    const r1 = within(await rowOf('LP-910100')); const cells1 = r1.getAllByTestId('ordercell-item'); expect(cells1).toHaveLength(2); expect(cells1[0]).toHaveTextContent('\u5317\u6c7d BJ60 \u00b7 2022'); expect(cells1[0]).toHaveTextContent('\uff08\u53e6\u67091\u6b3e\uff09'); expect(cells1[1]).toHaveTextContent('\u5317\u6c7d BJ60 \u00b7 2018'); expect(cells1[0]).toHaveTextContent('\u6240\u6709\u7248\u672c');
    expect(cells1[0].closest('td').style.minWidth).toBe('300px');      // the car column is wide enough for the details
    expect(r1.getAllByRole('img').map((i) => i.getAttribute('src'))).toEqual(['http://localhost:4000/uploads/part.png', 'http://localhost:4000/uploads/car.png', 'http://localhost:4000/uploads/part.png', 'http://localhost:4000/uploads/car.png']);
    const r2 = within(await rowOf('LP-910200')); expect(r2.getByText('Wiper Blade Set\uff1a\u901a\u7528\u4ef6\uff0c\u9002\u914d\u4efb\u610f\u8f66\u578b')).toBeInTheDocument(); expect(r2.getAllByRole('img')).toHaveLength(1);
    expect(within(await rowOf('LP-910300')).getByText(/\uff08\u53e6\u67095\u6b3e\uff09/)).toBeInTheDocument();
    const r4 = within(await rowOf('LP-910400')); expect(r4.getAllByTestId('ordercell-item')).toHaveLength(2); expect(r4.getByTestId('version-tag-some')).toHaveTextContent('3\u4e2a\u7248\u672c\u4e2d\u7684' + '2\u4e2a'); expect(r4.getByText(/\u6027\u80fd\u56db\u9a71, \u65d7\u8230\u56db\u9a71/)).toBeInTheDocument(); expect(r4.getByText('\u53e6\u67091\u4ef6\u5546\u54c1')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\u4e70\u5bb6\u8f66\u8f86|Buyer/);
  });

  it('the order detail shows, for each item, the part photo, an arrow, the car photo and the car in full (brand, model, generation, year, engine, transmission, versions), and the other cars it is listed for', async () => {
    await openOrdersPage([order(7001, 'LP-910100', [
      item('p1', 'Brake Pad Set', vehicle([car(), car({ year: 2018, brand: name('Toyota', '\u4e30\u7530'), model: name('Corolla', '\u5361\u7f57\u62c9'), engine: null, transmission: null }), car({ year: 2019, brand: name('Honda', '\u672c\u7530'), model: name('Civic', '\u601d\u57df') })], { carCount: 4 })),
      item('p2', 'Wiper Blade Set', vehicle([])),
      item('p3', 'Item without photos', vehicle([car({ photoUrl: null })], { partPhotoUrl: null })),
      item('p4', 'Disc narrowed', vehicle([car({ year: 2023, versions: [ver('v2', 'Performance AWD', '\u6027\u80fd\u56db\u9a71')] })])),
    ])]);
    fireEvent.click(await screen.findByText('LP-910100'));
    await screen.findByText('Brake Pad Set');
    expect(screen.getAllByText('\u5317\u6c7d BJ60 \u00b7 2022').length).toBeGreaterThan(0); expect(screen.getAllByText('2.0T').length).toBe(3); expect(screen.getAllByText('Automatic').length).toBe(3);
    expect(screen.getAllByText('2020 \u2013 \u81f3\u4eca').length).toBeGreaterThan(0);
    expect(screen.getByText(/\u540c\u65f6\u9002\u914d\uff1a \u4e30\u7530 \u5361\u7f57\u62c9 \u00b7 2018, \u672c\u7530 \u601d\u57df \u00b7 2019 \u53e6\u67091\u6b3e/)).toBeInTheDocument();
    expect(screen.getAllByText('\u96f6\u4ef6').length).toBe(4); expect(screen.getAllByText('\u9002\u914d\u6b64\u8f66\u578b').length).toBe(3);
    expect(screen.getByText('\u901a\u7528\u4ef6\uff0c\u9002\u914d\u4efb\u610f\u8f66\u578b')).toBeInTheDocument();
    expect(screen.getAllByTestId('version-tag-all').length).toBe(2); expect(screen.getAllByTestId('version-tag-some')).toHaveLength(1); expect(screen.getByTestId('version-chip-v2')).toHaveTextContent('\u6027\u80fd\u56db\u9a71'); expect(screen.getByTestId('version-warning')).toHaveTextContent('\u8bf7\u6838\u5bf9\u7248\u672c');
    const photos = screen.getAllByRole('img').map((i) => i.getAttribute('src'));
    expect(photos).toContain('http://localhost:4000/uploads/part.png'); expect(photos).toContain('http://localhost:4000/uploads/car.png');
    expect(document.body.textContent).not.toMatch(/\u4e70\u5bb6\u8f66\u8f86|Buyer/);
  });
});
