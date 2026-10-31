import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import LeapAdminApp from './App';

const ADMIN_USER = { id: 'admin_dev_seed', email: 'admin@leap.dev', name: 'Dev Admin', role: 'admin', isOwner: true, allowedPages: 'all' };

const PROOF = {
  source: 'courier_link', verified: false,
  photos: [
    { url: '/uploads/proof-1.png', submittedAt: '2026-07-20T10:00:00Z', courierName: 'Omar the courier', note: 'Left with the doorman' },
    { url: '/uploads/proof-2.png', submittedAt: '2026-07-20T10:00:00Z', courierName: 'Omar the courier', note: 'Left with the doorman' },
  ],
};
const subOrder = (deliveryProof) => ({
  subOrderId: 7, supplierId: 's1', supplierName: 'Guangzhou AutoParts Co.', status: 'shipped', trackingNumber: 'SUP-1', hubTrackingNumber: 'HUB-9', hubId: 'hub_guangzhou', hubName: 'Guangzhou Inspection Hub',
  hubShipment: { id: 11, status: 'delivered', updatedAt: '2026-07-20T10:00:00Z', events: [], deliveryProof },
  items: [{ productId: 'p1', name: 'RIDEX Front Brake Disc', quantity: 1, unitPrice: 34.9, imageUrl: null }],
});

function mockBackend(deliveryProof) {
  return vi.fn((url) => {
    const u = String(url);
    const ok = (body) => Promise.resolve({ ok: true, status: 200, json: async () => body });
    if (u.includes('/auth/login')) return ok({ token: 'fake.jwt.token', user: ADMIN_USER });
    if (u.includes('/auth/me')) return ok(ADMIN_USER);
    if (u.includes('/admin/search')) return ok({ orders: [{ id: 'LP-200999', label: 'LP-200999', sublabel: 'USD 34.90 · delivered' }], suppliers: [], tickets: [] });
    if (u.includes('/hub/flagged')) return ok([]);
    if (u.endsWith('/order/LP-200999')) {
      return ok({ id: 'LP-200999', userId: 'u1', guestEmail: null, status: 'delivered', displayStatus: 'delivered', total: 34.9, currencyCode: 'USD', placedAt: '2026-07-14T00:00:00.000Z', supplierSubOrders: [subOrder(deliveryProof)], address: null, addressEnglish: null });
    }
    if (u.endsWith('/supplier')) return ok([]); // a LIST (the page maps over it); {} would crash the whole page
    if (u.endsWith('/overview')) return ok({ totalOrders: 1, activeSuppliers: 1, pendingSuppliers: 0, openDisputes: 0, pendingModeration: 0, openTickets: 0, ordersByDay: [], unitsByCategory: [], topSuppliers: [], recentOrders: [] });
    return ok({});
  });
}

async function openOrder(deliveryProof) {
  globalThis.fetch = mockBackend(deliveryProof);
  render(<LeapAdminApp />);
  fireEvent.click(await screen.findByRole('button', { name: /log in/i }));
  await waitFor(() => screen.getByLabelText(/email/i));
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'admin@leap.dev' } });
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'admin_dev_password_123' } });
  fireEvent.click(screen.getByRole('button', { name: /log in/i }));
  await waitFor(() => expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument());
  fireEvent.change(screen.getByPlaceholderText(/search orders, suppliers, tickets/i), { target: { value: 'LP-2009' } });
  fireEvent.click(await screen.findByText('LP-200999'));
  await screen.findByText('Guangzhou Inspection Hub');
}

beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('Order page — proof of delivery from the courier\'s link (mocked fetch, real component tree)', () => {
  it('CRITICAL: shows the courier\'s photos, who sent them and their note, and says plainly that they are NOT verified', async () => {
    await openOrder(PROOF);
    expect(screen.getByText(/PROOF OF DELIVERY/)).toBeInTheDocument();
    expect(screen.getByText(/sent through the courier's link, not verified/)).toBeInTheDocument();
    const box = screen.getByText(/PROOF OF DELIVERY/).parentElement;
    const photos = within(box).getAllByRole('button'); // each thumbnail is an image that opens full size
    expect(photos).toHaveLength(2);
    expect(photos[0].getAttribute('src')).toContain('/uploads/proof-1.png');
    expect(within(box).getByText('Courier: Omar the courier')).toBeInTheDocument();
    expect(within(box).getByText('Note: Left with the doorman')).toBeInTheDocument();   // listed once even though both photos carry it
    expect(within(box).getByText(/^Sent /)).toBeInTheDocument();
  });

  it('a photo opens full size when clicked', async () => {
    await openOrder(PROOF);
    const box = screen.getByText(/PROOF OF DELIVERY/).parentElement;
    fireEvent.click(within(box).getAllByRole('button')[0]);
    const viewer = await screen.findByRole('dialog', { name: 'Photo' });
    expect(within(viewer).getAllByRole('img').some((img) => (img.getAttribute('src') || '').includes('/uploads/proof-1.png'))).toBe(true);
  });

  it('a parcel with no courier proof shows no such block (and no empty box)', async () => {
    await openOrder(null);
    expect(screen.queryByText(/PROOF OF DELIVERY/)).not.toBeInTheDocument();
  });

  it('a proof without a courier name or note still shows its photos, with nothing blank in their place', async () => {
    await openOrder({ source: 'courier_link', verified: false, photos: [{ url: '/uploads/proof-3.png', submittedAt: '2026-07-20T10:00:00Z', courierName: null, note: null }] });
    const box = screen.getByText(/PROOF OF DELIVERY/).parentElement;
    expect(within(box).getAllByRole('button')).toHaveLength(1);
    expect(within(box).queryByText(/^Courier:/)).not.toBeInTheDocument();
    expect(within(box).queryByText(/^Note:/)).not.toBeInTheDocument();
  });
});
