import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import LeapAdminApp from './App';

const ADMIN_USER = { id: 'admin_dev_seed', email: 'admin@leap.dev', name: 'Dev Admin', role: 'admin', isOwner: true, allowedPages: 'all' };

const MOCK_FLAGGED = [
  { id: 335, subOrderId: 2222, orderId: 'LP-900555', supplierName: 'Guangzhou AutoParts Co.', hubName: 'Guangzhou Inspection Hub', flaggedAt: '2026-07-15T15:17:45.581Z', flagNote: 'Wrong part received', flagPhotos: ['/uploads/flag-evidence.jpg'] },
];

function mockFetchRouter({ flagged = MOCK_FLAGGED, handlers = [], calls = [], hubEvents = [] } = {}) {
  let queue = [...flagged];
  const ctx = { getQueue: () => queue, setQueue: (next) => { queue = next; } };
  return vi.fn((url, options) => {
    const u = String(url);
    const method = options?.method || 'GET';
    // Test-scripted endpoints: { method, match: RegExp, respond(body, ctx, match) -> { status?, body } }.
    // Every call they answer is recorded in `calls`, so a test can check exactly what was sent.
    for (const h of handlers) {
      const m = h.method === method && u.match(h.match);
      if (m) {
        const body = options?.body ? JSON.parse(options.body) : undefined;
        calls.push({ method, url: u, body });
        const out = h.respond(body, ctx, m);
        return Promise.resolve({ ok: (out.status || 200) < 400, status: out.status || 200, json: async () => out.body });
      }
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
          supplierSubOrders: [{ subOrderId: 2222, supplierId: 's1', supplierName: 'Guangzhou AutoParts Co.', status: 'shipped', trackingNumber: null, hubId: 'hub_guangzhou', hubName: 'Guangzhou Inspection Hub', hubShipment: { status: 'flagged', events: hubEvents }, items: [] }],
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

describe('Flagged Shipments — the two verdicts: no fault, or a real fault (mocked fetch, real component tree)', () => {
  const ITEMS = [
    { productId: 'p1', name: 'RIDEX Front Brake Disc', quantity: 2, unitPrice: 15 },
    { productId: 'p4', name: 'MAHLE Oil Filter', quantity: 1, unitPrice: 8.5 },
  ];
  const flag = (over = {}) => ({ ...MOCK_FLAGGED[0], returnCaseId: 'RC-7', damageType: 'water_damage', hubStatus: 'flagged', items: ITEMS, faultCase: null, supplierReturnAddressOnFile: true, ...over });
  const faultCase = (over = {}) => ({
    id: 9, shipmentId: 335, status: 'awaiting_supplier', costBearer: 'supplier', adminNotes: null, items: [ITEMS[0]],
    // What the buyer actually paid for the faulty items (computed by the server; a discount makes it lower than list value).
    refundSuggestion: { orderedValue: 30, discountShare: 0, suggested: 30, orderTotal: 50 },
    supplier: { answered: false, canReplace: null, eta: null, note: null }, outcome: null, refund: null, hubReturn: null, ...over,
  });

  async function openFlaggedPage(options) {
    globalThis.fetch = mockFetchRouter(options);
    render(<LeapAdminApp />);
    await login();
    fireEvent.click(screen.getByRole('button', { name: /flagged shipments/i }));
    await waitFor(() => expect(screen.getByText('LP-900555')).toBeInTheDocument());
  }
  const dialogTitled = (title) => screen.getByText(title).parentElement;
  const fieldIn = (panel, label) => within(panel).getByText(label).parentElement.querySelector('input, select');
  const REFUND_LABEL = 'Refund amount (USD) — defaults to what the buyer paid for these items: $30.00';

  it('shows the kind of problem and the linked return case on the flag', async () => {
    await openFlaggedPage({ flagged: [flag()] });
    expect(screen.getByText('Water damage')).toBeInTheDocument();
    expect(screen.getByText(/Return case RC-7/)).toBeInTheDocument();
  });

  it('a flag still waiting for a verdict offers "No fault" and "Real fault…", and no fault panel', async () => {
    await openFlaggedPage({ flagged: [flag()] });
    expect(screen.getByRole('button', { name: /^no fault$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^real fault…$/i })).toBeInTheDocument();
    expect(screen.queryByText('REAL FAULT')).not.toBeInTheDocument();
  });

  it('CRITICAL: "No fault" explains what happens, then records it; the flag leaves the list and the sidebar badge', async () => {
    const calls = [];
    const handlers = [{
      method: 'PATCH', match: /\/hub\/flagged\/335\/resolve$/,
      respond: (body, ctx) => { ctx.setQueue([]); return { body: { id: 335, returnCase: { id: 'RC-7', status: 'rejected', updated: true } } }; },
    }];
    await openFlaggedPage({ flagged: [flag()], handlers, calls });
    const sidebarItem = screen.getAllByText('Flagged Shipments').map((el) => el.closest('button')).find(Boolean);
    await waitFor(() => expect(within(sidebarItem).getByText('1')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /^no fault$/i }));
    expect(screen.getByText(/hub's data was wrong/i)).toBeInTheDocument();
    expect(calls).toHaveLength(0); // nothing sent before confirming
    fireEvent.click(screen.getByRole('button', { name: /confirm: no fault/i }));

    await waitFor(() => expect(screen.getByText(/Recorded as no fault\. Return case RC-7 is now rejected and the buyer was told\./)).toBeInTheDocument());
    expect(calls).toEqual([{ method: 'PATCH', url: expect.stringContaining('/hub/flagged/335/resolve'), body: { resolution: 'continue_processing' } }]);
    await waitFor(() => expect(screen.getByText(/nothing flagged right now/i)).toBeInTheDocument());
    expect(within(sidebarItem).queryByText('1')).not.toBeInTheDocument();
  });

  it('CRITICAL: "Real fault…" lists every item (all ticked), needs at least one, and sends only the ticked ones with the cost bearer', async () => {
    const calls = [];
    const handlers = [{
      method: 'POST', match: /\/fault-cases$/,
      respond: (body, ctx) => { ctx.setQueue([flag({ faultCase: faultCase({ costBearer: body.costBearer }) })]); return { status: 201, body: { faultCase: {} } }; },
    }];
    await openFlaggedPage({ flagged: [flag()], handlers, calls });
    fireEvent.click(screen.getByRole('button', { name: /^real fault…$/i }));
    const dialog = screen.getByRole('dialog', { name: 'Confirm a real fault' });

    const boxes = within(dialog).getAllByRole('checkbox');
    expect(boxes).toHaveLength(2);
    expect(boxes.every((b) => b.checked)).toBe(true);
    expect(within(dialog).getByText(/RIDEX Front Brake Disc × 2/)).toBeInTheDocument();

    // nothing ticked -> cannot confirm
    fireEvent.click(boxes[0]); fireEvent.click(boxes[1]);
    expect(within(dialog).getByRole('button', { name: /confirm real fault/i })).toBeDisabled();

    fireEvent.click(boxes[0]); // only the brake disc is faulty
    fireEvent.change(within(dialog).getByLabelText(/who bears the cost/i), { target: { value: 'leap' } });
    fireEvent.change(within(dialog).getByLabelText(/internal note/i), { target: { value: ' crushed ' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /confirm real fault/i }));

    await waitFor(() => expect(screen.getByText(/Real fault confirmed\. The hub has been asked/)).toBeInTheDocument());
    expect(calls).toEqual([{ method: 'POST', url: expect.stringContaining('/fault-cases'), body: { shipmentId: 335, items: ['p1'], costBearer: 'leap', notes: 'crushed' } }]);
    // the page now shows the case, and the "No fault" / "Real fault" buttons are gone
    expect(await screen.findByText('REAL FAULT')).toBeInTheDocument();
    expect(screen.getByText('Waiting for the supplier')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^no fault$/i })).not.toBeInTheDocument();
  });

  it('the fault panel shows the items, who pays, what the supplier said, and what the hub has done', async () => {
    await openFlaggedPage({ flagged: [flag({ faultCase: faultCase({
      status: 'awaiting_admin', costBearer: 'leap', adminNotes: 'repeat issue',
      supplier: { answered: true, canReplace: true, eta: '2026-08-20', note: 'Stock arrives Monday' }, hubReturn: 'returned',
    }) })] });
    expect(screen.getByText('Supplier answered — your decision')).toBeInTheDocument();
    expect(screen.getByText(/RIDEX Front Brake Disc × 2/)).toBeInTheDocument();
    expect(screen.getByText(/can replace — by 2026-08-20 \(“Stock arrives Monday”\)/)).toBeInTheDocument();
    expect(screen.getByText('Leap')).toBeInTheDocument(); // cost borne by
    expect(screen.getByText('Returned to the supplier')).toBeInTheDocument();
    expect(screen.getByText(/Note: repeat issue/)).toBeInTheDocument();
  });

  it('says plainly when the supplier cannot replace, and when they have not answered yet', async () => {
    await openFlaggedPage({ flagged: [flag({ faultCase: faultCase({ status: 'awaiting_admin', supplier: { answered: true, canReplace: false, eta: null, note: null } }) })] });
    expect(screen.getByText(/cannot replace/)).toBeInTheDocument();
  });

  it('CRITICAL: confirming a real fault WARNS when the supplier has no return address (the hub would not know where to send the unit)', async () => {
    await openFlaggedPage({ flagged: [flag({ supplierReturnAddressOnFile: false })] });
    fireEvent.click(screen.getByRole('button', { name: /^real fault…$/i }));
    const dialog = screen.getByRole('dialog', { name: 'Confirm a real fault' });
    expect(within(dialog).getByText(/no return address/i)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /confirm real fault/i })).toBeEnabled(); // a warning, not a block
  });

  it('no warning when the supplier does have a return address', async () => {
    await openFlaggedPage({ flagged: [flag()] });
    fireEvent.click(screen.getByRole('button', { name: /^real fault…$/i }));
    expect(within(screen.getByRole('dialog', { name: 'Confirm a real fault' })).queryByText(/no return address/i)).not.toBeInTheDocument();
  });

  it('the fault panel shows the return tracking number once the hub sent the unit back, and reminds about a missing address while it has not', async () => {
    await openFlaggedPage({ flagged: [flag({ faultCase: faultCase({ status: 'awaiting_admin', hubReturn: 'returned', hubReturnTracking: 'RET-554433', returnAddressOnFile: true }) })] });
    expect(screen.getByText(/Returned to the supplier — return tracking RET-554433/)).toBeInTheDocument();
    expect(screen.queryByText(/still has no return address/)).not.toBeInTheDocument();
  });

  it('while the unit has not been sent back and the supplier has no address, the panel says the hub cannot tell where to send it', async () => {
    await openFlaggedPage({ flagged: [flag({ faultCase: faultCase({ returnAddressOnFile: false }) })] });
    expect(screen.getByText(/supplier still has no return address on file/)).toBeInTheDocument();
  });

  const SUPPLIER_YES = { answered: true, canReplace: true, eta: '2026-08-20', note: null, answeredAt: '2026-07-20T00:00:00Z' };
  const SUPPLIER_NO = { answered: true, canReplace: false, eta: null, note: 'no stock', answeredAt: '2026-07-20T00:00:00Z' };
  const REPLACE_URL = /\/fault-cases\/9\/confirm-replacement$/;

  it('CRITICAL: "Send a replacement…" is available ONLY once the supplier has said they can replace it, and says why it is not otherwise', async () => {
    await openFlaggedPage({ flagged: [flag({ faultCase: faultCase() })] }); // the supplier has not answered
    const waiting = screen.getByRole('button', { name: /send a replacement/i });
    expect(waiting).toBeDisabled();
    expect(waiting).toHaveAttribute('title', 'The supplier has to say they can replace it first');
  });

  it('...and it stays disabled when the supplier said they cannot replace it (refund is the way forward)', async () => {
    await openFlaggedPage({ flagged: [flag({ faultCase: faultCase({ status: 'awaiting_admin', supplier: SUPPLIER_NO }) })] });
    const button = screen.getByRole('button', { name: /send a replacement/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', 'The supplier said they cannot replace it');
    expect(screen.getByRole('button', { name: /refund the buyer…/i })).toBeEnabled();
  });

  const REPLACE_TITLE = 'Send a replacement — LP-900555';

  it('CRITICAL: once the supplier can replace it, the admin confirms in a dialog that explains the money, and the replacement order is requested', async () => {
    const calls = [];
    const handlers = [{ method: 'POST', match: REPLACE_URL, respond: () => ({ body: { faultCase: { id: 9, replacement: { orderId: 'LP-900555-R1' } }, returnCase: { id: 'RC-7', status: 'approved' } } }) }];
    await openFlaggedPage({ flagged: [flag({ faultCase: faultCase({ status: 'awaiting_admin', supplier: SUPPLIER_YES, costBearer: 'supplier' }) })], handlers, calls });
    const button = screen.getByRole('button', { name: /send a replacement/i });
    expect(button).toBeEnabled();
    fireEvent.click(button);

    const dialog = dialogTitled(REPLACE_TITLE);
    expect(within(dialog).getByText(/free of charge/)).toBeInTheDocument();
    expect(within(dialog).getByText(/LP-900555-R1/)).toBeInTheDocument();
    expect(within(dialog).getByText(/The supplier is at fault, so they bear every cost/)).toBeInTheDocument();
    expect(calls).toHaveLength(0); // nothing is sent until the admin confirms

    fireEvent.click(within(dialog).getByRole('button', { name: /confirm: send a replacement/i }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(await screen.findByText(/Replacement order LP-900555-R1 created/)).toBeInTheDocument();
  });

  it('when LEAP bears the cost, the dialog says the supplier is paid for the replacement', async () => {
    await openFlaggedPage({ flagged: [flag({ faultCase: faultCase({ status: 'awaiting_admin', supplier: SUPPLIER_YES, costBearer: 'leap' }) })] });
    fireEvent.click(screen.getByRole('button', { name: /send a replacement/i }));
    expect(within(dialogTitled(REPLACE_TITLE)).getByText(/Leap bears the cost: the supplier is paid for the replacement/)).toBeInTheDocument();
  });

  // ---- closing a stuck case by hand (migration 098) ----
  const CLOSE_URL = /\/fault-cases\/9\/close$/;
  const CLOSE_TITLE = 'Close case manually — LP-900555';
  const CLOSE_LABEL = 'Why is this case being closed by hand? (required: it is kept on the record, and the buyer is told the case is closed)';

  it('CRITICAL: a case that is still open offers "Close case manually…", and a flag with no case yet does not', async () => {
    await openFlaggedPage({ flagged: [flag({ faultCase: faultCase({ status: 'replacement_pending', outcome: 'replacement', supplier: SUPPLIER_YES }) })] });
    expect(screen.getByRole('button', { name: /close case manually…/i })).toBeEnabled();
  });

  it('a flag still waiting for a verdict has no case to close', async () => {
    await openFlaggedPage({ flagged: [flag()] });
    expect(screen.queryByRole('button', { name: /close case manually…/i })).not.toBeInTheDocument();
  });

  it('CRITICAL: closing sends the written reason (trimmed) and says what happened to the flag and the buyer', async () => {
    const calls = [];
    const handlers = [{ method: 'POST', match: CLOSE_URL, respond: () => ({ body: { faultCase: { id: 9, status: 'completed' }, returnCase: { id: 'RC-7', status: 'completed', updated: true } } }) }];
    await openFlaggedPage({ flagged: [flag({ faultCase: faultCase({ status: 'awaiting_admin', supplier: SUPPLIER_NO }) })], handlers, calls });
    fireEvent.click(screen.getByRole('button', { name: /close case manually…/i }));
    const panel = dialogTitled(CLOSE_TITLE);
    fireEvent.change(fieldIn(panel, CLOSE_LABEL), { target: { value: '  The hub never confirmed the return  ' } });
    expect(calls).toHaveLength(0);
    fireEvent.click(within(panel).getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(screen.getByText('Case closed. The flag has left the queue, and the buyer was told their case is closed.')).toBeInTheDocument());
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toEqual({ note: 'The hub never confirmed the return' });
  });

  it('a refusal from the server (no reason, or a refund still owed) is shown in the dialog and nothing is claimed as closed', async () => {
    const handlers = [{ method: 'POST', match: CLOSE_URL, respond: () => ({ status: 400, body: { error: 'The buyer is expecting a refund that has not been recorded as issued yet. Record it as refunded first, then the case can be closed.' } }) }];
    await openFlaggedPage({ flagged: [flag({ faultCase: faultCase({ status: 'refund_pending', outcome: 'refund', refund: { amount: 30, status: 'pending', reference: null } }) })], handlers });
    fireEvent.click(screen.getByRole('button', { name: /close case manually…/i }));
    const panel = dialogTitled(CLOSE_TITLE);
    fireEvent.click(within(panel).getByRole('button', { name: /^save$/i }));
    expect(await within(panel).findByText(/expecting a refund that has not been recorded as issued yet/)).toBeInTheDocument();
    expect(screen.queryByText(/^Case closed\./)).not.toBeInTheDocument();
  });

  // ---- supplier payment when LEAP bears the cost (migration 097) ----
  const RELEASE_URL = /\/fault-cases\/9\/release-supplier-payment$/;
  const replacementCase = (over = {}) => faultCase({
    status: 'replacement_pending', outcome: 'replacement', supplier: SUPPLIER_YES, costBearer: 'leap',
    replacement: { orderId: 'LP-900555-R1', stage: 'at_hub', createdAt: '2026-07-21T00:00:00Z', deliveredAt: null },
    supplierPayment: { released: false, originalOrder: 41.2, localShipping: null, releasedAt: null, paidOut: false }, ...over,
  });
  const RELEASE_TITLE = 'Release supplier payment — LP-900555';
  const LOCAL_SHIPPING_LABEL = 'Local shipping charges (USD) — what the supplier paid to ship to the hub. Optional; leave empty for none. The original order ($41.20 after commission) is added automatically.';

  it('CRITICAL: when Leap bears the cost and nothing is released yet, the panel says what the supplier is owed and offers "Release supplier payment…"', async () => {
    await openFlaggedPage({ flagged: [flag({ faultCase: replacementCase() })] });
    expect(screen.getByText(/Supplier payment \(Leap bears the cost\):/)).toBeInTheDocument();
    expect(screen.getByText(/the supplier is owed the original order \(\$41\.20 after commission\) plus their local shipping charges\. Not released yet\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /release supplier payment…/i })).toBeEnabled();
  });

  it('CRITICAL: releasing sends the typed local shipping and note, and confirms what was released', async () => {
    const calls = [];
    const released = replacementCase({ supplierPayment: { released: true, originalOrder: 41.2, localShipping: 12.5, releasedAt: '2026-07-22T00:00:00Z', paidOut: false } });
    const handlers = [{ method: 'POST', match: RELEASE_URL, respond: () => ({ body: { faultCase: released } }) }];
    await openFlaggedPage({ flagged: [flag({ faultCase: replacementCase() })], handlers, calls });
    fireEvent.click(screen.getByRole('button', { name: /release supplier payment…/i }));
    const panel = dialogTitled(RELEASE_TITLE);
    fireEvent.change(fieldIn(panel, LOCAL_SHIPPING_LABEL), { target: { value: '12.5' } });
    fireEvent.change(fieldIn(panel, 'Note (optional)'), { target: { value: ' Courier in Guangzhou ' } });
    expect(calls).toHaveLength(0); // nothing is sent until saved
    fireEvent.click(within(panel).getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(screen.getByText("Released: original order $41.20 + local shipping $12.50. It is included in the supplier's next payout.")).toBeInTheDocument());
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toEqual({ localShippingAmount: 12.5, note: 'Courier in Guangzhou' });
  });

  it('leaving the local shipping empty releases just the original order (no shipping amount is sent)', async () => {
    const calls = [];
    const released = replacementCase({ supplierPayment: { released: true, originalOrder: 41.2, localShipping: null, releasedAt: '2026-07-22T00:00:00Z', paidOut: false } });
    const handlers = [{ method: 'POST', match: RELEASE_URL, respond: () => ({ body: { faultCase: released } }) }];
    await openFlaggedPage({ flagged: [flag({ faultCase: replacementCase() })], handlers, calls });
    fireEvent.click(screen.getByRole('button', { name: /release supplier payment…/i }));
    fireEvent.click(within(dialogTitled(RELEASE_TITLE)).getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(screen.getByText("Released: original order $41.20. It is included in the supplier's next payout.")).toBeInTheDocument());
    expect(calls[0].body).toEqual({});
  });

  it('once released, the panel shows exactly what was released and offers no second release; after a payout it says "already paid out"', async () => {
    await openFlaggedPage({ flagged: [flag({ faultCase: replacementCase({ supplierPayment: { released: true, originalOrder: 41.2, localShipping: 12.5, releasedAt: '2026-07-22T00:00:00Z', paidOut: false } }) })] });
    expect(screen.getByText(/released: original order \$41\.20 \+ local shipping \$12\.50, included in the supplier's next payout\./)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /release supplier payment…/i })).not.toBeInTheDocument();
  });

  it('...and after a payout it says so', async () => {
    await openFlaggedPage({ flagged: [flag({ faultCase: replacementCase({ supplierPayment: { released: true, originalOrder: 41.2, localShipping: null, releasedAt: '2026-07-22T00:00:00Z', paidOut: true } }) })] });
    expect(screen.getByText(/released: original order \$41\.20, already paid out\./)).toBeInTheDocument();
  });

  it('CRITICAL: when the SUPPLIER is at fault the panel says they are paid once and bear every other cost, and offers no release', async () => {
    await openFlaggedPage({ flagged: [flag({ faultCase: replacementCase({ costBearer: 'supplier', supplierPayment: null }) })] });
    expect(screen.getByText(/the supplier is at fault, so they are paid once, for the unit the buyer finally receives, and bear every other cost of this fault\. Leap pays them nothing extra\./)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /release supplier payment…/i })).not.toBeInTheDocument();
  });

  it('before a refund or replacement is decided there is no payment section at all', async () => {
    await openFlaggedPage({ flagged: [flag({ faultCase: faultCase({ costBearer: 'leap', status: 'awaiting_admin', supplier: SUPPLIER_YES, supplierPayment: { released: false, originalOrder: 41.2, localShipping: null, releasedAt: null, paidOut: false } }) })] });
    expect(screen.queryByText(/Supplier payment/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /release supplier payment…/i })).not.toBeInTheDocument();
  });

  it('a server refusal of the release is shown in its dialog, and nothing is claimed as released', async () => {
    const handlers = [{ method: 'POST', match: RELEASE_URL, respond: () => ({ status: 409, body: { error: 'The supplier payment for this case has already been released.' } }) }];
    await openFlaggedPage({ flagged: [flag({ faultCase: replacementCase() })], handlers });
    fireEvent.click(screen.getByRole('button', { name: /release supplier payment…/i }));
    const panel = dialogTitled(RELEASE_TITLE);
    fireEvent.click(within(panel).getByRole('button', { name: /^save$/i }));
    expect(await within(panel).findByText('The supplier payment for this case has already been released.')).toBeInTheDocument();
    expect(screen.queryByText(/^Released:/)).not.toBeInTheDocument();
  });

  it.each([
    ['waiting_for_supplier', 'waiting for the supplier to ship it'],
    ['at_hub', 'at the inspection hub'],
    ['shipped_to_buyer', 'shipped to the buyer'],
    ['delivered', 'delivered to the buyer'],
  ])('CRITICAL: a case with a replacement shows the new order and where it is up to (%s), and offers no refund or second replacement', async (stage, text) => {
    const replacement = { orderId: 'LP-900555-R1', stage, createdAt: '2026-07-21T00:00:00Z', deliveredAt: null };
    await openFlaggedPage({ flagged: [flag({ faultCase: faultCase({ status: 'replacement_pending', outcome: 'replacement', supplier: SUPPLIER_YES, replacement }) })] });
    expect(screen.getByText(/order LP-900555-R1/)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(text))).toBeInTheDocument();
    expect(screen.getByText('Replacement on its way')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /refund the buyer…/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /send a replacement/i })).not.toBeInTheDocument();
  });

  it('a server refusal of "No fault" is shown in its dialog too (it used to be swallowed), and the flag stays', async () => {
    const handlers = [{ method: 'PATCH', match: /\/hub\/flagged\/\d+\/resolve$/, respond: () => ({ status: 400, body: { error: 'This shipment already has a fault case: handle it as a real fault.' } }) }];
    await openFlaggedPage({ flagged: [flag()], handlers });
    fireEvent.click(screen.getByRole('button', { name: /^no fault$/i }));
    fireEvent.click(within(dialogTitled('No fault — LP-900555')).getByRole('button', { name: /confirm: no fault/i }));
    expect(await within(dialogTitled('No fault — LP-900555')).findByText('This shipment already has a fault case: handle it as a real fault.')).toBeInTheDocument();
    expect(screen.getByText('LP-900555')).toBeInTheDocument(); // still in the queue
  });

  it('a server refusal is shown in the dialog and nothing is claimed as done', async () => {
    const handlers = [{ method: 'POST', match: REPLACE_URL, respond: () => ({ status: 400, body: { error: 'The supplier said they cannot replace this. Refund the buyer instead.' } }) }];
    await openFlaggedPage({ flagged: [flag({ faultCase: faultCase({ status: 'awaiting_admin', supplier: SUPPLIER_YES }) })], handlers });
    fireEvent.click(screen.getByRole('button', { name: /send a replacement/i }));
    const dialog = dialogTitled(REPLACE_TITLE);
    fireEvent.click(within(dialog).getByRole('button', { name: /confirm: send a replacement/i }));
    expect(await within(dialog).findByText('The supplier said they cannot replace this. Refund the buyer instead.')).toBeInTheDocument();
    expect(screen.queryByText(/Replacement order .* created/)).not.toBeInTheDocument();
  });

  it('CRITICAL: "Refund the buyer…" is pre-filled with the faulty items\' value, and sends the amount the admin settles on', async () => {
    const calls = [];
    const handlers = [{
      method: 'POST', match: /\/fault-cases\/9\/confirm-refund$/,
      respond: (body, ctx) => {
        ctx.setQueue([flag({ faultCase: faultCase({ status: 'refund_pending', refund: { amount: body.amount, status: 'pending', reference: null } }) })]);
        return { body: { faultCase: { refund: { amount: body.amount } }, returnCase: { id: 'RC-7', status: 'approved' } } };
      },
    }];
    await openFlaggedPage({ flagged: [flag({ faultCase: faultCase() })], handlers, calls });
    fireEvent.click(screen.getByRole('button', { name: /refund the buyer…/i }));
    const panel = dialogTitled('Refund the buyer — LP-900555');
    const amount = fieldIn(panel, REFUND_LABEL);
    expect(amount.value).toBe('30.00'); // 2 × $15.00

    fireEvent.change(amount, { target: { value: '25' } });
    fireEvent.click(within(panel).getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(screen.getByText(/Refund of \$25\.00 recorded as pending and the buyer was told/)).toBeInTheDocument());
    expect(calls[0].body).toEqual({ amount: 25 });
    // the page moved on to the next step
    expect(await screen.findByRole('button', { name: /mark as refunded…/i })).toBeInTheDocument();
    expect(screen.getByText('Refund to issue')).toBeInTheDocument();
    expect(screen.getByText(/\$25\.00 — recorded, not yet issued/)).toBeInTheDocument();
  });

  it('CRITICAL: on a discounted order the refund default is what the buyer actually PAID (not the higher list value), shown with its breakdown, and is accepted as-is', async () => {
    const calls = [];
    const handlers = [{
      method: 'POST', match: /\/fault-cases\/9\/confirm-refund$/,
      respond: (body) => ({ body: { faultCase: { refund: { amount: body.amount } }, returnCase: { id: 'RC-7', status: 'approved' } } }),
    }];
    const discounted = faultCase({ refundSuggestion: { orderedValue: 560, discountShare: 16.91, suggested: 543.09, orderTotal: 543.09 } });
    await openFlaggedPage({ flagged: [flag({ faultCase: discounted })], handlers, calls });
    fireEvent.click(screen.getByRole('button', { name: /refund the buyer…/i }));
    const panel = dialogTitled('Refund the buyer — LP-900555');
    const label = 'Refund amount (USD) — defaults to what the buyer paid for these items: $543.09 (ordered $560.00, minus $16.91 discount)';
    const amount = fieldIn(panel, label);
    expect(amount.value).toBe('543.09'); // NOT 560.00, which the server refuses as more than the order total

    fireEvent.click(within(panel).getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].body).toEqual({ amount: 543.09 });
  });

  it('CRITICAL: "Mark as refunded…" records the Stripe/PayPal reference; the case closes once the hub has returned the unit', async () => {
    const calls = [];
    const handlers = [{
      method: 'POST', match: /\/fault-cases\/9\/mark-refunded$/,
      respond: (body, ctx) => { ctx.setQueue([]); return { body: { faultCase: { status: 'completed' } } }; },
    }];
    const pending = faultCase({ status: 'refund_pending', hubReturn: 'returned', refund: { amount: 30, status: 'pending', reference: null } });
    await openFlaggedPage({ flagged: [flag({ faultCase: pending })], handlers, calls });
    fireEvent.click(screen.getByRole('button', { name: /mark as refunded…/i }));
    const panel = dialogTitled('Mark as refunded — LP-900555');
    fireEvent.change(fieldIn(panel, 'Stripe / PayPal refund reference (or a note)'), { target: { value: ' re_3PxABC ' } });
    fireEvent.click(within(panel).getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(screen.getByText('Refund recorded and the case is closed.')).toBeInTheDocument());
    expect(calls[0].body).toEqual({ reference: 're_3PxABC' });
    await waitFor(() => expect(screen.getByText(/nothing flagged right now/i)).toBeInTheDocument());
  });

  it('if the hub has not sent the unit back yet, it says the case will close once they do', async () => {
    const handlers = [{
      method: 'POST', match: /\/fault-cases\/9\/mark-refunded$/,
      respond: () => ({ body: { faultCase: { status: 'refund_pending' } } }),
    }];
    await openFlaggedPage({ flagged: [flag({ faultCase: faultCase({ status: 'refund_pending', refund: { amount: 30, status: 'pending', reference: null } }) })], handlers });
    fireEvent.click(screen.getByRole('button', { name: /mark as refunded…/i }));
    const panel = dialogTitled('Mark as refunded — LP-900555');
    fireEvent.change(fieldIn(panel, 'Stripe / PayPal refund reference (or a note)'), { target: { value: 're_999' } });
    fireEvent.click(within(panel).getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(screen.getByText(/closes once the hub has sent the faulty unit back/)).toBeInTheDocument());
  });

  it('a server refusal (e.g. refund larger than the order) is shown inside the open dialog and nothing changes', async () => {
    const handlers = [{
      method: 'POST', match: /\/fault-cases\/9\/confirm-refund$/,
      respond: () => ({ status: 400, body: { error: 'The refund cannot be more than the order total ($50.00).' } }),
    }];
    await openFlaggedPage({ flagged: [flag({ faultCase: faultCase() })], handlers });
    fireEvent.click(screen.getByRole('button', { name: /refund the buyer…/i }));
    const panel = dialogTitled('Refund the buyer — LP-900555');
    fireEvent.change(fieldIn(panel, REFUND_LABEL), { target: { value: '999' } });
    fireEvent.click(within(panel).getByRole('button', { name: /^save$/i }));
    expect(await within(panel).findByText('The refund cannot be more than the order total ($50.00).')).toBeInTheDocument();
    expect(screen.getByText('Waiting for the supplier')).toBeInTheDocument();
  });

  it('says so when "no fault" finds the return case already finalised by hand', async () => {
    const handlers = [{
      method: 'PATCH', match: /\/hub\/flagged\/335\/resolve$/,
      respond: () => ({ body: { id: 335, returnCase: { id: 'RC-7', status: 'completed', updated: false } } }),
    }];
    await openFlaggedPage({ flagged: [flag()], handlers });
    fireEvent.click(screen.getByRole('button', { name: /^no fault$/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm: no fault/i }));
    await waitFor(() => expect(screen.getByText(/Return case RC-7 was already completed, so it was left as it is\./)).toBeInTheDocument());
  });
});

