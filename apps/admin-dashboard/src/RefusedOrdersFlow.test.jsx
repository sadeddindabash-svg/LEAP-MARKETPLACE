import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import LeapAdminApp from './App';

// Admin, Orders: the orders a supplier REFUSED or did not answer in 24 hours, with the reason, alternatives (same OEM number), Reassign and Mark as handled. Mocked backend, real component tree.
const OWNER_USER = { id: 'admin_dev_seed', email: 'admin@leap.dev', name: 'Dev Admin', role: 'admin', isOwner: true, allowedPages: 'all' };
const refused = (over = {}) => ({ subOrderId: 7001, orderId: 'LP-910100', kind: 'refused', status: 'cancelled', orderStatus: 'cancelled', placedAt: '2026-10-27T08:00:00Z', supplierId: 's1', supplierName: 'Guangzhou AutoParts Co.', buyerId: 'u1', buyerContact: 'buyer@example.com', reason: 'out_of_stock', reasonText: 'Out of stock', note: null, refusedAt: '2026-10-27T10:00:00Z', respondBy: '2026-10-28T08:00:00Z', escalatedAt: null, handledAt: null, handledBy: null, handledNote: null, reassignedToSubOrderId: null, items: [{ productId: 'p1', name: 'RIDEX Brake Disc', oemNumber: 'OEM-1', quantity: 2, buyerUnitPriceUsd: 30, supplierUnitPriceCny: 52 }], ...over });
const noAnswer = () => refused({ subOrderId: 7002, orderId: 'LP-910200', kind: 'no_answer', status: 'pending', orderStatus: 'to_ship', reason: null, reasonText: null, refusedAt: null, escalatedAt: '2026-10-28T09:00:00Z' });
const ALTS = [{ productId: 'p1', name: 'RIDEX Brake Disc', oemNumber: 'OEM-1', quantity: 2, alternatives: [{ productId: 'alt1', name: 'Alt disc A', supplierId: 's2', supplierName: 'Ningbo Parts', stockQuantity: 5, supplierPriceCny: 40 }, { productId: 'alt2', name: 'Alt disc B', supplierId: 's2', supplierName: 'Ningbo Parts', stockQuantity: 9, supplierPriceCny: 44 }] }];
let open, handled, calls;
function mockBackend({ alts = ALTS, fail = null } = {}) {
  return vi.fn((url, options) => {
    const u = String(url); const method = options?.method || 'GET'; const ok = (b, status = 200) => Promise.resolve({ ok: status < 400, status, json: async () => b });
    if (u.includes('/auth/login')) return ok({ token: 'fake.jwt.token', user: OWNER_USER }); if (u.includes('/auth/me')) return ok(OWNER_USER);
    if (u.includes('/supplier-responses?filter=open')) return ok(open); if (u.includes('/supplier-responses?filter=handled')) return ok(handled);
    let m = u.match(/\/supplier-responses\/(\d+)\/alternatives$/); if (m) return ok(alts);
    m = u.match(/\/supplier-responses\/(\d+)\/(reassign|handled)$/);
    if (m && method === 'POST') { const body = JSON.parse(options.body); calls.push({ id: Number(m[1]), action: m[2], body }); if (fail) return ok({ error: fail }, 409); const row = open.find((r) => r.subOrderId === Number(m[1])); open = open.filter((r) => r !== row); handled = [{ ...row, handledAt: new Date().toISOString(), reassignedToSubOrderId: m[2] === 'reassign' ? 9001 : null, handledNote: body.note || null }, ...handled]; return ok(m[2] === 'reassign' ? { subOrderId: Number(m[1]), reassignedTo: { subOrderId: 9001, supplierId: 's2' } } : { subOrderId: Number(m[1]), handled: true }, m[2] === 'reassign' ? 201 : 200); }
    if (u.endsWith('/order')) return ok([]); if (u.endsWith('/overview')) return ok({ totalOrders: 0, activeSuppliers: 0, pendingSuppliers: 0, openDisputes: 0, pendingReturns: 0 });
    return ok({});
  });
}
async function openOrders() {
  fireEvent.click(await screen.findByRole('button', { name: /log in/i })); await waitFor(() => screen.getByLabelText(/email/i)); fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'admin@leap.dev' } }); fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'admin_dev_password_123' } });
  fireEvent.click(screen.getByRole('button', { name: /log in/i })); await waitFor(() => expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument()); fireEvent.click(screen.getByRole('button', { name: /^orders$/i })); await screen.findByTestId('refused-section');
}
const row = (id) => screen.getByTestId(`refused-row-${id}`);
const expand = async (id) => { fireEvent.click(within(row(id)).getByText(/LP-9/).closest('div')); };
beforeEach(() => { localStorage.clear(); open = [refused(), noAnswer()]; handled = []; calls = []; });
afterEach(() => { vi.restoreAllMocks(); });

