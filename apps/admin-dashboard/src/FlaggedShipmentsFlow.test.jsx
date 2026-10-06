import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import LeapAdminApp from './App';

const ADMIN_USER = { id: 'admin_dev_seed', email: 'admin@leap.dev', name: 'Dev Admin', role: 'admin', isOwner: true, allowedPages: 'all' };

const MOCK_FLAGGED = [
  { id: 335, subOrderId: 2222, orderId: 'LP-900555', supplierName: 'Guangzhou AutoParts Co.', hubName: 'Guangzhou Inspection Hub', flaggedAt: '2026-07-15T15:17:45.581Z', flagNote: 'Wrong part received', flagPhotos: ['/uploads/flag-evidence.jpg'] },
];

function mockFetchRouter({ flagged = MOCK_FLAGGED, resolveResponse, resolveCalls = [] } = {}) {
  let queue = [...flagged];
  return vi.fn((url, options) => {
    const u = String(url);
    // PATCH /hub/flagged/:id/resolve (migration 090)
    const resolveMatch = u.match(/\/hub\/flagged\/(\d+)\/resolve$/);
    if (resolveMatch && options?.method === 'PATCH') {
      const body = JSON.parse(options.body);
      resolveCalls.push({ id: Number(resolveMatch[1]), ...body });
      if (resolveResponse) return Promise.resolve(resolveResponse);
      queue = queue.filter((q) => q.id !== Number(resolveMatch[1]));
      return Promise.resolve({ ok: true, json: async () => ({ id: Number(resolveMatch[1]), status: 'flagged', resolution: body.resolution, returnCase: { id: 'RC-7', status: body.resolution === 'continue_processing' ? 'rejected' : 'approved', updated: true } }) });
    }
    if (u.includes('/auth/login')) return Promise.resolve({ ok: true, json: async () => ({ token: 'fake.jwt.token', user: ADMIN_USER }) });
    if (u.includes('/auth/me')) return Promise.resolve({ ok: true, json: async () => ADMIN_USER });
    if (u.endsWith('/overview')) {
      return Promise.resolve({ ok: true, json: async () => ({ totalOrders: 0, activeSuppliers: 0, pendingSuppliers: 0, openDisputes: 0, pendingModeration: 0, openTickets: 0, ordersByDay: [], unitsByCategory: [], topSuppliers: [] }) });
    }
    if (u.endsWith('/hub/flagged')) return Promise.resolve({ ok: true, json: async () => queue });
    // REAL, PRE-EXISTING BUG FOUND AND FIXED HERE (unrelated to
    // whatever else this session was touching when this was found):
    // this mock had no /supplier case at all, so SupplierAnalyticsPicker
    // (rendered as part of the Overview page, which this file's own
    // login flow passes through) got the generic `{}` fallback below
    // instead of a real array, throwing suppliers.map is not a
    // function. Confirmed via git log that this test file predates
    // this session entirely -- a genuinely pre-existing gap, not
    // something introduced by anything built in this pass.
    if (u.endsWith('/supplier')) return Promise.resolve({ ok: true, json: async () => [] });
    if (u.match(/\/order\/LP-900555$/)) {
      return Promise.resolve({
        ok: true, json: async () => ({
          id: 'LP-900555', userId: null, guestEmail: 'g@example.com', isGuestOrder: true, status: 'to_ship', total: 50, currencyCode: 'USD', placedAt: '2026-07-15T00:00:00.000Z',
          supplierSubOrders: [{ subOrderId: 2222, supplierId: 's1', supplierName: 'Guangzhou AutoParts Co.', status: 'shipped', trackingNumber: null, hubId: 'hub_guangzhou', hubName: 'Guangzhou Inspection Hub', hubShipment: { status: 'flagged', events: [] }, items: [] }],
        }),
      });
    }
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

describe('Flagged Shipments — the real queue and sidebar badge (mocked fetch, real component tree)', () => {
  it('shows a real count badge on the sidebar nav item', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await login();

    // REAL BUG FOUND AND FIXED HERE: a later pass added a real
    // NotificationBell that ALSO shows a real badge for the same
    // flagged-shipment count -- getByText('1') became genuinely
    // ambiguous (two real "1"s on screen at once, both correct).
    // Scoped to the sidebar nav item specifically, which is what this
    // test is actually about.
    const sidebarNavItem = screen.getByText('Flagged Shipments').closest('button');
    await waitFor(() => expect(within(sidebarNavItem).getByText('1')).toBeInTheDocument());
  });

  it('shows no badge when nothing is flagged', async () => {
    globalThis.fetch = mockFetchRouter({ flagged: [] });
    render(<LeapAdminApp />);
    await login();

    await waitFor(() => expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument());
    expect(screen.queryByText('1')).not.toBeInTheDocument();
  });

  it('the Flagged Shipments page renders a real flagged entry with its note and photo', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await login();

    fireEvent.click(screen.getByRole('button', { name: /flagged shipments/i }));
    await waitFor(() => expect(screen.getByText('LP-900555')).toBeInTheDocument());
    expect(screen.getByText('Wrong part received')).toBeInTheDocument();
    expect(screen.getByText(/Guangzhou AutoParts Co\./)).toBeInTheDocument();
  });

  it('shows a real empty state when nothing is flagged', async () => {
    globalThis.fetch = mockFetchRouter({ flagged: [] });
    render(<LeapAdminApp />);
    await login();

    fireEvent.click(screen.getByRole('button', { name: /flagged shipments/i }));
    await waitFor(() => expect(screen.getByText(/nothing flagged right now/i)).toBeInTheDocument());
  });

  it('clicking "View order" navigates into the real order detail page', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await login();

    fireEvent.click(screen.getByRole('button', { name: /flagged shipments/i }));
    await waitFor(() => screen.getByRole('button', { name: /view order/i }));
    fireEvent.click(screen.getByRole('button', { name: /view order/i }));

    await waitFor(() => expect(screen.getAllByText('LP-900555').length).toBeGreaterThan(0));
  });
});

