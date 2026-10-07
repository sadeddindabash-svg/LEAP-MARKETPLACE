import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import LeapSupplierPortalApp from './App';

const SUPPLIER_USER = { id: 'supplier_dev_seed', email: 'supplier@leap.dev', name: 'Wei Zhang', role: 'supplier', supplierId: 's1' };
const PROFILE = { id: 's1', name: 'Guangzhou AutoParts Co.', country: 'China', contactEmail: 'wei@gz.cn', verificationStatus: 'verified', listingCount: 2, createdAt: '2026-07-01T00:00:00Z' };

const faultCase = (over = {}) => ({
  id: 9, orderId: 'LP-300100', status: 'awaiting_supplier', createdAt: '2026-07-20T00:00:00Z',
  items: [{ productId: 'p1', name: 'RIDEX Front Brake Disc', quantity: 2 }],
  answered: false, canReplace: null, eta: null, note: null, outcome: null, hubReturn: null, ...over,
});

// Mocked backend. `cases` is what GET /fault-cases/supplier/me returns; answers are recorded in `answers`
// and, like the real server, move the case on to "awaiting_admin".
function mockBackend({ cases = [], answers = [], answerStatus = 200, answerError } = {}) {
  let current = [...cases];
  return vi.fn((url, options) => {
    const u = String(url);
    const method = options?.method || 'GET';
    const ok = (body) => Promise.resolve({ ok: true, status: 200, json: async () => body });
    if (u.includes('/auth/login')) return ok({ token: 'fake.jwt.token', user: SUPPLIER_USER });
    if (u.includes('/auth/me')) return ok(SUPPLIER_USER);
    // These two end in '/supplier/me' too, so they MUST be matched before the profile route below.
    if (u.endsWith('/returns/supplier/me')) return ok([]);
    if (u.endsWith('/fault-cases/supplier/me')) return ok(current);
    if (u.endsWith('/supplier/me')) return ok(PROFILE);
    if (u.endsWith('/supplier/me/overview')) return ok({ totalOrders: 0, pendingOrders: 0, totalListings: 0, pendingReturns: 0, ordersByDay: [], topProducts: [], recentOrders: [] });
    const answerMatch = u.match(/\/fault-cases\/supplier\/me\/(\d+)\/answer$/);
    if (answerMatch && method === 'POST') {
      const body = JSON.parse(options.body);
      answers.push({ id: Number(answerMatch[1]), ...body });
      if (answerStatus !== 200) return Promise.resolve({ ok: false, status: answerStatus, json: async () => ({ error: answerError }) });
      current = current.map((c) => (c.id === Number(answerMatch[1]) ? { ...c, status: 'awaiting_admin', answered: true, canReplace: body.canReplace, eta: body.eta || null, note: body.note || null } : c));
      return ok({ id: Number(answerMatch[1]), status: 'awaiting_admin' });
    }
    return ok({});
  });
}

async function openReturnsPage(options) {
  globalThis.fetch = mockBackend(options);
  render(<LeapSupplierPortalApp />);
  await waitFor(() => screen.getByLabelText(/邮箱|email/i));
  fireEvent.change(screen.getByLabelText(/邮箱|email/i), { target: { value: 'supplier@leap.dev' } });
  fireEvent.change(screen.getByLabelText(/密码|password/i), { target: { value: 'supplier_dev_password_123' } });
  fireEvent.click(screen.getByRole('button', { name: /登录|log in/i }));
  await waitFor(() => expect(screen.getAllByText('Guangzhou AutoParts Co.')[0]).toBeInTheDocument());
  fireEvent.click(screen.getByText(/^(退货\/售后|Returns)$/));
  await screen.findByText('退货 / 售后');
}

beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('Supplier Returns page — replacement requests (mocked fetch, real component tree)', () => {
  it('a supplier with no requests sees no replacement section at all', async () => {
    await openReturnsPage({ cases: [] });
    expect(screen.queryByText('换货请求')).not.toBeInTheDocument();
  });

  it('CRITICAL: an unanswered request shows the order, the faulty items and the question, but no form until a choice is made', async () => {
    await openReturnsPage({ cases: [faultCase()] });
    expect(await screen.findByText('换货请求')).toBeInTheDocument();
    expect(screen.getByText('订单 LP-300100')).toBeInTheDocument();
    expect(screen.getByText(/RIDEX Front Brake Disc × 2/)).toBeInTheDocument();
    expect(screen.getByText('等待您的回复')).toBeInTheDocument();
    expect(screen.getByText('您能否补发替换件？')).toBeInTheDocument();
    expect(screen.queryByLabelText('预计发出日期')).not.toBeInTheDocument();
  });

  it('CRITICAL: answering "yes" needs the date you can send it; then it sends the answer and shows it', async () => {
    const answers = [];
    await openReturnsPage({ cases: [faultCase()], answers });
    await screen.findByText('换货请求');

    fireEvent.click(screen.getByRole('button', { name: '提交回复' })); // nothing chosen yet
    expect(await screen.findByText(/请先选择/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '可以补发' }));
    fireEvent.click(screen.getByRole('button', { name: '提交回复' })); // chose yes, but no date
    expect(await screen.findByText('请选择预计发出日期。')).toBeInTheDocument();
    expect(answers).toHaveLength(0);

    const eta = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
    fireEvent.change(screen.getByLabelText('预计发出日期'), { target: { value: eta } });
    fireEvent.change(screen.getByLabelText('备注（可选）'), { target: { value: ' 库存充足 ' } });
    fireEvent.click(screen.getByRole('button', { name: '提交回复' }));

    await waitFor(() => expect(answers).toHaveLength(1));
    expect(answers[0]).toEqual({ id: 9, canReplace: true, eta, note: '库存充足' });
    // the card now shows their answer, and the form is gone
    expect(await screen.findByText(new RegExp(`您已回复：可以补发，预计 ${eta} 发出`))).toBeInTheDocument();
    expect(screen.getByText('等待平台决定')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '提交回复' })).not.toBeInTheDocument();
  });

  it('answering "no" needs no date and sends just that', async () => {
    const answers = [];
    await openReturnsPage({ cases: [faultCase()], answers });
    await screen.findByText('换货请求');
    fireEvent.click(screen.getByRole('button', { name: '无法补发' }));
    expect(screen.queryByLabelText('预计发出日期')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '提交回复' }));
    await waitFor(() => expect(answers).toHaveLength(1));
    expect(answers[0]).toEqual({ id: 9, canReplace: false });
    expect(await screen.findByText('您已回复：无法补发')).toBeInTheDocument();
  });

  it('a server refusal is shown on the card and the question stays open', async () => {
    await openReturnsPage({ cases: [faultCase()], answerStatus: 400, answerError: 'This question has already been answered.' });
    await screen.findByText('换货请求');
    fireEvent.click(screen.getByRole('button', { name: '无法补发' }));
    fireEvent.click(screen.getByRole('button', { name: '提交回复' }));
    expect(await screen.findByText('This question has already been answered.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '提交回复' })).toBeInTheDocument();
  });

  it('an answered request shows the answer and what happened to the faulty unit, with no form', async () => {
    await openReturnsPage({ cases: [
      faultCase({ id: 1, orderId: 'LP-1', status: 'awaiting_admin', answered: true, canReplace: true, eta: '2026-08-20', note: 'Stock Monday', hubReturn: 'returned' }),
      faultCase({ id: 2, orderId: 'LP-2', status: 'refund_pending', answered: true, canReplace: false, hubReturn: 'discarded' }),
      faultCase({ id: 3, orderId: 'LP-3', status: 'completed', answered: true, canReplace: false, hubReturn: null }),
    ] });
    expect(await screen.findByText(/您已回复：可以补发，预计 2026-08-20 发出 — “Stock Monday”/)).toBeInTheDocument();
    expect(screen.getByText('问题商品已退回给您')).toBeInTheDocument();
    expect(screen.getByText('问题商品已在仓库销毁')).toBeInTheDocument();
    expect(screen.getByText('问题商品尚未退回')).toBeInTheDocument();
    expect(screen.getByText('平台正在为买家退款')).toBeInTheDocument();
    expect(screen.getByText('已结案')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '提交回复' })).not.toBeInTheDocument();
  });

  it('CRITICAL: once the hub has sent the faulty unit back, the supplier is told the return tracking number; a discarded or not-yet-sent unit has none', async () => {
    await openReturnsPage({ cases: [
      faultCase({ id: 1, orderId: 'LP-SENT', status: 'awaiting_admin', answered: true, canReplace: true, eta: '2026-08-20', hubReturn: 'returned', returnTrackingNumber: 'RET-554433' }),
      faultCase({ id: 2, orderId: 'LP-DISC', status: 'awaiting_admin', answered: true, canReplace: false, hubReturn: 'discarded', returnTrackingNumber: null }),
      faultCase({ id: 3, orderId: 'LP-WAIT', status: 'awaiting_admin', answered: true, canReplace: false, hubReturn: null, returnTrackingNumber: null }),
    ] });
    expect(await screen.findByText(/问题商品已退回给您 — 退回运单号: RET-554433/)).toBeInTheDocument();
    expect(screen.getAllByText(/退回运单号/)).toHaveLength(1); // only the unit that was actually sent back
  });

  it('CRITICAL: the supplier sees WHY it was flagged: the kind of problem, the inspector\'s note and the photos', async () => {
    await openReturnsPage({ cases: [faultCase({ evidence: { note: 'Housing cracked on arrival', damageType: 'physical_damage', flaggedAt: '2026-07-20T00:00:00Z', photos: ['/uploads/crack-1.jpg', '/uploads/crack-2.jpg'] } })] });
    expect(await screen.findByText('质检证据')).toBeInTheDocument();
    expect(screen.getByText('外观损坏')).toBeInTheDocument();                       // the kind of problem, translated
    expect(screen.getByText('Housing cracked on arrival')).toBeInTheDocument();     // the inspector's note
    const thumbs = screen.getAllByTitle('点击放大');
    expect(thumbs).toHaveLength(2);
    expect(thumbs[0].getAttribute('src')).toContain('/uploads/crack-1.jpg');
  });

  it('clicking an evidence photo opens it full size, with a link to the original; it closes again', async () => {
    await openReturnsPage({ cases: [faultCase({ evidence: { note: null, damageType: null, flaggedAt: '2026-07-20T00:00:00Z', photos: ['/uploads/crack-1.jpg'] } })] });
    fireEvent.click(await screen.findByTitle('点击放大'));
    const viewer = await screen.findByRole('dialog', { name: 'Photo' });
    expect(within(viewer).getByRole('img').getAttribute('src')).toContain('/uploads/crack-1.jpg');
    expect(within(viewer).getByRole('link', { name: '打开原图' }).getAttribute('href')).toContain('/uploads/crack-1.jpg');
    fireEvent.click(within(viewer).getByRole('button', { name: '关闭' }));
    expect(screen.queryByRole('dialog', { name: 'Photo' })).not.toBeInTheDocument();
  });

  it('the evidence stays visible after the supplier has answered, and says so plainly when the inspector uploaded no photos', async () => {
    await openReturnsPage({ cases: [faultCase({ status: 'awaiting_admin', answered: true, canReplace: false, evidence: { note: 'Wrong part received', damageType: 'wrong_item', flaggedAt: '2026-07-20T00:00:00Z', photos: [] } })] });
    expect(await screen.findByText('Wrong part received')).toBeInTheDocument();
    expect(screen.getByText('商品错发')).toBeInTheDocument();
    expect(screen.getByText('质检员没有上传照片。')).toBeInTheDocument();
    expect(screen.queryByTitle('点击放大')).not.toBeInTheDocument();
  });

  it('a request with no evidence at all (an older case) still renders normally, without an empty evidence box', async () => {
    await openReturnsPage({ cases: [faultCase({ evidence: null })] });
    expect(await screen.findByText('换货请求')).toBeInTheDocument();
    expect(screen.queryByText('质检证据')).not.toBeInTheDocument();
  });

  it('CRITICAL: once a replacement is confirmed, the supplier is told WHICH order to ship, where, and how they are paid; a request without one shows nothing of the kind', async () => {
    await openReturnsPage({ cases: [
      faultCase({ id: 1, orderId: 'LP-900001', status: 'replacement_pending', answered: true, canReplace: true, eta: '2026-08-20', replacementOrderId: 'LP-900001-R1' }),
      faultCase({ id: 2, orderId: 'LP-900002', answered: false, replacementOrderId: null }),
    ] });
    expect(await screen.findByText(/LP-900001-R1/)).toBeInTheDocument();
    expect(screen.getByText(/已确认补发。请在“订单”页发运补发订单 LP-900001-R1/)).toBeInTheDocument();
    expect(screen.getByText(/您按原销售价格获得一次货款/)).toBeInTheDocument();
    expect(screen.getAllByText(/已确认补发/)).toHaveLength(1); // only the case that has one
  });

  it('never shows money or the platform\'s private details to the supplier', async () => {
    await openReturnsPage({ cases: [faultCase({ status: 'refund_pending', answered: true, canReplace: false })] });
    await screen.findByText('换货请求');
    const text = document.body.textContent;
    expect(text).not.toMatch(/\$|USD|refund amount|退款金额|成本|cost/i);
  });
});
