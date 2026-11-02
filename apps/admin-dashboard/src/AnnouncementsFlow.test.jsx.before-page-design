import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import LeapAdminApp from './App';

// The "Home page announcements" card in Settings, with the server replaced by fixed answers.
const OWNER_USER = { id: 'admin_dev_seed', email: 'admin@leap.dev', name: 'Dev Admin', role: 'admin', isOwner: true, allowedPages: 'all' };
const TWO = [{ en: 'Opening Middle East warehouse in Saudi Arabia', ar: 'افتتاح مستودع الشرق الأوسط في السعودية' }, { en: 'International shipping in 3-7 days', ar: 'شحن دولي خلال 3-7 أيام' }];

let saved;   // what the fake server holds
function mockFetchRouter({ initial = TWO, patch = null } = {}) {
  saved = initial.map((a) => ({ ...a }));
  return vi.fn((url, options) => {
    const u = String(url);
    const method = options?.method || 'GET';
    if (u.includes('/auth/login')) return Promise.resolve({ ok: true, json: async () => ({ token: 'fake.jwt.token', user: OWNER_USER }) });
    if (u.includes('/auth/me')) return Promise.resolve({ ok: true, json: async () => OWNER_USER });
    if (u.endsWith('/overview')) return Promise.resolve({ ok: true, json: async () => ({ totalOrders: 0, activeSuppliers: 0, pendingSuppliers: 0, openDisputes: 0, pendingModeration: 0, openTickets: 0 }) });
    if (u.endsWith('/catalog/categories')) return Promise.resolve({ ok: true, json: async () => [] });
    if (u.endsWith('/platform-settings/return-window')) return Promise.resolve({ ok: true, json: async () => ({ returnWindowDays: 7 }) });
    if (u.endsWith('/admin-users')) return Promise.resolve({ ok: true, json: async () => [] });
    if (u.endsWith('/platform-settings/announcements')) {
      if (method === 'PATCH') {
        if (patch) return Promise.resolve(patch(options));
        saved = JSON.parse(options.body).announcements;
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ announcements: saved, max: 5 }) });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ announcements: saved, max: 5 }) });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
}

async function loginAndGoToSettings() {
  fireEvent.click(await screen.findByRole('button', { name: /log in/i }));
  await waitFor(() => screen.getByLabelText(/email/i));
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'admin@leap.dev' } });
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'admin_dev_password_123' } });
  fireEvent.click(screen.getByRole('button', { name: /log in/i }));
  await waitFor(() => expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: /settings/i }));
  await screen.findByText('Home page announcements');
}
const field = (n, lang) => screen.getByLabelText(`Announcement ${n}, ${lang}`);
// The Settings page has several cards with a Save button: this finds THIS card (the nearest block around its title that holds its Add button).
const card = () => { let el = screen.getByText('Home page announcements'); while (el && !within(el).queryByRole('button', { name: 'Add announcement' })) el = el.parentElement; return el; };
const saveButton = () => within(card()).getByRole('button', { name: 'Save' });
const patchCalls = () => globalThis.fetch.mock.calls.filter(([u, o]) => String(u).endsWith('/platform-settings/announcements') && o?.method === 'PATCH');

beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('Settings: home page announcements', () => {
  it('CRITICAL: the card shows what the website shows now: the saved announcements, each with its English and Arabic text', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAndGoToSettings();
    await waitFor(() => expect(field(1, 'English')).toHaveValue(TWO[0].en));
    expect(field(1, 'Arabic')).toHaveValue(TWO[0].ar);
    expect(field(2, 'English')).toHaveValue(TWO[1].en);
    expect(screen.getByText('2 of 5')).toBeInTheDocument();
    expect(screen.getByText(/home page only/i)).toBeInTheDocument();
  });

  it('CRITICAL: up to 5 can be added: the Add button stops at 5 and the counter says so; removing one frees a place', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAndGoToSettings();
    await screen.findByText('2 of 5');
    const add = screen.getByRole('button', { name: 'Add announcement' });
    fireEvent.click(add); fireEvent.click(add); fireEvent.click(add);
    expect(screen.getByText('5 of 5')).toBeInTheDocument();
    expect(add).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Remove announcement 3' }));
    expect(screen.getByText('4 of 5')).toBeInTheDocument();
    expect(add).toBeEnabled();
  });

  it('CRITICAL: Save sends the list in order with the admin\'s token, leaves out a row left empty, and shows what the server kept', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAndGoToSettings();
    await screen.findByText('2 of 5');
    fireEvent.click(screen.getByRole('button', { name: 'Add announcement' }));              // a third row, filled
    fireEvent.change(field(3, 'English'), { target: { value: 'Free delivery over $200' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add announcement' }));              // a fourth row, left empty
    fireEvent.change(field(1, 'English'), { target: { value: 'Warehouse now open in Riyadh' } });
    fireEvent.click(saveButton());
    expect(await screen.findByText(/Saved\. The home page shows the change/)).toBeInTheDocument();
    const [, options] = patchCalls()[0];
    expect(options.headers.Authorization).toBe('Bearer fake.jwt.token');
    expect(JSON.parse(options.body)).toEqual({ announcements: [{ en: 'Warehouse now open in Riyadh', ar: TWO[0].ar }, TWO[1], { en: 'Free delivery over $200', ar: '' }] });
    expect(screen.getByText('3 of 5')).toBeInTheDocument();                                  // the empty row is gone
  });

  it('CRITICAL: a refusal from the server (for example Arabic typed with no English) is shown in plain words and nothing is marked saved', async () => {
    globalThis.fetch = mockFetchRouter({ patch: () => ({ ok: false, status: 400, json: async () => ({ error: 'Each announcement needs English text' }) }) });
    render(<LeapAdminApp />);
    await loginAndGoToSettings();
    await screen.findByText('2 of 5');
    fireEvent.click(screen.getByRole('button', { name: 'Add announcement' }));
    fireEvent.change(field(3, 'Arabic'), { target: { value: 'نص بلا إنجليزي' } });
    fireEvent.click(saveButton());
    expect(await screen.findByText('Each announcement needs English text')).toBeInTheDocument();
    expect(screen.queryByText(/^Saved\./)).not.toBeInTheDocument();
    expect(field(3, 'Arabic')).toHaveValue('نص بلا إنجليزي');                                 // what was typed is kept
  });

  it('an expired session on Save sends the admin back to the login screen', async () => {
    globalThis.fetch = mockFetchRouter({ patch: () => ({ ok: false, status: 401, json: async () => ({ error: 'expired' }) }) });
    render(<LeapAdminApp />);
    await loginAndGoToSettings();
    await screen.findByText('2 of 5');
    fireEvent.click(saveButton());
    expect(await screen.findByRole('button', { name: /log in/i })).toBeInTheDocument();
  });

  it('CRITICAL: the preview shows the English site moving right to left and the Arabic site left to right, with the English text where the Arabic is empty', async () => {
    globalThis.fetch = mockFetchRouter({ initial: [{ en: 'Free delivery over $200', ar: '' }, { en: 'Open now', ar: 'مفتوح الآن' }] });
    render(<LeapAdminApp />);
    await loginAndGoToSettings();
    const en = await screen.findByTestId('announcement-preview-en');
    const ar = screen.getByTestId('announcement-preview-ar');
    expect(en).toHaveClass('leap-ann-en'); expect(en.getAttribute('dir')).toBe('ltr');
    expect(ar).toHaveClass('leap-ann-ar'); expect(ar.getAttribute('dir')).toBe('rtl');
    expect(within(en).getAllByText('Free delivery over $200').length).toBeGreaterThan(0);
    expect(within(ar).getAllByText('Free delivery over $200').length).toBeGreaterThan(0);        // no Arabic: the English is shown
    expect(within(ar).getAllByText('مفتوح الآن').length).toBeGreaterThan(0);
    expect(document.head.innerHTML + document.body.innerHTML).toMatch(/leapAnnRtl[\s\S]*leapAnnLtr/);
  });

  it('with no announcements the card says the home page shows no bar, and Save sends an empty list', async () => {
    globalThis.fetch = mockFetchRouter({ initial: [] });
    render(<LeapAdminApp />);
    await loginAndGoToSettings();
    expect(await screen.findByText('No announcements: the home page shows no bar.')).toBeInTheDocument();
    fireEvent.click(saveButton());
    await screen.findByText(/^Saved\./);
    expect(JSON.parse(patchCalls()[0][1].body)).toEqual({ announcements: [] });
  });
});
