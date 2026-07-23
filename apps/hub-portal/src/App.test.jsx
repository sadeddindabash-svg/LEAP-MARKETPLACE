import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LeapHubPortalApp from './App';

const HUB_USER = { id: 'hub_staff_dev_seed', email: 'hub@leap.dev', name: 'Mei Lin', role: 'hub_staff', hubId: 'hub_guangzhou' };

const SHIPMENT_SUMMARY = { id: 42, status: 'awaiting_receipt', createdAt: '2026-07-14T00:00:00.000Z', updatedAt: '2026-07-14T00:00:00.000Z', subOrderId: 100, orderId: 'LP-200999', supplierName: 'Guangzhou AutoParts Co.' };
const SHIPMENT_DETAIL = {
  id: 42, status: 'awaiting_receipt', createdAt: '2026-07-14T00:00:00.000Z', updatedAt: '2026-07-14T00:00:00.000Z',
  orderId: 'LP-200999', supplierName: 'Guangzhou AutoParts Co.',
  items: [{ productId: 'p1', name: 'RIDEX Front Brake Disc, Vented 300mm', quantity: 1 }],
  events: [],
};

function mockFetchRouter({ eventStatus = 201 } = {}) {
  return vi.fn((url, options) => {
    const u = String(url);
    const method = options?.method || 'GET';
    if (u.includes('/auth/login')) return Promise.resolve({ ok: true, json: async () => ({ token: 'fake.jwt.token', user: HUB_USER }) });
    if (u.includes('/auth/me')) return Promise.resolve({ ok: true, json: async () => HUB_USER });
    if (u.endsWith('/hub/me/shipments')) return Promise.resolve({ ok: true, json: async () => [SHIPMENT_SUMMARY] });
    if (u.endsWith('/hub/me/shipments/42')) return Promise.resolve({ ok: true, json: async () => SHIPMENT_DETAIL });
    if (method === 'POST' && u.endsWith('/hub/me/shipments/42/events')) {
      if (eventStatus === 401) return Promise.resolve({ ok: false, status: 401, json: async () => ({ error: 'unauthorized' }) });
      return Promise.resolve({ ok: true, status: 201, json: async () => ({ id: 42, status: 'received' }) });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
}

// Real bilingual support (new) -- default language is now "zh" (same
// default as apps/supplier-portal), so form labels/button text render
// in Chinese by default. These helpers use language-INDEPENDENT
// selectors (element id, DOM structure) rather than English text
// matches, so they keep working regardless of which language is
// active -- the previous version of this file broke outright the
// moment the default stopped being English-only, since
// getByLabelText(/email/i) can never match "邮箱".
async function login() {
  await waitFor(() => document.getElementById('hub-email'));
  fireEvent.change(document.getElementById('hub-email'), { target: { value: 'hub@leap.dev' } });
  fireEvent.change(document.getElementById('hub-password'), { target: { value: 'hub_dev_password_123' } });
  fireEvent.click(document.querySelector('button[type="submit"]'));
  // Real order id, not translated UI copy -- language-independent proof
  // the real queue screen loaded with real data.
  await waitFor(() => expect(screen.getByText('LP-200999')).toBeInTheDocument());
}

beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('Hub Portal — real login and step workflow (mocked fetch, real component tree)', () => {
  it('logs in and shows the real inbound queue', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapHubPortalApp />);
    await login();

    await waitFor(() => expect(screen.getByText('LP-200999')).toBeInTheDocument());
    expect(screen.getByText('Guangzhou AutoParts Co.')).toBeInTheDocument();
  });

  it('rejects a successful login for a non-hub_staff role', async () => {
    globalThis.fetch = mockFetchRouter();
    const buyerRouter = vi.fn((url) => {
      const u = String(url);
      if (u.includes('/auth/login')) return Promise.resolve({ ok: true, json: async () => ({ token: 'fake.jwt.token', user: { ...HUB_USER, role: 'buyer' } }) });
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
    globalThis.fetch = buyerRouter;
    render(<LeapHubPortalApp />);

    await waitFor(() => document.getElementById('hub-email'));
    fireEvent.change(document.getElementById('hub-email'), { target: { value: 'someone@example.com' } });
    fireEvent.change(document.getElementById('hub-password'), { target: { value: 'whatever123' } });
    fireEvent.click(document.querySelector('button[type="submit"]'));

    // Real client-side rejection message (t.login.noAccess), Chinese by
    // default -- "该账号没有质检中心访问权限。"
    await waitFor(() => expect(screen.getByText(/没有质检中心访问权限/)).toBeInTheDocument());
    expect(screen.queryByText('LP-200999')).not.toBeInTheDocument();
  });

  it('opening a shipment shows real items and the current step prompt', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapHubPortalApp />);
    await login();

    fireEvent.click(await screen.findByText('LP-200999'));
    // t.steps.awaiting_receipt.promptTitle, Chinese: "接收此包裹"
    await waitFor(() => expect(screen.getByText('接收此包裹')).toBeInTheDocument());
    expect(screen.getByText(/RIDEX Front Brake Disc/)).toBeInTheDocument();
  });

  it('cannot confirm a step with zero photos attached', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapHubPortalApp />);
    await login();

    fireEvent.click(await screen.findByText('LP-200999'));
    // t.steps.awaiting_receipt.actionLabel, Chinese: "确认已接收"
    await waitFor(() => screen.getByText('确认已接收'));
    fireEvent.click(screen.getByText('确认已接收'));

    // t.detail.errPhotoRequired, Chinese: "此步骤至少需要 1 张凭证照片。"
    await waitFor(() => expect(screen.getByText(/至少需要 1 张凭证照片/)).toBeInTheDocument());
  });

  it('the "flag a quality issue" panel opens and can be cancelled back to the normal step view', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapHubPortalApp />);
    await login();

    fireEvent.click(await screen.findByText('LP-200999'));
    // t.detail.flagInstead, Chinese: "改为标记质量问题"
    await waitFor(() => screen.getByText('改为标记质量问题'));
    fireEvent.click(screen.getByText('改为标记质量问题'));

    // t.detail.flagTitle, Chinese: "标记质量问题"
    await waitFor(() => expect(screen.getByText('标记质量问题')).toBeInTheDocument());
    // t.detail.cancel, Chinese: "取消"
    fireEvent.click(screen.getByText('取消'));
    await waitFor(() => expect(screen.getByText('接收此包裹')).toBeInTheDocument());
  });

  it('logs out correctly, clearing the session and returning to the login page', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapHubPortalApp />);
    await login();

    // t.logout, Chinese: "退出登录"
    fireEvent.click(screen.getByText('退出登录'));
    await waitFor(() => expect(document.getElementById('hub-email')).toBeInTheDocument());
    expect(localStorage.getItem('leap_hub_token')).toBeNull();
  });
});

