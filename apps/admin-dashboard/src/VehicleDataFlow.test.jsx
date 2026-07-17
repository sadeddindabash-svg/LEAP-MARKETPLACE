import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LeapAdminApp from './App';

const ADMIN_USER = { id: 'admin_dev_seed', email: 'admin@leap.dev', name: 'Dev Admin', role: 'admin', isOwner: true, allowedPages: 'all' };

function mockFetchRouter() {
  let brands = [{ id: 'brand_bmw', name: 'BMW' }];
  const modelsByBrand = { brand_bmw: [{ id: 'model_1', brandId: 'brand_bmw', name: '1 Series' }] };
  const gensByModel = { model_1: [{ id: 'gen_f20', modelId: 'model_1', name: 'F20', yearStart: 2015, yearEnd: 2019 }] };
  const enginesByGen = { gen_f20: [{ id: 'eng_1', generationId: 'gen_f20', name: '118d 2.0D' }] };
  const transByGen = { gen_f20: [{ id: 'trans_1', generationId: 'gen_f20', name: '6-Speed Manual' }] };

  return vi.fn((url, options) => {
    const u = String(url);
    const method = options?.method || 'GET';
    if (u.includes('/auth/login')) return Promise.resolve({ ok: true, json: async () => ({ token: 'fake.jwt.token', user: ADMIN_USER }) });
    if (u.includes('/auth/me')) return Promise.resolve({ ok: true, json: async () => ADMIN_USER });
    if (u.endsWith('/overview')) {
      return Promise.resolve({ ok: true, json: async () => ({ totalOrders: 0, activeSuppliers: 0, pendingSuppliers: 0, openDisputes: 0, pendingModeration: 0, openTickets: 0, ordersByDay: [], unitsByCategory: [], topSuppliers: [] }) });
    }
    if (method === 'POST' && u.endsWith('/fitment/brands')) {
      const body = JSON.parse(options.body);
      const newBrand = { id: 'brand_new', name: body.name };
      brands = [...brands, newBrand];
      return Promise.resolve({ ok: true, status: 201, json: async () => newBrand });
    }
    if (u.endsWith('/fitment/brands')) return Promise.resolve({ ok: true, json: async () => brands });
    if (u.match(/\/fitment\/brands\/brand_bmw\/models$/)) return Promise.resolve({ ok: true, json: async () => modelsByBrand.brand_bmw });
    if (u.match(/\/fitment\/models\/model_1\/generations$/)) return Promise.resolve({ ok: true, json: async () => gensByModel.model_1 });
    if (u.match(/\/fitment\/generations\/gen_f20\/engines$/)) return Promise.resolve({ ok: true, json: async () => enginesByGen.gen_f20 });
    if (u.match(/\/fitment\/generations\/gen_f20\/transmissions$/)) return Promise.resolve({ ok: true, json: async () => transByGen.gen_f20 });
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
}

async function loginAndGoToVehicleData() {
  fireEvent.click(await screen.findByRole('button', { name: /log in/i }));
  await waitFor(() => screen.getByLabelText(/email/i));
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'admin@leap.dev' } });
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'admin_dev_password_123' } });
  fireEvent.click(screen.getByRole('button', { name: /log in/i }));
  await waitFor(() => expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: /vehicle data/i }));
}

beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('Vehicle Data page — real fitment cascade management (mocked fetch, real component tree)', () => {
  it('renders real brands and drills down through Model -> Generation -> Engines/Transmissions', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAndGoToVehicleData();

    await waitFor(() => expect(screen.getByText('BMW')).toBeInTheDocument());
    fireEvent.click(screen.getByText('BMW'));

    await waitFor(() => expect(screen.getByText('1 Series')).toBeInTheDocument());
    fireEvent.click(screen.getByText('1 Series'));

    await waitFor(() => expect(screen.getByText('F20')).toBeInTheDocument());
    fireEvent.click(screen.getByText('F20'));

    await waitFor(() => expect(screen.getByText('118d 2.0D')).toBeInTheDocument());
    expect(screen.getByText('6-Speed Manual')).toBeInTheDocument();
  });

  it('the breadcrumb lets you navigate back up the cascade', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAndGoToVehicleData();

    fireEvent.click(await screen.findByText('BMW'));
    await waitFor(() => screen.getByText('1 Series'));

    // Click the "Brands" breadcrumb to go back up.
    fireEvent.click(screen.getByText('Brands'));
    await waitFor(() => expect(screen.queryByText('1 Series')).not.toBeInTheDocument());
  });

  it('adding a new brand calls the real create endpoint and shows it in the list', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAndGoToVehicleData();

    await waitFor(() => screen.getByPlaceholderText(/new brand name/i));
    fireEvent.change(screen.getByPlaceholderText(/new brand name/i), { target: { value: 'Nissan' } });
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));

    await waitFor(() => expect(screen.getByText('Nissan')).toBeInTheDocument());
  });
});
