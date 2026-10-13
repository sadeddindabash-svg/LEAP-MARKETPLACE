import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import LeapAdminApp from './App';

// The sidebar groups pages (Suppliers, Products, Support, Financial) and shows a row of sub-tabs above them. These tests run the REAL app and check what a person
// sees and that every tab really opens its own page (by the server calls that page makes), for the owner and for admins who may open only some pages.
const OWNER = { id: 'admin_dev_seed', email: 'admin@leap.dev', name: 'Dev Admin', role: 'admin', isOwner: true, allowedPages: 'all' };
const OVERVIEW = { totalOrders: 0, activeSuppliers: 0, pendingSuppliers: 0, openDisputes: 0, pendingModeration: 0, openTickets: 0, ordersByDay: [], unitsByCategory: [], topSuppliers: [] };
const SUPPLIERS = [{ id: 's1', name: 'Guangzhou AutoParts Co.', country: 'China', contactEmail: 'wei@gz.cn', verificationStatus: 'verified', listingCount: 12, createdAt: '2026-01-02T00:00:00.000Z' }];

let calls;
function mockServer({ user = OWNER, overview = OVERVIEW } = {}) {
  calls = [];
  globalThis.fetch = vi.fn((url, options) => {
    const u = String(url).replace(/^https?:\/\/[^/]+/, '');
    calls.push(`${options?.method || 'GET'} ${u}`);
    const ok = (body) => Promise.resolve({ ok: true, status: 200, json: async () => body });
    if (u.includes('/auth/login')) return ok({ token: 'fake.jwt.token', user });
    if (u.includes('/auth/me')) return ok(user);
    if (u.endsWith('/overview')) return ok(overview);
    if (u.endsWith('/hub/flagged')) return ok([]);
    if (u.endsWith('/supplier')) return ok(SUPPLIERS);
    return Promise.resolve({ ok: false, status: 500, json: async () => ({ error: 'not mocked in this test' }) });   // the page shows its error state: it must not crash
  });
}
async function signIn() {
  render(<LeapAdminApp />);
  fireEvent.click(await screen.findByRole('button', { name: /log in/i }));
  await waitFor(() => screen.getByLabelText(/email/i));
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'admin@leap.dev' } });
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'admin_dev_password_123' } });
  fireEvent.click(screen.getByRole('button', { name: /log in/i }));
  await waitFor(() => expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument());
}
const sidebarButton = (name) => screen.getByRole('button', { name: new RegExp(`^${name}$`, 'i') });
// the sidebar's own container is the parent of any of its entries (default anchor: Orders)
const sidebarNames = (anchor = 'orders') => Array.from(screen.getByRole('button', { name: new RegExp(`^${anchor}$`, 'i') }).parentElement.children).map((b) => b.textContent.trim());
const tabNames = (group) => within(screen.getByRole('tablist', { name: group })).getAllByRole('tab').map((t) => t.textContent.trim());
const selectedTab = (group) => within(screen.getByRole('tablist', { name: group })).getAllByRole('tab').filter((t) => t.getAttribute('aria-selected') === 'true').map((t) => t.textContent.trim());
// the server calls made while doing something (give the page a moment to start loading)
async function callsDuring(action) {
  const before = calls.length;
  await action();
  await new Promise((r) => setTimeout(r, 120));
  return calls.slice(before);
}

beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('Admin sidebar groups and sub-tabs (real app, mocked server)', () => {
  it('CRITICAL: the sidebar shows Suppliers, Products, Support and Financial as ONE entry each, in the old places, and none of the old separate entries', async () => {
    mockServer(); await signIn();
    expect(sidebarNames()).toEqual(['Overview', 'Orders', 'Suppliers', 'Products', 'Returns', 'Vehicle Data', 'Delivery Rules', 'Categories', 'Support', 'Hubs', 'Financial', 'Flagged Shipments', 'Settings']);
    for (const gone of ['Supplier Messages', 'Moderation', 'All Products', 'Promo Codes', 'Pricing', 'Payment Methods', 'Payment Providers', 'Payouts', 'Reviews']) {
      expect(screen.queryByRole('button', { name: new RegExp(`^${gone}$`, 'i') }), gone).not.toBeInTheDocument();
    }
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();         // Overview has no sub-tabs
  });

  it('CRITICAL: each group opens on its first tab, lists its tabs in the agreed order, and every tab opens its OWN page', async () => {
    mockServer(); await signIn();
    const groups = [
      ['Suppliers', ['Suppliers', 'Supplier Messages'], ['/supplier', '/supplier-messages/admin']],
      ['Products', ['Moderation', 'All Products'], ['/catalog/moderation-queue', '/catalog/admin/products']],
      ['Support', ['Tickets', 'Reviews', 'Promo Codes'], ['/support/tickets', '/reviews/pending', '/promo-codes']],
      ['Financial', ['Payment Methods', 'Payment Providers', 'Payouts', 'Pricing'], ['/payment-methods', '/payment-providers', '/payouts/owed', '/pricing/fee-components']],
    ];
    for (const [group, tabs, evidence] of groups) {
      const onClick = await callsDuring(() => fireEvent.click(sidebarButton(group)));
      expect(tabNames(group), group).toEqual(tabs);
      expect(selectedTab(group), `${group}: the first tab is open`).toEqual([tabs[0]]);
      expect(onClick.some((c) => c.includes(evidence[0])), `${group} > ${tabs[0]} loads its page`).toBe(true);
      for (let i = 1; i < tabs.length; i += 1) {
        const made = await callsDuring(async () => fireEvent.click(screen.getByRole('tab', { name: new RegExp(`^${tabs[i]}$`) })));
        expect(selectedTab(group), `${group} > ${tabs[i]} is the selected tab`).toEqual([tabs[i]]);
        expect(made.some((c) => c.includes(evidence[i])), `${group} > ${tabs[i]} loads its own page (${evidence[i]})`).toBe(true);
      }
    }
  }, 60000);

  it('clicking a group again returns to the tab you were last on; a page with no group has no tab bar', async () => {
    mockServer(); await signIn();
    fireEvent.click(sidebarButton('Financial'));
    fireEvent.click(await screen.findByRole('tab', { name: /^pricing$/i }));
    fireEvent.click(sidebarButton('Orders'));
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    fireEvent.click(sidebarButton('Financial'));
    expect(selectedTab('Financial')).toEqual(['Pricing']);                  // not the first tab: the one you were on
    fireEvent.click(sidebarButton('Hubs'));
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  }, 30000);

  it('CRITICAL: an admin who may open only some pages sees only those tabs; a group with ONE allowed page opens straight on it with no tab bar; a group with none is hidden', async () => {
    const limited = { ...OWNER, isOwner: false, allowedPages: ['paymentMethods', 'pricing', 'reviews', 'orders'] };
    mockServer({ user: limited }); await signIn();
    expect(sidebarNames()).toEqual(['Orders', 'Support', 'Financial']);          // no Suppliers, Products, ...: nothing in them is allowed
    fireEvent.click(sidebarButton('Financial'));
    expect(tabNames('Financial')).toEqual(['Payment Methods', 'Pricing']);       // Payment Providers and Payouts are not allowed: no tab for them
    fireEvent.click(sidebarButton('Support'));
    await waitFor(() => expect(calls.some((c) => c.includes('/reviews/pending'))).toBe(true));   // Reviews is the only allowed page of Support: it opens directly
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();              // ...and there is nothing to switch between
  }, 30000);

  it('an admin whose only page is inside a group lands on it, with the group highlighted in the sidebar and no tab bar', async () => {
    mockServer({ user: { ...OWNER, isOwner: false, allowedPages: ['payouts'] } }); await signIn();
    expect(sidebarNames('financial')).toEqual(['Financial']);
    await waitFor(() => expect(calls.some((c) => c.includes('/payouts/owed'))).toBe(true));
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  }, 30000);

  it('CRITICAL: the notification bell still deep-links into a tab: "Products pending moderation" opens Products on its Moderation tab', async () => {
    mockServer({ overview: { ...OVERVIEW, pendingModeration: 4 } }); await signIn();
    fireEvent.click(await screen.findByText('4'));                            // the bell's badge
    fireEvent.click(await screen.findByText('Products pending moderation'));
    await waitFor(() => expect(selectedTab('Products')).toEqual(['Moderation']));
    fireEvent.click(screen.getByRole('tab', { name: /^all products$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /^suppliers$/i }));
    expect(selectedTab('Suppliers')).toEqual(['Suppliers']);
  }, 30000);

  it('CRITICAL: the tab bar is hidden while a supplier\'s detail page is open, and the sidebar leaves the detail (it used to stay stuck on it)', async () => {
    mockServer(); await signIn();
    fireEvent.click(sidebarButton('Suppliers'));
    expect(tabNames('Suppliers')).toEqual(['Suppliers', 'Supplier Messages']);
    fireEvent.click(await screen.findByText('Guangzhou AutoParts Co.'));       // opens the supplier's own page
    await waitFor(() => expect(screen.queryByRole('tablist')).not.toBeInTheDocument());
    const made = await callsDuring(async () => fireEvent.click(sidebarButton('Orders')));
    expect(made.some((c) => /GET \/order(\?|$)/.test(c))).toBe(true);           // the Orders page opened: the detail was left
  }, 30000);
});
