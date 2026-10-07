import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import LeapAdminApp from './App';

const ADMIN_USER = { id: 'admin_dev_seed', email: 'admin@leap.dev', name: 'Dev Admin', role: 'admin', isOwner: true, allowedPages: 'all' };

const ARABIC = { recipientName: 'محمد العتيبي', phone: '0551234567', country: 'السعودية', city: 'الرياض', streetAddress: 'شارع الملك فهد، حي العليا، مبنى رقم ١٢٣', postalCode: '12211', source: 'manual' };
const ENGLISH = { recipientName: 'Mohammed Al-Otaibi', country: 'Saudi Arabia', city: 'Riyadh', streetAddress: 'King Fahad Street, Al-Olaya District, Building No. 123', state: null, source: 'auto', confirmed: false, updatedAt: '2026-07-20T00:00:00Z' };

// Mocked backend: login, the global search that leads to the order page, the order itself, and the PUT that corrects the English address.
function mockBackend({ address = ARABIC, addressEnglish = ENGLISH, puts = [], putStatus = 200, putError } = {}) {
  return vi.fn((url, options) => {
    const u = String(url);
    const ok = (body) => Promise.resolve({ ok: true, status: 200, json: async () => body });
    if (u.includes('/auth/login')) return ok({ token: 'fake.jwt.token', user: ADMIN_USER });
    if (u.includes('/auth/me')) return ok(ADMIN_USER);
    if (u.includes('/admin/search')) return ok({ orders: [{ id: 'LP-200999', label: 'LP-200999', sublabel: 'USD 37.88 · to ship' }], suppliers: [], tickets: [] });
    if (u.includes('/hub/flagged')) return ok([]);
    if (u.endsWith('/order/LP-200999/address-english') && options?.method === 'PUT') {
      const body = JSON.parse(options.body);
      puts.push(body);
      if (putStatus !== 200) return Promise.resolve({ ok: false, status: putStatus, json: async () => ({ error: putError }) });
      return ok({ ...body, state: body.state || null, source: 'admin', confirmed: true, updatedAt: new Date().toISOString() });
    }
    if (u.endsWith('/order/LP-200999')) {
      return ok({ id: 'LP-200999', userId: 'u1', guestEmail: null, status: 'to_ship', displayStatus: 'to_ship', total: 37.88, currencyCode: 'USD', placedAt: '2026-07-14T00:00:00.000Z', supplierSubOrders: [], address, addressEnglish });
    }
    if (u.endsWith('/supplier')) return ok([]);
    if (u.endsWith('/overview')) return ok({ totalOrders: 1, activeSuppliers: 1, pendingSuppliers: 0, openDisputes: 0, pendingModeration: 0, openTickets: 0, ordersByDay: [], unitsByCategory: [], topSuppliers: [], recentOrders: [] });
    return ok({});
  });
}

async function openOrderPage(options) {
  globalThis.fetch = mockBackend(options);
  render(<LeapAdminApp />);
  fireEvent.click(await screen.findByRole('button', { name: /log in/i }));
  await waitFor(() => screen.getByLabelText(/email/i));
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'admin@leap.dev' } });
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'admin_dev_password_123' } });
  fireEvent.click(screen.getByRole('button', { name: /log in/i }));
  await waitFor(() => expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument());
  fireEvent.change(screen.getByPlaceholderText(/search orders, suppliers, tickets/i), { target: { value: 'LP-2009' } });
  fireEvent.click(await screen.findByText('LP-200999'));
  await screen.findByText('Delivery address');
}

const fieldIn = (panel, label) => within(panel).getByText(label).parentElement.querySelector('input, select');
const dialog = () => screen.getAllByText('English delivery address').map((el) => el.parentElement).find((el) => within(el).queryByRole('button', { name: /^save$/i }));

beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('Order page — the delivery address in Arabic AND English (mocked fetch, real component tree)', () => {
  it('CRITICAL: shows the address exactly as the buyer typed it AND the English version the inspection hub sees, with a warning that an automatic one is not confirmed', async () => {
    await openOrderPage();
    expect(screen.getByText('AS ENTERED BY THE BUYER')).toBeInTheDocument();
    expect(screen.getByText('محمد العتيبي')).toBeInTheDocument();
    expect(screen.getByText(/شارع الملك فهد/)).toBeInTheDocument();
    expect(screen.getByText('ENGLISH (WHAT THE INSPECTION HUB SEES)')).toBeInTheDocument();
    expect(screen.getByText('Mohammed Al-Otaibi')).toBeInTheDocument();
    expect(screen.getByText('King Fahad Street, Al-Olaya District, Building No. 123')).toBeInTheDocument();
    expect(screen.getByText(/Automatic translation, not yet confirmed by the buyer/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit English' })).toBeInTheDocument();
  });

  it('a confirmed or already-English address shows no warning', async () => {
    await openOrderPage({ addressEnglish: { ...ENGLISH, source: 'buyer', confirmed: true } });
    expect(await screen.findByText('Confirmed by the buyer')).toBeInTheDocument();
    expect(screen.queryByText(/Automatic translation/)).not.toBeInTheDocument();
  });

  it('an order with no delivery address says so, and offers nothing to edit', async () => {
    await openOrderPage({ address: null, addressEnglish: null });
    expect(await screen.findByText(/No delivery address yet/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit English' })).not.toBeInTheDocument();
  });

  it('CRITICAL: an admin can correct the English version: the dialog starts from the current text, sends exactly what was typed, and the card then says it was corrected', async () => {
    const puts = [];
    await openOrderPage({ puts });
    fireEvent.click(screen.getByRole('button', { name: 'Edit English' }));
    const panel = dialog();
    expect(fieldIn(panel, 'Recipient name').value).toBe('Mohammed Al-Otaibi');
    expect(fieldIn(panel, 'Street address').value).toBe('King Fahad Street, Al-Olaya District, Building No. 123');
    fireEvent.change(fieldIn(panel, 'Street address'), { target: { value: 'King Fahd Road, Olaya, Building 123' } });
    fireEvent.click(within(panel).getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]).toEqual({ recipientName: 'Mohammed Al-Otaibi', streetAddress: 'King Fahd Road, Olaya, Building 123', city: 'Riyadh', state: '', country: 'Saudi Arabia' });
    expect(await screen.findByText('King Fahd Road, Olaya, Building 123')).toBeInTheDocument();
    expect(screen.getByText('Corrected by an admin')).toBeInTheDocument();
    expect(screen.queryByText(/Automatic translation/)).not.toBeInTheDocument();
    expect(screen.getByText(/شارع الملك فهد/)).toBeInTheDocument(); // the buyer's original is still shown, untouched
  });

  it('a server refusal (e.g. Arabic letters in the English address) is shown in the dialog and the card is left as it was', async () => {
    await openOrderPage({ putStatus: 400, putError: 'The English address must be written in English letters (city contains Arabic).' });
    fireEvent.click(screen.getByRole('button', { name: 'Edit English' }));
    const panel = dialog();
    fireEvent.change(fieldIn(panel, 'City'), { target: { value: 'الرياض' } });
    fireEvent.click(within(panel).getByRole('button', { name: /^save$/i }));
    expect(await within(panel).findByText('The English address must be written in English letters (city contains Arabic).')).toBeInTheDocument();
    expect(screen.getByText(/Automatic translation/)).toBeInTheDocument(); // unchanged
  });
});
