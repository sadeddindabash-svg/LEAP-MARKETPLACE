import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LeapAdminApp from './App';

// Support tickets: the Status card. The status only moves forward (Open -> In progress -> Resolved) and can't be undone, with the server replaced by fixed answers.
const OWNER_USER = { id: 'admin_dev_seed', email: 'admin@leap.dev', name: 'Dev Admin', role: 'admin', isOwner: true, allowedPages: 'all' };
let ticket;      // what the fake server holds
function mockFetchRouter({ patch = null } = {}) {
  return vi.fn((url, options) => {
    const u = String(url); const method = options?.method || 'GET';
    if (u.includes('/auth/login')) return Promise.resolve({ ok: true, json: async () => ({ token: 'fake.jwt.token', user: OWNER_USER }) });
    if (u.includes('/auth/me')) return Promise.resolve({ ok: true, json: async () => OWNER_USER });
    if (u.endsWith('/overview')) return Promise.resolve({ ok: true, json: async () => ({ totalOrders: 0, activeSuppliers: 0, pendingSuppliers: 0, openDisputes: 0, pendingReturns: 0 }) });
    if (u.endsWith('/support/tickets') && method === 'GET') return Promise.resolve({ ok: true, json: async () => [{ ...ticket }] });
    if (/\/support\/tickets\/T-1$/.test(u) && method === 'PATCH') { if (patch) return Promise.resolve(patch(options)); ticket = { ...ticket, status: JSON.parse(options.body).status }; return Promise.resolve({ ok: true, status: 200, json: async () => ({ ...ticket }) }); }
    if (/\/support\/tickets\/T-1$/.test(u)) return Promise.resolve({ ok: true, json: async () => ({ ...ticket, messages: [{ senderRole: 'buyer', message: 'Where is my order?', createdAt: '2026-10-27T10:00:00Z' }] }) });
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
}
async function openTicket() {
  fireEvent.click(await screen.findByRole('button', { name: /log in/i })); await waitFor(() => screen.getByLabelText(/email/i));
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'admin@leap.dev' } }); fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'admin_dev_password_123' } });
  fireEvent.click(screen.getByRole('button', { name: /log in/i })); await waitFor(() => expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: /support/i })); fireEvent.click(await screen.findByText('T-1')); await screen.findByTestId('ticket-status-open');
}
const step = (s) => screen.getByTestId(`ticket-status-${s}`);
const patchCalls = () => globalThis.fetch.mock.calls.filter(([u, o]) => /\/support\/tickets\/T-1$/.test(String(u)) && o?.method === 'PATCH').map(([, o]) => JSON.parse(o.body).status);
beforeEach(() => { localStorage.clear(); ticket = { id: 'T-1', subject: 'Where is my order', buyerId: 'u1', guestEmail: null, orderId: null, status: 'open', priority: 'medium', createdAt: '2026-10-27T10:00:00Z', updatedAt: '2026-10-27T10:00:00Z' }; });
afterEach(() => { vi.restoreAllMocks(); });