describe('Evidence photos open full size (mocked fetch, real component tree)', () => {
  it('CRITICAL: clicking a flag photo on the Flagged page opens it enlarged, and it can be closed', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await login();
    fireEvent.click(screen.getByRole('button', { name: /flagged shipments/i }));
    await waitFor(() => expect(screen.getByText('LP-900555')).toBeInTheDocument());

    expect(screen.queryByRole('dialog', { name: 'Photo' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Click to enlarge'));

    const viewer = await screen.findByRole('dialog', { name: 'Photo' });
    expect(within(viewer).getByRole('img').getAttribute('src')).toContain('/uploads/flag-evidence.jpg');
    expect(within(viewer).getByRole('link', { name: 'Open original' }).getAttribute('href')).toContain('/uploads/flag-evidence.jpg');

    fireEvent.click(within(viewer).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog', { name: 'Photo' })).not.toBeInTheDocument();
  });

  it('the hub timeline on the order detail page enlarges its photos the same way', async () => {
    const hubEvents = [{ id: 1, step: 'flagged', createdAt: '2026-07-15T15:17:45.581Z', notes: 'Wrong part received', trackingNumber: null, photos: ['/uploads/timeline-evidence.jpg'], performedBy: 'u_hub' }];
    globalThis.fetch = mockFetchRouter({ hubEvents });
    render(<LeapAdminApp />);
    await login();
    fireEvent.click(screen.getByRole('button', { name: /flagged shipments/i }));
    await waitFor(() => expect(screen.getByText('LP-900555')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /view order/i }));

    fireEvent.click(await screen.findByRole('button', { name: /view evidence \(1\)/i }));
    const photos = await screen.findAllByTitle('Click to enlarge');
    const timelinePhoto = photos.find((el) => el.getAttribute('src').includes('timeline-evidence.jpg'));
    expect(timelinePhoto).toBeTruthy();
    fireEvent.click(timelinePhoto);
    const viewer = await screen.findByRole('dialog', { name: 'Photo' });
    expect(within(viewer).getByRole('img').getAttribute('src')).toContain('timeline-evidence.jpg');
  });
});
