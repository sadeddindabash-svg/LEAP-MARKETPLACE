import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import LeapHubPortalApp from './App';

const HUB_USER = { id: 'hub_staff_dev_seed', email: 'hub@leap.dev', name: 'Mei Lin', role: 'hub_staff', hubId: 'hub_guangzhou' };
const SUMMARY = (status) => ({ id: 42, status, createdAt: '2026-07-14T00:00:00.000Z', updatedAt: '2026-07-14T00:00:00.000Z', subOrderId: 100, orderId: 'LP-200999', supplierName: 'Guangzhou AutoParts Co.', itemCount: 1 });
const DETAIL = (over) => ({
  id: 42, status: 'received', createdAt: '2026-07-14T00:00:00.000Z', updatedAt: '2026-07-14T00:00:00.000Z',
  orderId: 'LP-200999', supplierName: 'Guangzhou AutoParts Co.',
  items: [{ productId: 'p1', name: 'RIDEX Front Brake Disc, Vented 300mm', quantity: 1 }],
  events: [], resolution: null, resolvedAt: null, ...over,
});

// Mocked backend. `detail` overrides the shipment detail; `eventCalls` collects every flag/step POST body.
function mockBackend({ detail = DETAIL(), eventCalls = [] } = {}) {
  return vi.fn((url, options) => {
    const u = String(url);
    const method = options?.method || 'GET';
    const ok = (body, status = 200) => Promise.resolve({ ok: true, status, json: async () => body });
    if (u.includes('/auth/login')) return ok({ token: 'fake.jwt.token', user: HUB_USER });
    if (u.includes('/auth/me')) return ok(HUB_USER);
    if (u.endsWith('/hub/me/shipments')) return ok([SUMMARY(detail.status)]);
    if (u.endsWith('/hub/me/shipments/42')) return ok(detail);
    if (method === 'POST' && u.endsWith('/uploads/product-image')) return ok({ url: '/uploads/evidence.jpg' }, 201);
    if (method === 'POST' && u.endsWith('/hub/me/shipments/42/events')) {
      eventCalls.push(JSON.parse(options.body));
      return ok({ id: 42, status: 'flagged' }, 201);
    }
    return ok({});
  });
}

// Language-independent selectors (the portal defaults to Chinese), like App.test.jsx.
async function loginAndOpenShipment() {
  await waitFor(() => document.getElementById('hub-email'));
  fireEvent.change(document.getElementById('hub-email'), { target: { value: 'hub@leap.dev' } });
  fireEvent.change(document.getElementById('hub-password'), { target: { value: 'hub_dev_password_123' } });
  fireEvent.click(document.querySelector('button[type="submit"]'));
  fireEvent.click(await screen.findByText('LP-200999'));
}

async function openFlagFormAndAttachPhoto() {
  await waitFor(() => screen.getByText('改为标记质量问题'));
  fireEvent.click(screen.getByText('改为标记质量问题'));
  await screen.findByText('标记质量问题');
  const file = new File(['x'], 'evidence.jpg', { type: 'image/jpeg' });
  fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [file] } });
  await waitFor(() => expect(document.querySelector('img[src*="evidence.jpg"]')).toBeInTheDocument());
}

beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('Hub Portal — flagging with an optional kind of problem (mocked fetch, real component tree)', () => {
  it('the flag form offers an optional kind-of-problem dropdown with every kind, empty by default', async () => {
    globalThis.fetch = mockBackend();
    render(<LeapHubPortalApp />);
    await loginAndOpenShipment();
    await waitFor(() => screen.getByText('改为标记质量问题'));
    fireEvent.click(screen.getByText('改为标记质量问题'));

    const select = await screen.findByLabelText('问题类型（可选）');
    expect(select.value).toBe('');
    const labels = Array.from(select.querySelectorAll('option')).map((o) => o.textContent);
    expect(labels).toEqual(['— 请选择 —', '外观损坏', '进水损坏', '缺少配件', '商品错发', '其他']);
  });

  it('CRITICAL: the chosen kind is sent with the flag', async () => {
    const eventCalls = [];
    globalThis.fetch = mockBackend({ eventCalls });
    render(<LeapHubPortalApp />);
    await loginAndOpenShipment();
    await openFlagFormAndAttachPhoto();

    fireEvent.change(screen.getByLabelText('问题类型（可选）'), { target: { value: 'water_damage' } });
    fireEvent.click(screen.getByText('提交标记'));

    await waitFor(() => expect(eventCalls).toHaveLength(1));
    expect(eventCalls[0]).toMatchObject({ step: 'flagged', damageType: 'water_damage', photos: ['/uploads/evidence.jpg'] });
  });

  it('the kind is optional: a flag with none chosen is sent without one', async () => {
    const eventCalls = [];
    globalThis.fetch = mockBackend({ eventCalls });
    render(<LeapHubPortalApp />);
    await loginAndOpenShipment();
    await openFlagFormAndAttachPhoto();
    fireEvent.click(screen.getByText('提交标记'));

    await waitFor(() => expect(eventCalls).toHaveLength(1));
    expect(eventCalls[0].step).toBe('flagged');
    expect(eventCalls[0].damageType).toBeUndefined();
  });
});

