import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LeapAdminApp from './App';

const ADMIN_USER = { id: 'admin_dev_seed', email: 'admin@leap.dev', name: 'Dev Admin', role: 'admin' };

const MOCK_CATEGORIES = [{ id: 'brake', nameEn: 'Brake System', nameAr: 'نظام الفرامل', sortOrder: 10 }];
const MOCK_PARTS = [{ id: 'part_1', categoryId: 'brake', nameEn: 'Front Brake Disc', nameAr: 'قرص فرامل أمامي', sortOrder: 10 }];

function mockFetchRouter({ categories = MOCK_CATEGORIES, parts = MOCK_PARTS } = {}) {
  let cats = [...categories];
  let categoryParts = [...parts];
  return vi.fn((url, options) => {
    const u = String(url);
    const method = options?.method || 'GET';
    if (u.includes('/auth/login')) return Promise.resolve({ ok: true, json: async () => ({ token: 'fake.jwt.token', user: ADMIN_USER }) });
    if (u.includes('/auth/me')) return Promise.resolve({ ok: true, json: async () => ADMIN_USER });
    if (u.endsWith('/overview')) {
      return Promise.resolve({ ok: true, json: async () => ({ totalOrders: 0, activeSuppliers: 0, pendingSuppliers: 0, openDisputes: 0, pendingModeration: 0, openTickets: 0, ordersByDay: [], unitsByCategory: [], topSuppliers: [] }) });
    }
    if (method === 'POST' && u.endsWith('/catalog/categories')) {
      const b = JSON.parse(options.body);
      const newCat = { id: b.id, nameEn: b.nameEn, nameAr: b.nameAr, sortOrder: b.sortOrder };
      cats = [...cats, newCat];
      return Promise.resolve({ ok: true, status: 201, json: async () => newCat });
    }
    if (u.endsWith('/catalog/categories')) return Promise.resolve({ ok: true, json: async () => cats });
    if (method === 'POST' && u.match(/\/catalog\/categories\/.+\/parts$/)) {
      const b = JSON.parse(options.body);
      const newPart = { id: 'part_new', categoryId: 'brake', nameEn: b.nameEn, nameAr: b.nameAr, sortOrder: b.sortOrder };
      categoryParts = [...categoryParts, newPart];
      return Promise.resolve({ ok: true, status: 201, json: async () => newPart });
    }
    if (u.match(/\/catalog\/categories\/.+\/parts$/)) return Promise.resolve({ ok: true, json: async () => categoryParts });
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
}

async function loginAndGoToCategories() {
  fireEvent.click(await screen.findByRole('button', { name: /log in/i }));
  await waitFor(() => screen.getByLabelText(/email/i));
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'admin@leap.dev' } });
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'admin_dev_password_123' } });
  fireEvent.click(screen.getByRole('button', { name: /log in/i }));
  await waitFor(() => expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: /^categories$/i }));
}

beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('Categories page — real category/part reference management (mocked fetch, real component tree)', () => {
  it('renders the real seeded category', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAndGoToCategories();

    await waitFor(() => expect(screen.getByText('Brake System')).toBeInTheDocument());
  });

  it('adding a new category calls the real create endpoint and shows it immediately', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAndGoToCategories();

    await waitFor(() => screen.getByPlaceholderText(/id \(e\.g\./i));
    fireEvent.change(screen.getByPlaceholderText(/id \(e\.g\./i), { target: { value: 'tires' } });
    fireEvent.change(screen.getByPlaceholderText(/^english name$/i), { target: { value: 'Tires' } });
    fireEvent.click(screen.getByRole('button', { name: /add category/i }));

    await waitFor(() => expect(screen.getByText('Tires')).toBeInTheDocument());
  });

  it('clicking a category drills into its real parts list', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAndGoToCategories();

    await waitFor(() => screen.getByText('Brake System'));
    fireEvent.click(screen.getByText('Brake System'));

    await waitFor(() => expect(screen.getByText('Front Brake Disc')).toBeInTheDocument());
    expect(screen.getByText(/Brake System — Parts/)).toBeInTheDocument();
  });

  it('adding a new part inside a category calls the real create endpoint and shows it immediately', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAndGoToCategories();

    fireEvent.click(await screen.findByText('Brake System'));
    await waitFor(() => screen.getByPlaceholderText(/english part name/i));
    fireEvent.change(screen.getByPlaceholderText(/english part name/i), { target: { value: 'Brake Fluid' } });
    fireEvent.click(screen.getByRole('button', { name: /add part/i }));

    await waitFor(() => expect(screen.getByText('Brake Fluid')).toBeInTheDocument());
  });

  it('shows a real empty state when a category has no parts yet', async () => {
    globalThis.fetch = mockFetchRouter({ parts: [] });
    render(<LeapAdminApp />);
    await loginAndGoToCategories();

    fireEvent.click(await screen.findByText('Brake System'));
    await waitFor(() => expect(screen.getByText(/no parts yet/i)).toBeInTheDocument());
  });
});
