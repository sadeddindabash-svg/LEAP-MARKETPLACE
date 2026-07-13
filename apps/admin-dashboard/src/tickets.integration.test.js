import { describe, it, expect } from 'vitest';
import { login, fetchTickets, fetchTicketById, replyToTicket, updateTicketStatus } from './auth';

const BACKEND_URL = 'http://localhost:4000';

async function isBackendUp() {
  try {
    const res = await fetch(`${BACKEND_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

async function createTestTicket(overrides = {}) {
  const res = await fetch(`${BACKEND_URL}/support/tickets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subject: 'Integration test ticket',
      message: 'This is a test message.',
      guestEmail: `test-${Date.now()}@example.com`,
      ...overrides,
    }),
  });
  return res.json();
}

describe.runIf(await isBackendUp())('support tickets against a REAL running backend', () => {
  it('creates a ticket as a guest with no auth required', async () => {
    const ticket = await createTestTicket();
    expect(ticket.id).toMatch(/^T-\d+$/);
    expect(ticket.status).toBe('open');
  });

  it('rejects ticket creation with no subject/message', async () => {
    const res = await fetch(`${BACKEND_URL}/support/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guestEmail: 'x@example.com' }),
    });
    expect(res.ok).toBe(false);
  });

  it('rejects ticket creation with no identity (no auth, no guestEmail)', async () => {
    const res = await fetch(`${BACKEND_URL}/support/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: 'x', message: 'y' }),
    });
    expect(res.ok).toBe(false);
  });

  it('rejects fetchTickets with no token', async () => {
    await expect(fetchTickets(null)).rejects.toThrow();
  });

  it('rejects a non-admin (buyer) account from viewing tickets', async () => {
    const email = `ticket-test-${Date.now()}@example.com`;
    const signupRes = await fetch(`${BACKEND_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123' }),
    });
    const { token: buyerToken } = await signupRes.json();
    await expect(fetchTickets(buyerToken)).rejects.toThrow();
  });

  it('admin sees the created ticket in the full list', async () => {
    const created = await createTestTicket({ subject: 'Findable in list test' });
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');
    const tickets = await fetchTickets(token);
    expect(tickets.find((t) => t.id === created.id)).toBeDefined();
  });

  it('fetches full ticket detail including the real initial message', async () => {
    const created = await createTestTicket({ subject: 'Detail test', message: 'A very specific test message body' });
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');
    const detail = await fetchTicketById(token, created.id);
    expect(detail.messages.length).toBe(1);
    expect(detail.messages[0].senderRole).toBe('buyer');
    expect(detail.messages[0].message).toBe('A very specific test message body');
  });

  it('admin reply is added to the thread and auto-transitions status to in_progress', async () => {
    const created = await createTestTicket();
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');

    await replyToTicket(token, created.id, 'Thanks for reaching out, looking into this.');

    const detail = await fetchTicketById(token, created.id);
    expect(detail.messages.length).toBe(2);
    expect(detail.messages[1].senderRole).toBe('admin');
    expect(detail.status).toBe('in_progress'); // auto-transitioned from 'open'
  });

  it('status updates are real and persisted, confirmed by independent re-fetch', async () => {
    const created = await createTestTicket();
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');

    await updateTicketStatus(token, created.id, 'resolved');
    const detail = await fetchTicketById(token, created.id);
    expect(detail.status).toBe('resolved');
  });

  it('rejects an invalid status', async () => {
    const created = await createTestTicket();
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');
    await expect(updateTicketStatus(token, created.id, 'banana')).rejects.toThrow();
  });
});
