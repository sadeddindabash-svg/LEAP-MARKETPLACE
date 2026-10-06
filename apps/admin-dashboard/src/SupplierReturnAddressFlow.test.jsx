import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import LeapAdminApp from './App';

const ADMIN_USER = { id: 'admin_dev_seed', email: 'admin@leap.dev', name: 'Dev Admin', role: 'admin', isOwner: true, allowedPages: 'all' };
const SUPPLIER = { id: 's1', name: 'Guangzhou AutoParts Co.', country: 'China', countryAr: '', contactEmail: 'wei@gz.cn', verificationStatus: 'verified', listingCount: 0, createdAt: '2025-11-02T00:00:00Z' };
const ADDRESS = { contactName: 'Wang Fang', phone: '+86 20 8888 1234', address: 'Building 3, 88 Huangpu Avenue, Tianhe District, Guangzhou 510000', updatedAt: '2026-07-20T00:00:00Z' };

// Mocked backend: the suppliers list, one supplier's detail, and that supplier's return address (GET + PUT).
function mockBackend({ initial = null, puts = [], putStatus = 200, putError } = {}) {
  let current = initial;
  return vi.fn((url, options) => {
    const u = String(url);
    const method = options?.method || 'GET';
    const ok = (body) => Promise.resolve({ ok: true, status: 200, json: async () => body });
    if (u.includes('/auth/login')) return ok({ token: 'fake.jwt.token', user: ADMIN_USER });
    if (u.includes('/auth/me')) return ok(ADMIN_USER);
    // the return-address route ends in '/return-address', so it is matched before the generic supplier routes
    if (u.endsWith('/supplier/s1/return-address')) {
      if (method === 'PUT') {
        const body = JSON.parse(options.body);
        puts.push(body);
        if (putStatus !== 200) return Promise.resolve({ ok: false, status: putStatus, json: async () => ({ error: putError }) });
        current = { ...body, updatedAt: new Date().toISOString() };
        return ok(current);
      }
      return ok(current);
    }
    if (u.endsWith('/supplier/s1')) return ok({ ...SUPPLIER, products: [] });
    if (u.endsWith('/supplier')) return ok([SUPPLIER]);
    if (u.endsWith('/overview')) return ok({ totalOrders: 0, activeSuppliers: 0, pendingSuppliers: 0, openDisputes: 0, pendingModeration: 0, openTickets: 0, ordersByDay: [], unitsByCategory: [], topSuppliers: [], recentOrders: [] });
    return ok({});
  });
}

async function openSupplierPage(options) {
  globalThis.fetch = mockBackend(options);
  render(<LeapAdminApp />);
  fireEvent.click(await screen.findByRole('button', { name: /log in/i }));
  await waitFor(() => screen.getByLabelText(/email/i));
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'admin@leap.dev' } });
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'admin_dev_password_123' } });
  fireEvent.click(screen.getByRole('button', { name: /log in/i }));
  await waitFor(() => expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: /suppliers/i }));
  fireEvent.click(await screen.findByText('Guangzhou AutoParts Co.'));
  await screen.findByText('Return address');
}

const fieldIn = (panel, label) => within(panel).getByText(label).parentElement.querySelector('input, select');
const dialog = () => screen.getAllByText('Return address').map((el) => el.parentElement).find((el) => within(el).queryByRole('button', { name: /^save$/i }));

beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe("Supplier page — the supplier's return address (mocked fetch, real component tree)", () => {
  it('CRITICAL: with no address it says the hub will not know where to send a faulty unit, and offers "Add"', async () => {
    await openSupplierPage({ initial: null });
    expect(await screen.findByText(/Not entered yet — the inspection hub will not know where to send a faulty unit back/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
  });

  it('shows an address on file in full, with "Edit"', async () => {
    await openSupplierPage({ initial: ADDRESS });
    expect(await screen.findByText('Wang Fang')).toBeInTheDocument();
    expect(screen.getByText('+86 20 8888 1234')).toBeInTheDocument();
    expect(screen.getByText(/88 Huangpu Avenue/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.queryByText(/Not entered yet/)).not.toBeInTheDocument();
  });

  it('CRITICAL: an admin can add an address for a supplier; it is sent as typed and then shown', async () => {
    const puts = [];
    await openSupplierPage({ initial: null, puts });
    fireEvent.click(await screen.findByRole('button', { name: 'Add' }));
    const panel = dialog();
    fireEvent.change(fieldIn(panel, 'Contact name'), { target: { value: 'Li Wei' } });
    fireEvent.change(fieldIn(panel, 'Phone number'), { target: { value: '020-8888-9999' } });
    fireEvent.change(fieldIn(panel, 'Full address'), { target: { value: 'Unit 12, Industrial Road 5, Longgang, Shenzhen 518100' } });
    fireEvent.click(within(panel).getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]).toEqual({ contactName: 'Li Wei', phone: '020-8888-9999', address: 'Unit 12, Industrial Road 5, Longgang, Shenzhen 518100' });
    expect(await screen.findByText('Li Wei')).toBeInTheDocument();
    expect(screen.queryByText(/Not entered yet/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });

  it('editing starts from what is on file', async () => {
    await openSupplierPage({ initial: ADDRESS });
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    const panel = dialog();
    expect(fieldIn(panel, 'Contact name').value).toBe('Wang Fang');
    expect(fieldIn(panel, 'Phone number').value).toBe('+86 20 8888 1234');
    expect(fieldIn(panel, 'Full address').value).toContain('Huangpu Avenue');
  });

  it('a server refusal is shown inside the dialog and the card is left unchanged', async () => {
    await openSupplierPage({ initial: ADDRESS, putStatus: 400, putError: 'Phone number may only contain digits, spaces and + - ( ) .' });
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    const panel = dialog();
    fireEvent.change(fieldIn(panel, 'Phone number'), { target: { value: 'call me' } });
    fireEvent.click(within(panel).getByRole('button', { name: /^save$/i }));
    expect(await within(panel).findByText('Phone number may only contain digits, spaces and + - ( ) .')).toBeInTheDocument();
    expect(screen.getAllByText('+86 20 8888 1234').length).toBeGreaterThan(0); // the saved value is still the old one
  });
});
