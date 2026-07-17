import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LeapAdminApp from './App';

const ADMIN_USER = { id: 'admin_dev_seed', email: 'admin@leap.dev', name: 'Dev Admin', role: 'admin', isOwner: true, allowedPages: 'all' };

function makeTicketList() {
  return [
    { id: 'T-5500', subject: 'Wrong brake disc size delivered', buyerId: null, guestEmail: 'guest@example.com', orderId: null, status: 'open', priority: 'high', createdAt: '2026-07-13T00:00:00.000Z', updatedAt: '2026-07-13T00:00:00.000Z' },
  ];
}
function makeTicketDetail() {
  return {
    id: 'T-5500', subject: 'Wrong brake disc size delivered', buyerId: null, guestEmail: 'guest@example.com', orderId: null, status: 'open', priority: 'high',
    createdAt: '2026-07-13T00:00:00.000Z', updatedAt: '2026-07-13T00:00:00.000Z',
    messages: [{ senderRole: 'buyer', message: 'I ordered a 300mm disc but received a 290mm one.', createdAt: '2026-07-13T00:00:00.000Z' }],
  };
}

function mockFetchRouter({ replyStatus = 200 } = {}) {
  let detail = makeTicketDetail();
  return vi.fn((url, options) => {
    const u = String(url);
    if (u.includes('/auth/login')) return Promise.resolve({ ok: true, json: async () => ({ token: 'fake.jwt.token', user: ADMIN_USER }) });
    if (u.includes('/auth/me')) return Promise.resolve({ ok: true, json: async () => ADMIN_USER });
    if (u.match(/\/support\/tickets\/T-5500\/messages$/)) {
      if (replyStatus === 401) return Promise.resolve({ ok: false, status: 401, json: async () => ({ error: 'unauthorized' }) });
      const body = JSON.parse(options.body);
      detail = { ...detail, status: 'in_progress', messages: [...detail.messages, { senderRole: 'admin', message: body.message, createdAt: new Date().toISOString() }] };
      return Promise.resolve({ ok: true, json: async () => ({ senderRole: 'admin', message: body.message }) });
    }
    if (u.match(/\/support\/tickets\/T-5500$/) && (!options || options.method === undefined)) {
      return Promise.resolve({ ok: true, json: async () => detail });
    }
    if (u.endsWith('/support/tickets')) return Promise.resolve({ ok: true, json: async () => makeTicketList() });
    // Overview is the admin dashboard's default landing page after
    // login -- this test logs in before navigating elsewhere, so it
    // needs a valid shape here or the whole app crashes rendering it
    // first (same class of bug found and fixed in ModerationFlow.test.jsx).
    if (u.endsWith('/overview')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ totalOrders: 0, activeSuppliers: 0, pendingSuppliers: 0, openDisputes: 0, pendingModeration: 0, openTickets: 0, ordersByDay: [], unitsByCategory: [], topSuppliers: [] }),
      });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
}

async function loginAndGoToTickets() {
  fireEvent.click(await screen.findByRole('button', { name: /log in/i }));
  await waitFor(() => screen.getByLabelText(/email/i));
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'admin@leap.dev' } });
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'admin_dev_password_123' } });
  fireEvent.click(screen.getByRole('button', { name: /log in/i }));
  await waitFor(() => expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: /^support$/i }));
}

beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('Tickets page — real data and reply flow (mocked fetch, real component tree)', () => {
  it('renders real ticket rows fetched from the backend', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAndGoToTickets();

    await waitFor(() => expect(screen.getByText('Wrong brake disc size delivered')).toBeInTheDocument());
    expect(screen.getByText('guest@example.com')).toBeInTheDocument();
  });

  it('opens a ticket, shows the real message thread, and sending a reply calls the real endpoint', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAndGoToTickets();

    await waitFor(() => expect(screen.getByText('Wrong brake disc size delivered')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Wrong brake disc size delivered'));

    await waitFor(() => expect(screen.getByText(/I ordered a 300mm disc/)).toBeInTheDocument());

    const input = screen.getByPlaceholderText(/reply to the buyer/i);
    fireEvent.change(input, { target: { value: 'We are sending a replacement.' } });
    fireEvent.click(screen.getByRole('button', { name: /^send$/i }));

    await waitFor(() => expect(screen.getByText('We are sending a replacement.')).toBeInTheDocument());
  });

  it('logs out automatically if sending a reply returns 401 (expired session)', async () => {
    globalThis.fetch = mockFetchRouter({ replyStatus: 401 });
    render(<LeapAdminApp />);
    await loginAndGoToTickets();

    await waitFor(() => expect(screen.getByText('Wrong brake disc size delivered')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Wrong brake disc size delivered'));
    await waitFor(() => screen.getByPlaceholderText(/reply to the buyer/i));

    fireEvent.change(screen.getByPlaceholderText(/reply to the buyer/i), { target: { value: 'test' } });
    fireEvent.click(screen.getByRole('button', { name: /^send$/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /^log in$/i })).toBeInTheDocument());
  });
});
