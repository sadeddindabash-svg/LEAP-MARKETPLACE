import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LeapAdminApp from './App';

const OWNER_USER = { id: 'admin_dev_seed', email: 'admin@leap.dev', name: 'Dev Admin', role: 'admin', isOwner: true, allowedPages: 'all' };

const MOCK_PENDING = [
  { id: 1, productId: 'p1', productName: 'RIDEX Front Brake Disc', buyerName: 'Test Buyer', rating: 5, comment: 'Great product', status: 'pending', createdAt: '2026-07-01T00:00:00.000Z' },
];

function mockFetchRouter() {
  let pending = [...MOCK_PENDING];
  let requireVerified = false;
  return vi.fn((url, options) => {
    const u = String(url);
    const method = options?.method || 'GET';
    if (u.includes('/auth/login')) return Promise.resolve({ ok: true, json: async () => ({ token: 'fake.jwt.token', user: OWNER_USER }) });
    if (u.includes('/auth/me')) return Promise.resolve({ ok: true, json: async () => OWNER_USER });
    if (u.endsWith('/reviews/pending')) return Promise.resolve({ ok: true, json: async () => pending });
    if (method === 'PATCH' && u.match(/\/reviews\/\d+\/moderate$/)) {
      const id = Number(u.split('/').slice(-2)[0]);
      pending = pending.filter((r) => r.id !== id);
      return Promise.resolve({ ok: true, json: async () => ({ id, status: 'approved' }) });
    }
    if (u.endsWith('/platform-settings/require-verified-purchase-for-reviews') && method === 'GET') {
      return Promise.resolve({ ok: true, json: async () => ({ requireVerifiedPurchase: requireVerified }) });
    }
    if (u.endsWith('/platform-settings/require-verified-purchase-for-reviews') && method === 'PATCH') {
      const body = JSON.parse(options.body);
      requireVerified = body.requireVerifiedPurchase;
      return Promise.resolve({ ok: true, json: async () => ({ requireVerifiedPurchase: requireVerified }) });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
}

async function loginAndGoToReviews() {
  fireEvent.click(await screen.findByRole('button', { name: /log in/i }));
  await waitFor(() => screen.getByLabelText(/email/i));
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'admin@leap.dev' } });
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'admin_dev_password_123' } });
  fireEvent.click(screen.getByRole('button', { name: /log in/i }));
  await waitFor(() => expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: /^reviews$/i }));
}

beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('Real Reviews moderation page (mocked fetch, full component tree)', () => {
  it('CRITICAL: shows the real pending review with its real rating and comment', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAndGoToReviews();

    await waitFor(() => screen.getByText('RIDEX Front Brake Disc'));
    expect(screen.getByText('Great product')).toBeInTheDocument();
  });

  it('CRITICAL: approving a review calls the real endpoint and removes it from the pending queue', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAndGoToReviews();

    await waitFor(() => screen.getByText('RIDEX Front Brake Disc'));
    fireEvent.click(screen.getByRole('button', { name: /approve/i }));

    await waitFor(() => expect(screen.getByText(/nothing awaiting review/i)).toBeInTheDocument());
  });

  it('CRITICAL: the verified-purchase toggle calls the real endpoint and reflects the real saved state', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAndGoToReviews();

    await waitFor(() => screen.getByText(/require verified purchase/i));
    expect(screen.getByText('Off')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Off'));
    await waitFor(() => expect(screen.getByText('On')).toBeInTheDocument());
  });

  it('rejecting a review also removes it from the pending queue', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAndGoToReviews();

    await waitFor(() => screen.getByText('RIDEX Front Brake Disc'));
    fireEvent.click(screen.getByRole('button', { name: /reject/i }));

    await waitFor(() => expect(screen.getByText(/nothing awaiting review/i)).toBeInTheDocument());
  });
});