describe('Admin Orders: refused and unanswered orders', () => {
  it('CRITICAL: lists the refused order (with the reason) and the one nobody answered in 24 hours (said plainly as NOT cancelled)', async () => {
    globalThis.fetch = mockBackend(); render(<LeapAdminApp />); await openOrders(); await waitFor(() => expect(row(7001)).toBeInTheDocument());
    expect(row(7001)).toHaveTextContent('Refused'); expect(row(7001)).toHaveTextContent('Out of stock'); expect(row(7001)).toHaveTextContent('Guangzhou AutoParts Co.');
    expect(row(7002)).toHaveTextContent('No answer in 24 h'); expect(row(7002)).toHaveTextContent(/NOT cancelled/);
  });
  it('a refusal with a written note shows the note; nothing to show says so', async () => {
    open = [refused({ reason: 'other', reasonText: 'Other', note: 'Factory closed' })]; globalThis.fetch = mockBackend(); render(<LeapAdminApp />); await openOrders(); await waitFor(() => expect(row(7001)).toHaveTextContent('Other: Factory closed'));
  });
  it('an empty list says that nothing needs attention', async () => { open = []; globalThis.fetch = mockBackend(); render(<LeapAdminApp />); await openOrders(); expect(await screen.findByTestId('refused-empty')).toHaveTextContent(/Nothing needs attention/); });
  it('CRITICAL: opening a refused order shows the buyer, the items with BOTH prices (the buyer\'s dollars and the supplier\'s RMB) and the alternatives (other suppliers, same OEM number, stock and RMB price)', async () => {
    globalThis.fetch = mockBackend(); render(<LeapAdminApp />); await openOrders(); await waitFor(() => row(7001)); await expand(7001);
    await waitFor(() => expect(screen.getByTestId('alt-p1-alt1')).toBeInTheDocument()); expect(row(7001)).toHaveTextContent('buyer@example.com'); expect(row(7001)).toHaveTextContent('RIDEX Brake Disc × 2'); expect(row(7001)).toHaveTextContent('OEM OEM-1'); expect(row(7001)).toHaveTextContent('buyer $30.00'); expect(row(7001)).toHaveTextContent('supplier ¥52.00');
    expect(row(7001)).toHaveTextContent('Alt disc A · Ningbo Parts'); expect(row(7001)).toHaveTextContent('stock 5 · ¥40.00');
  });
  it('CRITICAL: Reassign stays off until every item has an alternative; choosing one sends the choice, tells the admin, and moves the order out of the list', async () => {
    globalThis.fetch = mockBackend(); render(<LeapAdminApp />); await openOrders(); await waitFor(() => row(7001)); await expand(7001); await screen.findByTestId('alt-p1-alt1');
    expect(screen.getByTestId('reassign-7001')).toBeDisabled(); fireEvent.click(screen.getByTestId('alt-p1-alt2')); expect(screen.getByTestId('reassign-7001')).toBeEnabled(); fireEvent.click(screen.getByTestId('reassign-7001'));
    await waitFor(() => expect(calls).toEqual([{ id: 7001, action: 'reassign', body: { items: [{ productId: 'p1', alternativeProductId: 'alt2' }] } }])); expect(await screen.findByRole('status')).toHaveTextContent(/Reassigned/); await waitFor(() => expect(screen.queryByTestId('refused-row-7001')).not.toBeInTheDocument()); expect(screen.getByTestId('refused-row-7002')).toBeInTheDocument();
  });
  it('an order with no alternative says so plainly and can still be marked as handled', async () => {
    globalThis.fetch = mockBackend({ alts: [{ ...ALTS[0], alternatives: [] }] }); render(<LeapAdminApp />); await openOrders(); await waitFor(() => row(7001)); await expand(7001); await waitFor(() => expect(row(7001)).toHaveTextContent(/No other supplier has this part/)); expect(screen.getByTestId('reassign-7001')).toBeDisabled(); expect(screen.getByTestId('handled-7001')).toBeEnabled();
  });
  it('Mark as handled sends the note, and the order moves to the Handled list', async () => {
    globalThis.fetch = mockBackend(); render(<LeapAdminApp />); await openOrders(); await waitFor(() => row(7001)); await expand(7001); await screen.findByTestId('handled-note-7001'); fireEvent.change(screen.getByTestId('handled-note-7001'), { target: { value: 'called the buyer' } }); fireEvent.click(screen.getByTestId('handled-7001'));
    await waitFor(() => expect(calls).toEqual([{ id: 7001, action: 'handled', body: { note: 'called the buyer' } }])); await waitFor(() => expect(screen.queryByTestId('refused-row-7001')).not.toBeInTheDocument());
    fireEvent.click(screen.getByTestId('refused-filter-handled')); await waitFor(() => expect(screen.getByTestId('refused-row-7001')).toBeInTheDocument()); expect(screen.getByTestId('refused-row-7001')).toHaveTextContent('Handled'); await expand(7001); expect(row(7001)).toHaveTextContent('Note: called the buyer'); expect(screen.queryByTestId('handled-7001')).not.toBeInTheDocument();
  });
  it('a refusal from the server (already handled, not enough stock ...) is shown, and the order stays in the list', async () => {
    globalThis.fetch = mockBackend({ fail: 'Not enough stock of Alt disc A.' }); render(<LeapAdminApp />); await openOrders(); await waitFor(() => row(7001)); await expand(7001); fireEvent.click(await screen.findByTestId('alt-p1-alt1')); fireEvent.click(screen.getByTestId('reassign-7001'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Not enough stock'); expect(screen.getByTestId('refused-row-7001')).toBeInTheDocument();
  });
  it('an unanswered order cannot be reassigned (nothing was refused): it only offers Mark as handled', async () => {
    globalThis.fetch = mockBackend(); render(<LeapAdminApp />); await openOrders(); await waitFor(() => row(7002)); await expand(7002); await screen.findByTestId('handled-7002'); expect(screen.queryByTestId('reassign-7002')).not.toBeInTheDocument();
  });
});
