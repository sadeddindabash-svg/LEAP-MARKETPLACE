import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LeapAdminApp from './App';

const ADMIN_USER = { id: 'admin_dev_seed', email: 'admin@leap.dev', name: 'Dev Admin', role: 'admin' };

function makeQueue() {
  return [
    { id: 'p9', name: '6-Speed Manual Transmission Gear Set', category: 'transmission', supplierName: 'Qingdao Transmission Works', submittedAt: '2026-07-13T00:00:00.000Z', flags: ['Missing fitment data', 'New supplier'] },
  ];
}

function mockFetchRouter({ moderateStatus = 200 } = {}) {
  let queue = makeQueue();
  return vi.fn((url, options) => {
    const u = String(url);
    if (u.includes('/auth/login')) return Promise.resolve({ ok: true, json: async () => ({ token: 'fake.jwt.token', user: ADMIN_USER }) });
    if (u.includes('/auth/me')) return Promise.resolve({ ok: true, json: async () => ADMIN_USER });
    if (u.match(/\/catalog\/products\/p9\/moderate$/)) {
      if (moderateStatus === 401) return Promise.resolve({ ok: false, status: 401, json: async () => ({ error: 'unauthorized' }) });
      const body = JSON.parse(options.body);
      queue = queue.filter((p) => p.id !== 'p9'); // approved/rejected products leave the queue
      return Promise.resolve({ ok: true, json: async () => ({ id: 'p9', status: body.action === 'approve' ? 'active' : 'inactive' }) });
    }
    if (u.endsWith('/catalog/moderation-queue')) return Promise.resolve({ ok: true, json: async () => queue });
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

describe('Moderation page — real approve/reject flow (mocked fetch, real component tree)', () => {
  it('renders the real queue with real computed flags, not fabricated ones', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAndGoToModeration();

    await waitFor(() => expect(screen.getByText(/6-Speed Manual Transmission Gear Set/)).toBeInTheDocument());
    expect(screen.getByText('Missing fitment data')).toBeInTheDocument();
    expect(screen.getByText('New supplier')).toBeInTheDocument();
    // The old mock's fake "Translation pending review" flag should be gone.
    expect(screen.queryByText('Translation pending review')).not.toBeInTheDocument();
  });

  it('approving removes the item from the queue view after the real action succeeds', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAndGoToModeration();

    await waitFor(() => expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /approve/i }));

    await waitFor(() => expect(screen.getByText(/nothing awaiting review/i)).toBeInTheDocument());
  });

  it('logs out automatically if the moderate action returns 401 (expired session)', async () => {
    globalThis.fetch = mockFetchRouter({ moderateStatus: 401 });
    render(<LeapAdminApp />);
    await loginAndGoToModeration();

    await waitFor(() => expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /approve/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /^log in$/i })).toBeInTheDocument());
  });
});