describe('Flagged Shipments — resolving a flag (mocked fetch, real component tree)', () => {
  const FLAG_WITH_DETAILS = [{ ...MOCK_FLAGGED[0], damageType: 'water_damage', returnCaseId: 'RC-7' }];

  async function openFlaggedPage(options) {
    globalThis.fetch = mockFetchRouter(options);
    render(<LeapAdminApp />);
    await login();
    fireEvent.click(screen.getByRole('button', { name: /flagged shipments/i }));
    await waitFor(() => expect(screen.getByText('LP-900555')).toBeInTheDocument());
  }
  const dialogPanel = () => screen.getByText(/^Resolve flag — LP-900555$/).parentElement;
  const fieldIn = (panel, label) => within(panel).getByText(label).parentElement.querySelector('input, select');

  it('shows the kind of problem and the linked return case on the flag', async () => {
    await openFlaggedPage({ flagged: FLAG_WITH_DETAILS });
    expect(screen.getByText('Water damage')).toBeInTheDocument();
    expect(screen.getByText(/Return case RC-7/)).toBeInTheDocument();
  });

  it('CRITICAL: resolving needs an outcome; with one it sends the right request, tells the admin what happened to the case, and the flag leaves the list and the sidebar badge', async () => {
    const resolveCalls = [];
    await openFlaggedPage({ flagged: FLAG_WITH_DETAILS, resolveCalls });
    // "Flagged Shipments" is now both the sidebar item and the page title, so pick the sidebar button.
    const sidebarItem = screen.getAllByText('Flagged Shipments').map((el) => el.closest('button')).find(Boolean);
    await waitFor(() => expect(within(sidebarItem).getByText('1')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /^resolve$/i }));
    const panel = dialogPanel();

    // saving with no outcome is refused, and nothing is sent
    fireEvent.click(within(panel).getByRole('button', { name: /^save$/i }));
    expect(within(panel).getByText('Choose an outcome.')).toBeInTheDocument();
    expect(resolveCalls).toHaveLength(0);

    fireEvent.change(fieldIn(panel, 'Outcome'), { target: { value: 'discard' } });
    fireEvent.change(fieldIn(panel, 'Internal note (optional — the buyer does not see this)'), { target: { value: '  crushed beyond use ' } });
    fireEvent.click(within(panel).getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(screen.getByText(/Return case RC-7 is now approved and the buyer was told\./)).toBeInTheDocument());
    expect(resolveCalls).toEqual([{ id: 335, resolution: 'discard', resolutionNotes: 'crushed beyond use' }]);
    await waitFor(() => expect(screen.getByText(/nothing flagged right now/i)).toBeInTheDocument());
    // the badge on the sidebar dropped straight away (it used to refresh only when navigating)
    expect(within(sidebarItem).queryByText('1')).not.toBeInTheDocument();
  });

  it('every outcome is offered, and each says what happens to the buyer or the case', async () => {
    await openFlaggedPage({ flagged: FLAG_WITH_DETAILS });
    fireEvent.click(screen.getByRole('button', { name: /^resolve$/i }));
    const select = fieldIn(dialogPanel(), 'Outcome');
    const labels = Array.from(select.querySelectorAll('option')).map((o) => o.textContent);
    expect(labels).toEqual(expect.arrayContaining([
      expect.stringMatching(/False alarm.*no problem was found/),
      expect.stringMatching(/Return to supplier.*won't be shipped/),
      expect.stringMatching(/Discard.*won't be shipped/),
      expect.stringMatching(/replacement.*stays open/),
    ]));
  });

  it('a server error is shown inside the open dialog and the flag stays in the list', async () => {
    await openFlaggedPage({ resolveResponse: { ok: false, status: 400, json: async () => ({ error: 'This shipment is not an unresolved flag.' }) } });
    fireEvent.click(screen.getByRole('button', { name: /^resolve$/i }));
    const panel = dialogPanel();
    fireEvent.change(fieldIn(panel, 'Outcome'), { target: { value: 'continue_processing' } });
    fireEvent.click(within(panel).getByRole('button', { name: /^save$/i }));
    expect(await within(panel).findByText('This shipment is not an unresolved flag.')).toBeInTheDocument();
    expect(screen.getByText('LP-900555')).toBeInTheDocument();
  });

  it('says so when a return case was already finalised by hand and was left alone', async () => {
    await openFlaggedPage({ resolveResponse: { ok: true, json: async () => ({ id: 335, status: 'flagged', returnCase: { id: 'RC-7', status: 'completed', updated: false } }) } });
    fireEvent.click(screen.getByRole('button', { name: /^resolve$/i }));
    const panel = dialogPanel();
    fireEvent.change(fieldIn(panel, 'Outcome'), { target: { value: 'discard' } });
    fireEvent.click(within(panel).getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(screen.getByText(/Return case RC-7 was already completed, so it was left as it is\./)).toBeInTheDocument());
  });
});
