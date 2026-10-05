import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import LeapAdminApp from './App';

const ADMIN_USER = { id: 'admin_dev_seed', email: 'admin@leap.dev', name: 'Dev Admin', role: 'admin', isOwner: true, allowedPages: 'all' };

const HUBS = [
  { id: 'hub_guangzhou', name: 'Guangzhou Inspection Hub', region: 'China (South)', address: null },
  { id: 'hub_dubai', name: 'Dubai Logistics Hub', region: 'UAE / GCC', address: null },
];

const makeStaff = (over) => ({
  id: 'u_1', name: 'Mei Lin', email: 'mei@example.com', hubId: 'hub_guangzhou', hubName: 'Guangzhou Inspection Hub',
  isDisabled: false, disabledAt: null, createdAt: '2026-07-01T00:00:00Z', lastActivityAt: null, ...over,
});

// Mocked backend that behaves like the real hub-staff routes (see
// services/api/src/modules/hub-staff/routes.js), including the one-time password.
function mockBackend({ hubs = HUBS } = {}) {
  let staff = [makeStaff(), makeStaff({ id: 'u_2', name: 'Omar Said', email: 'omar@example.com', isDisabled: true, disabledAt: '2026-07-02T00:00:00Z', hubId: 'hub_dubai', hubName: 'Dubai Logistics Hub' })];
  const calls = [];
  const fetchMock = vi.fn((url, options) => {
    const u = String(url);
    const method = options?.method || 'GET';
    const ok = (body, status = 200) => Promise.resolve({ ok: true, status, json: async () => body });
    if (u.includes('/auth/login')) return ok({ token: 'fake.jwt.token', user: ADMIN_USER });
    if (u.includes('/auth/me')) return ok(ADMIN_USER);
    if (u.endsWith('/overview')) return ok({ totalOrders: 0, activeSuppliers: 0, pendingSuppliers: 0, openDisputes: 0, pendingModeration: 0, ordersByDay: [], topSuppliers: [], recentOrders: [] });
    if (u.endsWith('/hub/locations')) return ok(hubs);
    if (u.endsWith('/hub/workload')) return ok([]);
    if (u.endsWith('/hub/performance')) return ok([]);

    const m = u.match(/\/hub-staff(?:\/([^/]+))?(?:\/(disable|enable|reset-password))?$/);
    if (m) {
      const [, id, action] = m;
      calls.push({ method, id, action, body: options?.body ? JSON.parse(options.body) : undefined });
      if (method === 'GET' && !id) return ok(staff);
      if (method === 'POST' && !id) {
        const body = JSON.parse(options.body);
        if (body.email === 'dup@example.com') return Promise.resolve({ ok: false, status: 409, json: async () => ({ error: 'An account with this email already exists.' }) });
        const created = makeStaff({ id: 'u_new', name: body.name, email: body.email, hubId: body.hubId, hubName: hubs.find((h) => h.id === body.hubId)?.name });
        staff = [created, ...staff];
        return ok({ staff: created, temporaryPassword: 'TempPass-1234' }, 201);
      }
      if (method === 'POST' && action === 'reset-password') return ok({ staff: staff.find((s) => s.id === id), temporaryPassword: 'NewTemp-5678' });
      if (method === 'POST' && (action === 'disable' || action === 'enable')) {
        staff = staff.map((s) => (s.id === id ? { ...s, isDisabled: action === 'disable' } : s));
        return ok(staff.find((s) => s.id === id));
      }
      if (method === 'PATCH') {
        const body = JSON.parse(options.body);
        staff = staff.map((s) => (s.id === id ? { ...s, ...body, hubName: hubs.find((h) => h.id === (body.hubId || s.hubId))?.name } : s));
        return ok(staff.find((s) => s.id === id));
      }
    }
    return ok({});
  });
  return { fetchMock, calls };
}