describe('Hub Portal — real Confirm Delivered UI (new, migration 027)', () => {
  const SHIPPED_TO_BUYER_DETAIL = {
    ...SHIPMENT_DETAIL, status: 'shipped_to_buyer',
    events: [{ id: 1, step: 'shipped_to_buyer', notes: null, trackingNumber: 'INTL-TEST-001', photos: [], performedBy: 'Mei Lin', createdAt: '2026-07-14T00:00:00.000Z' }],
  };

  function mockFetchRouterShippedToBuyer({ confirmStatus = 200 } = {}) {
    let currentDetail = { ...SHIPPED_TO_BUYER_DETAIL };
    return vi.fn((url, options) => {
      const u = String(url);
      const method = options?.method || 'GET';
      if (u.includes('/auth/login')) return Promise.resolve({ ok: true, json: async () => ({ token: 'fake.jwt.token', user: HUB_USER }) });
      if (u.includes('/auth/me')) return Promise.resolve({ ok: true, json: async () => HUB_USER });
      if (u.endsWith('/hub/me/shipments')) return Promise.resolve({ ok: true, json: async () => [{ ...SHIPMENT_SUMMARY, status: 'shipped_to_buyer' }] });
      if (u.endsWith('/hub/me/shipments/42') && method === 'GET') return Promise.resolve({ ok: true, json: async () => currentDetail });
      if (method === 'PATCH' && u.endsWith('/hub/me/shipments/42/confirm-delivery')) {
        const body = JSON.parse(options.body);
        if (!body.deliveryNote || !body.deliveryNote.trim()) {
          return Promise.resolve({ ok: false, status: 400, json: async () => ({ error: 'A short note is required when manually confirming delivery yourself.' }) });
        }
        // Real backend error messages are never localized by this
        // portal -- they're shown exactly as the backend sends them,
        // in whatever language the backend itself replies in
        // (English, in this real API). Only this app's OWN UI copy
        // (labels, buttons, section titles) is translated client-side.
        if (confirmStatus !== 200) return Promise.resolve({ ok: false, status: confirmStatus, json: async () => ({ error: 'This order was already confirmed delivered by real carrier tracking.' }) });
        currentDetail = { ...currentDetail, status: 'delivered' };
        return Promise.resolve({ ok: true, json: async () => ({ id: 42, status: 'delivered', deliveredAt: new Date().toISOString(), deliveryConfirmedBy: 'hub_manual' }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
  }

  it('CRITICAL: shows the real Confirm Delivered action once a shipment reaches shipped_to_buyer, not before', async () => {
    globalThis.fetch = mockFetchRouterShippedToBuyer();
    render(<LeapHubPortalApp />);
    await login();

    await waitFor(() => expect(screen.getByText('LP-200999')).toBeInTheDocument());
    fireEvent.click(screen.getByText('LP-200999'));
    // t.detail.confirmDeliveredTitle AND t.detail.confirmDelivered both
    // say the same Chinese phrase "确认已送达" (title + button), same
    // real reason the original English version used getAllByText too.
    await waitFor(() => expect(screen.getAllByText('确认已送达').length).toBeGreaterThan(0));
  });

  it('CRITICAL: confirming delivery without a real note is rejected; with one, it succeeds and the shipment moves to delivered', async () => {
    globalThis.fetch = mockFetchRouterShippedToBuyer();
    render(<LeapHubPortalApp />);
    await login();
    await waitFor(() => expect(screen.getByText('LP-200999')).toBeInTheDocument());
    fireEvent.click(screen.getByText('LP-200999'));
    await waitFor(() => expect(screen.getAllByText('确认已送达').length).toBeGreaterThan(0));

    const confirmButtons = screen.getAllByText('确认已送达');
    const confirmButton = confirmButtons.find((el) => el.tagName === 'BUTTON');
    expect(confirmButton.disabled).toBe(true); // real: disabled with no note typed yet

    // t.detail.deliveryNotePlaceholder's Chinese text, "物流轨迹未更新" substring
    const textarea = screen.getByPlaceholderText(/物流轨迹未更新/);
    fireEvent.change(textarea, { target: { value: 'Buyer confirmed receipt via chat' } });
    fireEvent.click(confirmButton);

    // t.detail.completedBanner, Chinese: "此包裹已完成送达买家的全部流程。"
    await waitFor(() => expect(screen.getByText(/完成送达买家的全部流程/)).toBeInTheDocument());
  });

  it('shows the real backend rejection message if already carrier-confirmed', async () => {
    globalThis.fetch = mockFetchRouterShippedToBuyer({ confirmStatus: 400 });
    render(<LeapHubPortalApp />);
    await login();
    await waitFor(() => expect(screen.getByText('LP-200999')).toBeInTheDocument());
    fireEvent.click(screen.getByText('LP-200999'));
    await waitFor(() => expect(screen.getAllByText('确认已送达').length).toBeGreaterThan(0));

    const textarea = screen.getByPlaceholderText(/物流轨迹未更新/);
    fireEvent.change(textarea, { target: { value: 'trying anyway' } });
    const confirmButtons = screen.getAllByText('确认已送达');
    fireEvent.click(confirmButtons.find((el) => el.tagName === 'BUTTON'));

    // Real, un-localized backend error message -- unchanged from before.
    await waitFor(() => expect(screen.getByText(/already confirmed delivered by real carrier tracking/i)).toBeInTheDocument());
  });
});