describe('Hub Portal — what hub staff see after an admin resolves their flag (mocked fetch, real component tree)', () => {
  it('an unresolved flag still says it is awaiting platform review', async () => {
    globalThis.fetch = mockBackend({ detail: DETAIL({ status: 'flagged' }) });
    render(<LeapHubPortalApp />);
    await loginAndOpenShipment();
    expect(await screen.findByText('此包裹已标记问题，等待平台审核。')).toBeInTheDocument();
  });

  it('CRITICAL: a resolved flag shows the outcome, not "awaiting platform review" forever', async () => {
    globalThis.fetch = mockBackend({ detail: DETAIL({ status: 'flagged', resolution: 'discard', resolvedAt: '2026-07-20T00:00:00.000Z' }) });
    render(<LeapHubPortalApp />);
    await loginAndOpenShipment();
    expect(await screen.findByText('平台已处理：此包裹已作废，不会寄给买家。')).toBeInTheDocument();
    expect(screen.queryByText('此包裹已标记问题，等待平台审核。')).not.toBeInTheDocument();
  });

  it('each terminal outcome has its own message', async () => {
    for (const [resolution, text] of [
      ['return_to_supplier', '平台已处理：此包裹将退回供应商。'],
      ['replacement_requested', '平台已处理：已向供应商申请换货。'],
    ]) {
      globalThis.fetch = mockBackend({ detail: DETAIL({ status: 'flagged', resolution }) });
      const { unmount } = render(<LeapHubPortalApp />);
      await loginAndOpenShipment();
      expect(await screen.findByText(text)).toBeInTheDocument();
      unmount();
      localStorage.clear();
    }
  });

  it('CRITICAL: after a false alarm the shipment is back in the flow and the hub is told why', async () => {
    globalThis.fetch = mockBackend({ detail: DETAIL({ status: 'received', resolution: 'continue_processing' }) });
    render(<LeapHubPortalApp />);
    await loginAndOpenShipment();
    expect(await screen.findByText('平台已审核：未发现问题，请继续处理此包裹。')).toBeInTheDocument();
  });
});

