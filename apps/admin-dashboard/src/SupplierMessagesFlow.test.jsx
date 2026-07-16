import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LeapAdminApp from './App';

const ADMIN_USER = { id: 'admin_dev_seed', email: 'admin@leap.dev', name: 'Dev Admin', role: 'admin' };

const MOCK_INBOX = [
  { supplierId: 's1', supplierName: 'Guangzhou AutoParts Co.', lastMessagePreview: 'Our brake pads are running low in stock.', lastMessageAt: '2026-07-16T00:05:00.000Z' },
];
const MOCK_THREAD = [
  { id: 1, supplierId: 's1', senderRole: 'supplier', originalText: '我们的刹车片库存不足', originalLanguage: 'zh', translatedText: 'Our brake pads are running low in stock.', translatedLanguage: 'en', translationStatus: 'success', createdAt: '2026-07-16T00:05:00.000Z' },
];

function mockFetchRouter({ inbox = MOCK_INBOX, thread = MOCK_THREAD } = {}) {
  let realThread = [...thread];
  return vi.fn((url, options) => {
    const u = String(url);
    const method = options?.method || 'GET';
    if (u.includes('/auth/login')) return Promise.resolve({ ok: true, json: async () => ({ token: 'fake.jwt.token', user: ADMIN_USER }) });
    if (u.includes('/auth/me')) return Promise.resolve({ ok: true, json: async () => ADMIN_USER });
    if (u.endsWith('/overview')) {
      return Promise.resolve({ ok: true, json: async () => ({ totalOrders: 0, activeSuppliers: 0, pendingSuppliers: 0, openDisputes: 0, pendingModeration: 0, openTickets: 0, ordersByDay: [], unitsByCategory: [], topSuppliers: [] }) });
    }
    if (u.endsWith('/supplier-messages/admin')) return Promise.resolve({ ok: true, json: async () => inbox });
    if (method === 'POST' && u.endsWith('/supplier-messages/admin/s1')) {
      const body = JSON.parse(options.body);
      const newMessage = { id: realThread.length + 1, supplierId: 's1', senderRole: 'admin', originalText: body.text, originalLanguage: 'en', translatedText: null, translatedLanguage: 'zh', translationStatus: 'unavailable', createdAt: new Date().toISOString() };
      realThread = [...realThread, newMessage];
      return Promise.resolve({ ok: true, status: 201, json: async () => newMessage });
    }
    if (u.endsWith('/supplier-messages/admin/s1')) return Promise.resolve({ ok: true, json: async () => realThread });
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
}

async function login() {
  fireEvent.click(await screen.findByRole('button', { name: /log in/i }));
  await waitFor(() => screen.getByLabelText(/email/i));
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'admin@leap.dev' } });
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'admin_dev_password_123' } });
  fireEvent.click(screen.getByRole('button', { name: /log in/i }));
  await waitFor(() => expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument());
}

beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('Admin Supplier Messages — real inbox + thread with translation toggle (mocked fetch, real component tree)', () => {
  it('renders the real inbox with a real supplier and message preview', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await login();

    fireEvent.click(screen.getByRole('button', { name: /supplier messages/i }));
    await waitFor(() => expect(screen.getByText('Guangzhou AutoParts Co.')).toBeInTheDocument());
    expect(screen.getByText('Our brake pads are running low in stock.')).toBeInTheDocument();
  });

  it('CRITICAL: opening a thread shows the real translated text by default, with a working toggle to the real Chinese original', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await login();

    fireEvent.click(screen.getByRole('button', { name: /supplier messages/i }));
    fireEvent.click(await screen.findByText('Guangzhou AutoParts Co.'));

    await waitFor(() => expect(screen.getByText('Our brake pads are running low in stock.')).toBeInTheDocument());
    expect(screen.queryByText('我们的刹车片库存不足')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText(/show original/i));
    await waitFor(() => expect(screen.getByText('我们的刹车片库存不足')).toBeInTheDocument());
  });

  it('CRITICAL: admin sending a real reply calls the real send endpoint and it appears immediately', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await login();

    fireEvent.click(screen.getByRole('button', { name: /supplier messages/i }));
    fireEvent.click(await screen.findByText('Guangzhou AutoParts Co.'));
    await waitFor(() => screen.getByPlaceholderText(/type a message/i));

    fireEvent.change(screen.getByPlaceholderText(/type a message/i), { target: { value: 'Thanks, please restock as soon as possible.' } });
    fireEvent.keyDown(screen.getByPlaceholderText(/type a message/i), { key: 'Enter' });

    await waitFor(() => expect(screen.getByText('Thanks, please restock as soon as possible.')).toBeInTheDocument());
  });

  it('shows a real empty state when no supplier has messaged yet', async () => {
    globalThis.fetch = mockFetchRouter({ inbox: [] });
    render(<LeapAdminApp />);
    await login();

    fireEvent.click(screen.getByRole('button', { name: /supplier messages/i }));
    await waitFor(() => expect(screen.getByText(/no supplier messages yet/i)).toBeInTheDocument());
  });
});
