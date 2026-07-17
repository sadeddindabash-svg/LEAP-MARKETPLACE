import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LeapAdminApp from './App';

const ADMIN_USER = { id: 'admin_dev_seed', email: 'admin@leap.dev', name: 'Dev Admin', role: 'admin', isOwner: true, allowedPages: 'all' };

function makeQueue() {
  return [
    { id: 'p1', name: 'Item One', nameZh: '', descriptionZh: '', category: 'brake', part: 'Disc', position: 'Front', oemNumber: 'OEM-1', images: [], supplierName: 'Supplier A', submittedAt: '2026-07-13T00:00:00.000Z', flags: [] },
    { id: 'p2', name: 'Item Two', nameZh: '', descriptionZh: '', category: 'brake', part: 'Disc', position: 'Front', oemNumber: 'OEM-2', images: [], supplierName: 'Supplier A', submittedAt: '2026-07-13T00:00:00.000Z', flags: [] },
    { id: 'p3', name: 'Item Three', nameZh: '', descriptionZh: '', category: 'brake', part: 'Disc', position: 'Front', oemNumber: 'OEM-3', images: [], supplierName: 'Supplier A', submittedAt: '2026-07-13T00:00:00.000Z', flags: [] },
  ];
}

function mockFetchRouter() {
  let queue = makeQueue();
  return vi.fn((url, options) => {
    const u = String(url);
    const method = options?.method || 'GET';
    if (u.includes('/auth/login')) return Promise.resolve({ ok: true, json: async () => ({ token: 'fake.jwt.token', user: ADMIN_USER }) });
    if (u.includes('/auth/me')) return Promise.resolve({ ok: true, json: async () => ADMIN_USER });
    if (method === 'POST' && u.endsWith('/catalog/products/bulk-moderate')) {
      const { items } = JSON.parse(options.body);
      const results = items.map((item) => {
        if (item.action === 'approve' && (!item.nameEn || !item.nameAr)) {
          return { productId: item.productId, success: false, error: 'nameEn and nameAr required to approve' };
        }
        queue = queue.filter((p) => p.id !== item.productId);
        return { productId: item.productId, success: true };
      });
      return Promise.resolve({ ok: true, json: async () => ({ results }) });
    }
    if (u.endsWith('/catalog/moderation-queue')) return Promise.resolve({ ok: true, json: async () => queue });
    if (u.endsWith('/overview')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ totalOrders: 0, activeSuppliers: 0, pendingSuppliers: 0, openDisputes: 0, pendingModeration: 0, openTickets: 0, ordersByDay: [], unitsByCategory: [], topSuppliers: [] }),
      });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
}

async function loginAndGoToModeration() {
  fireEvent.click(await screen.findByRole('button', { name: /log in/i }));
  await waitFor(() => screen.getByLabelText(/email/i));
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'admin@leap.dev' } });
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'admin_dev_password_123' } });
  fireEvent.click(screen.getByRole('button', { name: /log in/i }));
  await waitFor(() => expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: /moderation/i }));
}

beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('Real bulk moderation UI (mocked fetch, full component tree)', () => {
  it('CRITICAL: selecting items shows the bulk action bar with the real count', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAndGoToModeration();

    await waitFor(() => screen.getByText('Item One'));
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]); // skip "select all", check the first item
    fireEvent.click(checkboxes[2]);

    await waitFor(() => expect(screen.getByText('2 selected')).toBeInTheDocument());
  });

  it('CRITICAL: "select all" selects every real item in the queue', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAndGoToModeration();

    await waitFor(() => screen.getByText('Item One'));
    fireEvent.click(screen.getByRole('checkbox', { name: /select all/i }));

    await waitFor(() => expect(screen.getByText('3 selected')).toBeInTheDocument());
  });

  it('CRITICAL: bulk reject calls the real bulk endpoint and removes all selected items from the queue', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAndGoToModeration();

    await waitFor(() => screen.getByText('Item One'));
    fireEvent.click(screen.getByRole('checkbox', { name: /select all/i }));
    fireEvent.click(screen.getByRole('button', { name: /reject selected/i }));

    await waitFor(() => expect(screen.getByText(/3 listing\(s\) rejected/i)).toBeInTheDocument());
    expect(screen.queryByText('Item One')).not.toBeInTheDocument();
  });

  it('CRITICAL: bulk approve opens a real batch review table requiring English AND Arabic per item, and submits together', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAndGoToModeration();

    await waitFor(() => screen.getByText('Item One'));
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);
    fireEvent.click(checkboxes[2]);
    fireEvent.click(screen.getByRole('button', { name: /review & approve selected/i }));

    await waitFor(() => screen.getByText(/batch review — 2 listing/i));
    const englishInputs = screen.getAllByPlaceholderText(/english name/i);
    const arabicInputs = screen.getAllByPlaceholderText(/arabic name/i);
    expect(englishInputs).toHaveLength(2);

    fireEvent.change(englishInputs[0], { target: { value: 'Reviewed One' } });
    fireEvent.change(arabicInputs[0], { target: { value: 'واحد' } });
    fireEvent.change(englishInputs[1], { target: { value: 'Reviewed Two' } });
    fireEvent.change(arabicInputs[1], { target: { value: 'اثنان' } });

    fireEvent.click(screen.getByRole('button', { name: /approve all/i }));
    await waitFor(() => expect(screen.getByText(/2 listing\(s\) approved/i)).toBeInTheDocument());
  });

  it('bulk approve is blocked client-side if any selected item is missing a required translation', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAndGoToModeration();

    await waitFor(() => screen.getByText('Item One'));
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);
    fireEvent.click(screen.getByRole('button', { name: /review & approve selected/i }));

    await waitFor(() => screen.getByText(/batch review — 1 listing/i));
    // Leave English/Arabic empty and try to submit.
    fireEvent.click(screen.getByRole('button', { name: /approve all/i }));

    await waitFor(() => expect(screen.getByText(/missing a required english or arabic name/i)).toBeInTheDocument());
    // Still on the batch review screen — nothing was submitted.
    expect(screen.getByText(/batch review/i)).toBeInTheDocument();
  });

  it('cancelling the batch review returns to the normal queue view with selection cleared', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAndGoToModeration();

    await waitFor(() => screen.getByText('Item One'));
    fireEvent.click(screen.getAllByRole('checkbox')[1]);
    fireEvent.click(screen.getByRole('button', { name: /review & approve selected/i }));
    await waitFor(() => screen.getByText(/batch review/i));

    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    await waitFor(() => expect(screen.queryByText(/batch review/i)).not.toBeInTheDocument());
    expect(screen.getByText('Item One')).toBeInTheDocument();
  });
});