describe('Hub Portal — dealing with a faulty unit after the platform confirms a real fault (mocked fetch, real component tree)', () => {
  const FAULT = (over = {}) => ({ id: 9, items: [{ productId: 'p1', name: 'RIDEX Front Brake Disc', quantity: 2 }], hubReturn: null, needsReturn: true, platformStage: 'reviewing', returnAddress: { contactName: 'Wang Fang', phone: '+86 20 8888 1234', address: 'Building 3, 88 Huangpu Avenue, Tianhe District, Guangzhou 510000' }, ...over });

  async function openFaultShipment(detailOver, options = {}) {
    globalThis.fetch = mockBackend({ detail: DETAIL({ status: 'flagged', faultCase: FAULT(), ...detailOver }), ...options });
    render(<LeapHubPortalApp />);
    await loginAndOpenShipment();
  }
  async function attachPhoto() {
    const file = new File(['x'], 'evidence.jpg', { type: 'image/jpeg' });
    fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [file] } });
    await waitFor(() => expect(document.querySelector('img[src*="evidence.jpg"]')).toBeInTheDocument());
  }

  it('CRITICAL: shows what to send back and both ways to deal with it, instead of "awaiting platform review"', async () => {
    await openFaultShipment();
    expect(await screen.findByText('平台已确认存在质量问题——请处理问题商品')).toBeInTheDocument();
    expect(screen.getByText(/RIDEX Front Brake Disc × 2/)).toBeInTheDocument();
    expect(screen.getByText('退回供应商')).toBeInTheDocument();
    expect(screen.getByText('在仓库销毁')).toBeInTheDocument();
    expect(screen.queryByText('此包裹已标记问题，等待平台审核。')).not.toBeInTheDocument();
    expect(screen.getByText('平台正在等待仓库处理问题商品。')).toBeInTheDocument(); // the platform is waiting for the hub
  });

  it('CRITICAL: returning to the supplier needs a tracking number and a photo, then sends both', async () => {
    const eventCalls = [];
    await openFaultShipment({}, { eventCalls });
    await screen.findByText('平台已确认存在质量问题——请处理问题商品');

    fireEvent.click(screen.getByText('确认已退回供应商'));
    expect(await screen.findByText(/至少需要 1 张凭证照片/)).toBeInTheDocument(); // no photo yet
    await attachPhoto();
    fireEvent.click(screen.getByText('确认已退回供应商'));
    expect(await screen.findByText('退回供应商需要填写退回运单号。')).toBeInTheDocument(); // no tracking yet
    expect(eventCalls).toHaveLength(0);

    fireEvent.change(screen.getByLabelText('退回运单号'), { target: { value: 'RET-554433' } });
    fireEvent.click(screen.getByText('确认已退回供应商'));
    await waitFor(() => expect(eventCalls).toHaveLength(1));
    expect(eventCalls[0]).toMatchObject({ step: 'returned_to_supplier', trackingNumber: 'RET-554433', photos: ['/uploads/evidence.jpg'] });
  });

  it('CRITICAL: shows WHERE to send the unit (the supplier\'s return address) while returning it, and hides that when discarding', async () => {
    await openFaultShipment();
    await screen.findByText('平台已确认存在质量问题——请处理问题商品');
    expect(screen.getByText('Wang Fang')).toBeInTheDocument();
    expect(screen.getByText('+86 20 8888 1234')).toBeInTheDocument();
    expect(screen.getByText(/88 Huangpu Avenue/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '在仓库销毁' })); // discarding here: no address needed
    expect(screen.queryByText('Wang Fang')).not.toBeInTheDocument();
  });

  it('CRITICAL: if the supplier has no return address the hub is told to contact the platform first, and cannot print a label', async () => {
    await openFaultShipment({ faultCase: FAULT({ returnAddress: null }) });
    expect(await screen.findByText('该供应商尚未填写退货地址。请先联系平台，再寄回问题商品。')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '打印退货标签' })).not.toBeInTheDocument();
  });

  it('prints a return label with the address, the order and the contents; only the label is printed; it closes again', async () => {
    const print = vi.fn();
    window.print = print;
    await openFaultShipment();
    await screen.findByText('平台已确认存在质量问题——请处理问题商品');
    fireEvent.click(screen.getByRole('button', { name: '打印退货标签' }));

    const label = await screen.findByRole('dialog', { name: 'Return label' });
    expect(label).toHaveTextContent('RETURN TO SUPPLIER · 退回供应商');
    expect(label).toHaveTextContent('Wang Fang');
    expect(label).toHaveTextContent('+86 20 8888 1234');
    expect(label).toHaveTextContent('88 Huangpu Avenue');
    expect(label).toHaveTextContent('LP-200999');
    expect(label).toHaveTextContent('RIDEX Front Brake Disc × 2');

    fireEvent.click(within(label).getByRole('button', { name: '打印' }));
    expect(print).toHaveBeenCalledTimes(1);
    // the print stylesheet hides everything except the label
    expect(document.querySelector('style').textContent).toContain('#return-label');

    fireEvent.click(within(label).getByRole('button', { name: '关闭' }));
    expect(screen.queryByRole('dialog', { name: 'Return label' })).not.toBeInTheDocument();
  });

  it('discarding at the hub needs a photo but no tracking number', async () => {
    const eventCalls = [];
    await openFaultShipment({}, { eventCalls });
    await screen.findByText('平台已确认存在质量问题——请处理问题商品');
    fireEvent.click(screen.getByRole('button', { name: '在仓库销毁' }));
    expect(screen.queryByLabelText('退回运单号')).not.toBeInTheDocument();
    await attachPhoto();
    fireEvent.click(screen.getByText('确认已销毁'));
    await waitFor(() => expect(eventCalls).toHaveLength(1));
    expect(eventCalls[0]).toMatchObject({ step: 'discarded_at_hub' });
    expect(eventCalls[0].trackingNumber).toBeUndefined();
  });

  it('CRITICAL: once the unit has been sent back, the panel is gone and the hub is told nothing more is needed, and where the platform is', async () => {
    await openFaultShipment({ status: 'returned_to_supplier', faultCase: FAULT({ hubReturn: 'returned', needsReturn: false, platformStage: 'reviewing' }) });
    expect(await screen.findByText('此包裹已退回供应商。仓库无需再做任何操作。')).toBeInTheDocument();
    expect(screen.getByText('平台仍在决定如何处理此案例。')).toBeInTheDocument();
    expect(screen.queryByText('平台已确认存在质量问题——请处理问题商品')).not.toBeInTheDocument();
  });

  it('a discarded unit gets its own banner, and the stage line follows the platform (finalising, then closed)', async () => {
    await openFaultShipment({ status: 'discarded_at_hub', faultCase: FAULT({ hubReturn: 'discarded', needsReturn: false, platformStage: 'finalising' }) });
    expect(await screen.findByText('此包裹已在仓库销毁。仓库无需再做任何操作。')).toBeInTheDocument();
    expect(screen.getByText('平台正在办理收尾事项。')).toBeInTheDocument();
  });

  it('a closed case says so', async () => {
    await openFaultShipment({ status: 'returned_to_supplier', faultCase: FAULT({ hubReturn: 'returned', needsReturn: false, platformStage: 'closed' }) });
    expect(await screen.findByText('此案例已结案。')).toBeInTheDocument();
  });

  it('a flag with NO confirmed fault yet still just says it is awaiting platform review', async () => {
    await openFaultShipment({ faultCase: null });
    expect(await screen.findByText('此包裹已标记问题，等待平台审核。')).toBeInTheDocument();
    expect(screen.queryByText('平台已确认存在质量问题——请处理问题商品')).not.toBeInTheDocument();
  });
});
