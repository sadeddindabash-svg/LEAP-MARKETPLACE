import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LeapAdminApp from './App';

const ADMIN_USER = { id: 'admin_dev_seed', email: 'admin@leap.dev', name: 'Dev Admin', role: 'admin', isOwner: true, allowedPages: 'all' };

function makeQueue() {
  return [
    {
      id: 'p9', name: '6-Speed Manual Transmission Gear Set', nameZh: '6速手动变速箱齿轮组', descriptionZh: '高品质变速箱齿轮组',
      category: 'transmission', part: 'Gear Set', position: 'Universal', oemNumber: 'TX-9911',
      images: ['/uploads/a.jpg', '/uploads/b.jpg', '/uploads/c.jpg'],
      supplierName: 'Qingdao Transmission Works', submittedAt: '2026-07-13T00:00:00.000Z', flags: ['Missing fitment data', 'New supplier'],
    },
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
      // Both required, not just English — matches the real backend's
      // confirmed 40-country launch list (includes the entire GCC plus
      // Jordan) requirement.
      if (body.action === 'approve' && (!body.nameEn || !body.nameAr)) {
        return Promise.resolve({ ok: false, status: 400, json: async () => ({ error: 'nameEn and nameAr required to approve' }) });
      }
      queue = queue.filter((p) => p.id !== 'p9'); // approved/rejected products leave the queue
      return Promise.resolve({ ok: true, json: async () => ({ id: 'p9', name: body.nameEn || 'p9', name_ar: body.nameAr || null, status: body.action === 'approve' ? 'active' : 'inactive' }) });
    }
    if (u.endsWith('/catalog/moderation-queue')) return Promise.resolve({ ok: true, json: async () => queue });
    // Overview is the admin dashboard's default landing page after
    // login — this test logs in before navigating to Moderation, so it
    // needs a valid shape here or the whole app crashes rendering it
    // first (same class of bug already fixed for the supplier portal's
    // App.test.jsx when Overview was built there).
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

// The review panel has 4 plain (unlabeled-via-<label>) text inputs in a
// fixed DOM order: English name, English description, Arabic name,
// Arabic description. The English name starts pre-filled with the
// Chinese original (findable via getByDisplayValue); the Arabic ones
// start empty, so they're targeted by position instead.
function getArabicNameInput() {
  return screen.getAllByRole('textbox')[2];
}

beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('Moderation page — real translation-review approve/reject flow (mocked fetch, real component tree)', () => {
  it('renders the real queue with the Chinese original, real photos, and real computed flags', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAndGoToModeration();

    await waitFor(() => expect(screen.getByText('6速手动变速箱齿轮组')).toBeInTheDocument());
    expect(screen.getByText('Missing fitment data')).toBeInTheDocument();
    expect(screen.getByText('New supplier')).toBeInTheDocument();
    expect(screen.queryByText('Translation pending review')).not.toBeInTheDocument();
  });

  it('clicking "Review & Approve" opens the translation panel with both English and Arabic fields, pre-filled with the Chinese original as a starting point', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAndGoToModeration();

    await waitFor(() => expect(screen.getByRole('button', { name: /review & approve/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /review & approve/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /confirm approval/i })).toBeInTheDocument());
    expect(screen.getByText(/arabic name \(required to approve\)/i)).toBeInTheDocument();
  });

  it('cannot confirm approval with only the English name filled in — Arabic is required too', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAndGoToModeration();

    fireEvent.click(await screen.findByRole('button', { name: /review & approve/i }));
    await waitFor(() => screen.getByRole('button', { name: /confirm approval/i }));

    // English name is pre-filled (from the Chinese original) but Arabic
    // is left empty — should still be blocked client-side.
    fireEvent.click(screen.getByRole('button', { name: /confirm approval/i }));

    await waitFor(() => expect(screen.getAllByText(/arabic name/i).length).toBeGreaterThan(0));
    // Still on the review panel — approval was blocked client-side.
    expect(screen.getByRole('button', { name: /confirm approval/i })).toBeInTheDocument();
  });

  it('approving with both a real English AND Arabic translation removes the item from the queue view', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAndGoToModeration();

    fireEvent.click(await screen.findByRole('button', { name: /review & approve/i }));
    await waitFor(() => screen.getByRole('button', { name: /confirm approval/i }));

    const nameInput = screen.getByDisplayValue('6速手动变速箱齿轮组');
    fireEvent.change(nameInput, { target: { value: '6-Speed Manual Transmission Gear Set (reviewed)' } });
    fireEvent.change(getArabicNameInput(), { target: { value: 'طقم تروس ناقل الحركة اليدوي 6 سرعات' } });
    fireEvent.click(screen.getByRole('button', { name: /confirm approval/i }));

    await waitFor(() => expect(screen.getByText(/nothing awaiting review/i)).toBeInTheDocument());
  });

  it('rejecting does not require a translation and removes the item immediately', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAndGoToModeration();

    await waitFor(() => expect(screen.getByRole('button', { name: /^reject$/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /^reject$/i }));

    await waitFor(() => expect(screen.getByText(/nothing awaiting review/i)).toBeInTheDocument());
  });

  it('logs out automatically if the approval action returns 401 (expired session)', async () => {
    globalThis.fetch = mockFetchRouter({ moderateStatus: 401 });
    render(<LeapAdminApp />);
    await loginAndGoToModeration();

    fireEvent.click(await screen.findByRole('button', { name: /review & approve/i }));
    await waitFor(() => screen.getByRole('button', { name: /confirm approval/i }));
    const nameInput = screen.getByDisplayValue('6速手动变速箱齿轮组');
    fireEvent.change(nameInput, { target: { value: 'Some English Name' } });
    fireEvent.change(getArabicNameInput(), { target: { value: 'اسم عربي' } });
    fireEvent.click(screen.getByRole('button', { name: /confirm approval/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /^log in$/i })).toBeInTheDocument());
  });
});
