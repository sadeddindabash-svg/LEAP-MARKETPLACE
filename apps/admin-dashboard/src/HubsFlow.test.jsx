import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LeapAdminApp from './App';

const ADMIN_USER = { id: 'admin_dev_seed', email: 'admin@leap.dev', name: 'Dev Admin', role: 'admin' };

function mockFetchRouter() {
  let hubs = [{ id: 'hub_guangzhou', name: 'Guangzhou Inspection Hub', region: 'China (South)', address: 'Panyu District' }];
  return vi.fn((url, options) => {
    const u = String(url);
    const method = options?.method || 'GET';
    if (u.includes('/auth/login')) return Promise.resolve({ ok: true, json: async () => ({ token: 'fake.jwt.token', user: ADMIN_USER }) });
    if (u.includes('/auth/me')) return Promise.resolve({ ok: true, json: async () => ADMIN_USER });
    if (u.endsWith('/overview')) {
      return Promise.resolve({ ok: true, json: async () => ({ totalOrders: 0, activeSuppliers: 0, pendingSuppliers: 0, openDisputes: 0, pendingModeration: 0, openTickets: 0, ordersByDay: [], unitsByCategory: [], topSuppliers: [] }) });
    }
    if (method === 'POST' && u.endsWith('/hub/locations')) {
      const body = JSON.parse(options.body);
      const newHub = { id: 'hub_new', name: body.name, region: body.region, address: body.address };
      hubs = [...hubs, newHub];
      return Promise.resolve({ ok: true, status: 201, json: async () => newHub });
    }
    if (u.endsWith('/hub/locations')) return Promise.resolve({ ok: true, json: async () => hubs });
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
}

async function loginAndGoToHubs() {
  fireEvent.click(await screen.findByRole('button', { name: /log in/i }));
  await waitFor(() => screen.getByLabelText(/email/i));
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'admin@leap.dev' } });
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'admin_dev_password_123' } });
  fireEvent.click(screen.getByRole('button', { name: /log in/i }));
  await waitFor(() => expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: /^hubs$/i }));
}

beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('Hubs page — real hub location management (mocked fetch, real component tree)', () => {
  it('renders real seeded hubs', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAndGoToHubs();

    await waitFor(() => expect(screen.getByText('Guangzhou Inspection Hub')).toBeInTheDocument());
    expect(screen.getByText(/China \(South\)/)).toBeInTheDocument();
  });

  it('adding a new hub calls the real create endpoint and shows it immediately', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAndGoToHubs();

    await waitFor(() => screen.getByPlaceholderText(/hub name/i));
    fireEvent.change(screen.getByPlaceholderText(/hub name/i), { target: { value: 'Rotterdam Hub' } });
    fireEvent.change(screen.getByPlaceholderText(/region/i), { target: { value: 'Europe' } });
    fireEvent.click(screen.getByRole('button', { name: /add hub/i }));

    await waitFor(() => expect(screen.getByText('Rotterdam Hub')).toBeInTheDocument());
  });

  it('requires name and region before allowing submission', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAndGoToHubs();

    await waitFor(() => screen.getByRole('button', { name: /add hub/i }));
    fireEvent.click(screen.getByRole('button', { name: /add hub/i }));

    await waitFor(() => expect(screen.getByText(/name and region are required/i)).toBeInTheDocument());
  });
});