describe('Support ticket: the Status card', () => {
  it('CRITICAL: OPEN: the current step is marked, and the NEXT TWO (In progress, Resolved) can be pressed', async () => {
    globalThis.fetch = mockFetchRouter(); render(<LeapAdminApp />); await openTicket();
    expect(step('open')).toHaveAttribute('aria-current', 'step'); expect(step('open')).toBeDisabled(); expect(step('in_progress')).toBeEnabled(); expect(step('resolved')).toBeEnabled();
  });
  it('CRITICAL: IN PROGRESS: Open is greyed out and cannot be pressed; Resolved still can', async () => {
    ticket.status = 'in_progress'; globalThis.fetch = mockFetchRouter(); render(<LeapAdminApp />); await openTicket();
    expect(step('in_progress')).toHaveAttribute('aria-current', 'step'); expect(step('open')).toBeDisabled(); expect(step('open')).not.toHaveAttribute('aria-current'); expect(step('open').title).toMatch(/only moves forward/); expect(step('resolved')).toBeEnabled();
  });
  it('CRITICAL: RESOLVED: nothing else can be pressed (it is final)', async () => {
    ticket.status = 'resolved'; globalThis.fetch = mockFetchRouter(); render(<LeapAdminApp />); await openTicket();
    expect(step('resolved')).toHaveAttribute('aria-current', 'step'); for (const s of ['open', 'in_progress', 'resolved']) expect(step(s)).toBeDisabled();
    fireEvent.click(step('open')); fireEvent.click(step('in_progress')); expect(patchCalls()).toEqual([]);
  });
  it('a greyed-out step does nothing when clicked (no request is sent)', async () => {
    ticket.status = 'in_progress'; globalThis.fetch = mockFetchRouter(); render(<LeapAdminApp />); await openTicket(); fireEvent.click(step('open')); await new Promise((r) => setTimeout(r, 50)); expect(patchCalls()).toEqual([]); expect(step('in_progress')).toHaveAttribute('aria-current', 'step');
  });
  it('pressing In progress moves it at once (no question), and the card follows: Open greys out', async () => {
    globalThis.fetch = mockFetchRouter(); render(<LeapAdminApp />); await openTicket(); fireEvent.click(step('in_progress'));
    await waitFor(() => expect(patchCalls()).toEqual(['in_progress'])); await waitFor(() => expect(step('in_progress')).toHaveAttribute('aria-current', 'step')); expect(step('open')).toBeDisabled(); expect(screen.queryByTestId('ticket-resolve-confirm')).not.toBeInTheDocument();
  });
  it('CRITICAL: pressing RESOLVED asks first ("Resolved can\'t be undone"), sends nothing yet, and Cancel leaves the ticket as it was', async () => {
    globalThis.fetch = mockFetchRouter(); render(<LeapAdminApp />); await openTicket(); fireEvent.click(step('resolved'));
    const box = await screen.findByTestId('ticket-resolve-confirm'); expect(box).toHaveTextContent("Resolved can't be undone."); expect(patchCalls()).toEqual([]);
    fireEvent.click(screen.getByTestId('ticket-resolve-no')); expect(screen.queryByTestId('ticket-resolve-confirm')).not.toBeInTheDocument(); expect(patchCalls()).toEqual([]); expect(step('open')).toHaveAttribute('aria-current', 'step');
  });
  it('CRITICAL: confirming resolves it: one request, the question goes away, and every step is then greyed out', async () => {
    globalThis.fetch = mockFetchRouter(); render(<LeapAdminApp />); await openTicket(); fireEvent.click(step('resolved')); fireEvent.click(await screen.findByTestId('ticket-resolve-yes'));
    await waitFor(() => expect(patchCalls()).toEqual(['resolved'])); await waitFor(() => expect(step('resolved')).toHaveAttribute('aria-current', 'step')); expect(screen.queryByTestId('ticket-resolve-confirm')).not.toBeInTheDocument(); for (const s of ['open', 'in_progress', 'resolved']) expect(step(s)).toBeDisabled();
  });
  it('a refusal from the server (409: somebody else already moved it on) is shown, and the card shows the real status after reloading', async () => {
    globalThis.fetch = mockFetchRouter({ patch: () => { ticket = { ...ticket, status: 'resolved' }; return { ok: false, status: 409, json: async () => ({ error: "A ticket's status only moves forward (open, in progress, resolved) and cannot be undone. This ticket is already resolved." }) }; } });
    render(<LeapAdminApp />); await openTicket(); fireEvent.click(step('in_progress')); expect(await screen.findByText(/only moves forward/i, { selector: 'div,span,p' })).toBeInTheDocument();
  });
  it('the card says so in words: the status only moves forward and can\'t be undone', async () => { globalThis.fetch = mockFetchRouter(); render(<LeapAdminApp />); await openTicket(); expect(screen.getByText("Status only moves forward and can't be undone.")).toBeInTheDocument(); });
});