async function openHubsPage() {
  fireEvent.click(await screen.findByRole('button', { name: /log in/i }));
  await waitFor(() => screen.getByLabelText(/email/i));
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'admin@leap.dev' } });
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'admin_dev_password_123' } });
  fireEvent.click(screen.getByRole('button', { name: /log in/i }));
  await waitFor(() => expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: /^hubs$/i }));
  await screen.findByText('Hub staff');
}

const rowOf = (name) => screen.getByText(name).closest('tr');
// EditDialog's labels aren't linked to their inputs, so find each control through its label's wrapper.
const fieldIn = (panel, label) => within(panel).getByText(label).parentElement.querySelector('input, select');

describe('Hub staff section on the Hubs page (mocked fetch, real component tree)', () => {
  let backend;
  beforeEach(() => {
    localStorage.clear();
    backend = mockBackend();
    globalThis.fetch = backend.fetchMock;
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('lists hub staff with their hub and whether they are active or disabled', async () => {
    render(<LeapAdminApp />);
    await openHubsPage();
    const mei = await waitFor(() => rowOf('Mei Lin'));
    expect(within(mei).getByText('mei@example.com')).toBeInTheDocument();
    expect(within(mei).getByText('Active')).toBeInTheDocument();
    expect(within(mei).getByText('Guangzhou Inspection Hub')).toBeInTheDocument();
    expect(within(mei).getByText('No activity yet')).toBeInTheDocument();
    expect(within(rowOf('Omar Said')).getByText('Disabled')).toBeInTheDocument();
  });

  it('CRITICAL: adding staff sends the right request and shows the temporary password ONCE -- gone after Done', async () => {
    render(<LeapAdminApp />);
    await openHubsPage();
    await waitFor(() => rowOf('Mei Lin'));

    fireEvent.click(screen.getByRole('button', { name: /add staff/i }));
    const panel = screen.getByText('Add hub staff').parentElement;
    fireEvent.change(fieldIn(panel, 'Full name'), { target: { value: 'Sara Ali' } });
    fireEvent.change(fieldIn(panel, 'Email (they log in with this)'), { target: { value: 'sara@example.com' } });
    fireEvent.change(fieldIn(panel, 'Hub'), { target: { value: 'hub_dubai' } });
    fireEvent.click(within(panel).getByRole('button', { name: /^save$/i }));

    expect(await screen.findByText('TempPass-1234')).toBeInTheDocument();
    expect(screen.getByText(/only time it is shown/i)).toBeInTheDocument();
    const create = backend.calls.find((c) => c.method === 'POST' && !c.id);
    expect(create.body).toEqual({ email: 'sara@example.com', name: 'Sara Ali', hubId: 'hub_dubai' });

    fireEvent.click(screen.getByRole('button', { name: /^done$/i }));
    await waitFor(() => expect(screen.queryByText('TempPass-1234')).not.toBeInTheDocument());
    expect(await waitFor(() => rowOf('Sara Ali'))).toBeInTheDocument(); // the list refreshed
  });

  it('a server error (duplicate email) is shown inside the open dialog, not lost behind it', async () => {
    render(<LeapAdminApp />);
    await openHubsPage();
    await waitFor(() => rowOf('Mei Lin'));

    fireEvent.click(screen.getByRole('button', { name: /add staff/i }));
    const panel = screen.getByText('Add hub staff').parentElement;
    fireEvent.change(fieldIn(panel, 'Full name'), { target: { value: 'Dup Person' } });
    fireEvent.change(fieldIn(panel, 'Email (they log in with this)'), { target: { value: 'dup@example.com' } });
    fireEvent.change(fieldIn(panel, 'Hub'), { target: { value: 'hub_guangzhou' } });
    fireEvent.click(within(panel).getByRole('button', { name: /^save$/i }));

    expect(await within(panel).findByText('An account with this email already exists.')).toBeInTheDocument();
    expect(screen.queryByText(/temporary password/i)).not.toBeInTheDocument();
  });

  it('CRITICAL: disabling asks first, uses the word "Disable" (not "Delete"), then calls the endpoint and updates the row', async () => {
    render(<LeapAdminApp />);
    await openHubsPage();
    const mei = await waitFor(() => rowOf('Mei Lin'));

    fireEvent.click(within(mei).getByRole('button', { name: /^disable$/i }));
    expect(screen.getByText('Disable Mei Lin?')).toBeInTheDocument();
    expect(screen.getByText(/logged out immediately/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^delete$/i })).not.toBeInTheDocument();
    expect(backend.calls.some((c) => c.action === 'disable')).toBe(false); // nothing sent before confirming

    const dialog = screen.getByText('Disable Mei Lin?').parentElement;
    fireEvent.click(within(dialog).getByRole('button', { name: /^disable$/i }));
    await waitFor(() => expect(backend.calls.some((c) => c.action === 'disable' && c.id === 'u_1')).toBe(true));
    await waitFor(() => expect(within(rowOf('Mei Lin')).getByText('Disabled')).toBeInTheDocument());
    expect(within(rowOf('Mei Lin')).getByRole('button', { name: /^enable$/i })).toBeInTheDocument();
  });

  it('enabling a disabled person calls the enable endpoint', async () => {
    render(<LeapAdminApp />);
    await openHubsPage();
    const omar = await waitFor(() => rowOf('Omar Said'));
    fireEvent.click(within(omar).getByRole('button', { name: /^enable$/i }));
    const dialog = screen.getByText('Enable Omar Said?').parentElement;
    fireEvent.click(within(dialog).getByRole('button', { name: /^enable$/i }));
    await waitFor(() => expect(backend.calls.some((c) => c.action === 'enable' && c.id === 'u_2')).toBe(true));
    await waitFor(() => expect(within(rowOf('Omar Said')).getByText('Active')).toBeInTheDocument());
  });

  it('resetting a password asks first, then shows the new temporary password once', async () => {
    render(<LeapAdminApp />);
    await openHubsPage();
    const mei = await waitFor(() => rowOf('Mei Lin'));
    fireEvent.click(within(mei).getByRole('button', { name: /reset password/i }));
    const dialog = screen.getByText(/Reset Mei Lin's password\?/).parentElement;
    fireEvent.click(within(dialog).getByRole('button', { name: /reset password/i }));

    expect(await screen.findByText('NewTemp-5678')).toBeInTheDocument();
    expect(screen.getByText(/old password no longer works/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^done$/i }));
    await waitFor(() => expect(screen.queryByText('NewTemp-5678')).not.toBeInTheDocument());
  });

  it('editing lets you rename someone or move them to another hub', async () => {
    render(<LeapAdminApp />);
    await openHubsPage();
    const mei = await waitFor(() => rowOf('Mei Lin'));
    fireEvent.click(within(mei).getByRole('button', { name: /^edit$/i }));
    const panel = screen.getByText('Edit hub staff').parentElement;
    fireEvent.change(fieldIn(panel, 'Hub'), { target: { value: 'hub_dubai' } });
    fireEvent.click(within(panel).getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(backend.calls.some((c) => c.method === 'PATCH' && c.id === 'u_1')).toBe(true));
    expect(backend.calls.find((c) => c.method === 'PATCH').body).toEqual({ name: 'Mei Lin', hubId: 'hub_dubai' });
    await waitFor(() => expect(within(rowOf('Mei Lin')).getByText('Dubai Logistics Hub')).toBeInTheDocument());
  });

  it('"Add staff" is disabled when no hub exists yet', async () => {
    backend = mockBackend({ hubs: [] });
    globalThis.fetch = backend.fetchMock;
    render(<LeapAdminApp />);
    await openHubsPage();
    expect(screen.getByRole('button', { name: /add staff/i })).toBeDisabled();
  });
});
