import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LeapSupplierPortalApp from './App';

const SUPPLIER_USER = { id: 'supplier_dev_seed', email: 'supplier@leap.dev', name: 'Wei Zhang', role: 'supplier', supplierId: 's1' };
const SUPPLIER_PROFILE = { id: 's1', name: 'Guangzhou AutoParts Co.', country: 'China', contactEmail: 'wei@gz.cn', verificationStatus: 'verified', listingCount: 2, createdAt: '2025-11-02T00:00:00.000Z' };

function mockFetchRouter({ messages = [] } = {}) {
  let thread = [...messages];
  return vi.fn((url, options) => {
    const u = String(url);
    const method = options?.method || 'GET';
    if (u.includes('/auth/login')) return Promise.resolve({ ok: true, json: async () => ({ token: 'fake.jwt.token', user: SUPPLIER_USER }) });
    if (u.includes('/auth/me')) return Promise.resolve({ ok: true, json: async () => SUPPLIER_USER });
    if (u.endsWith('/supplier/me')) return Promise.resolve({ ok: true, json: async () => SUPPLIER_PROFILE });
    if (u.endsWith('/supplier/me/products')) return Promise.resolve({ ok: true, json: async () => [] });
    if (u.endsWith('/supplier/me/overview')) {
      return Promise.resolve({ ok: true, json: async () => ({ totalOrders: 0, pendingOrders: 0, totalListings: 0, pendingReturns: 0, ordersByDay: [], topProducts: [], recentOrders: [] }) });
    }
    if (method === 'POST' && u.endsWith('/supplier-messages/me')) {
      const body = JSON.parse(options.body);
      const newMessage = {
        id: thread.length + 1, supplierId: 's1', senderRole: 'supplier',
        originalText: body.text, originalLanguage: 'zh', translatedText: null, translatedLanguage: 'en',
        translationStatus: 'unavailable', createdAt: new Date().toISOString(),
      };
      thread = [...thread, newMessage];
      return Promise.resolve({ ok: true, status: 201, json: async () => newMessage });
    }
    if (u.endsWith('/supplier-messages/me')) return Promise.resolve({ ok: true, json: async () => thread });
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
}

async function loginAndOpenMessages() {
  await waitFor(() => screen.getByLabelText(/邮箱|email/i));
  fireEvent.change(screen.getByLabelText(/邮箱|email/i), { target: { value: 'supplier@leap.dev' } });
  fireEvent.change(screen.getByLabelText(/密码|password/i), { target: { value: 'supplier_dev_password_123' } });
  fireEvent.click(screen.getByRole('button', { name: /登录|log in/i }));
  await waitFor(() => expect(screen.getAllByText('Guangzhou AutoParts Co.')[0]).toBeInTheDocument());
  fireEvent.click(screen.getByText(/消息中心|messages/i));
}

beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('Supplier Messages page — real bidirectional messaging (mocked fetch, real component tree)', () => {
  it('CRITICAL: renders a real message from admin, translated, with an honest "translation unavailable" note when no real translation exists', async () => {
    globalThis.fetch = mockFetchRouter({
      messages: [
        { id: 1, supplierId: 's1', senderRole: 'admin', originalText: 'Please confirm the brake pad fitment.', originalLanguage: 'en', translatedText: null, translatedLanguage: 'zh', translationStatus: 'unavailable', createdAt: '2026-07-16T00:00:00.000Z' },
      ],
    });
    render(<LeapSupplierPortalApp />);
    await loginAndOpenMessages();

    await waitFor(() => expect(screen.getByText('Please confirm the brake pad fitment.')).toBeInTheDocument());
    expect(screen.getByText(/translation unavailable|自动翻译暂不可用/i)).toBeInTheDocument();
  });

  it('CRITICAL: a real translated admin message shows the translation by default, with a working "show original" toggle', async () => {
    globalThis.fetch = mockFetchRouter({
      messages: [
        { id: 1, supplierId: 's1', senderRole: 'admin', originalText: 'Please confirm the brake pad fitment.', originalLanguage: 'en', translatedText: '请确认刹车片的适配情况。', translatedLanguage: 'zh', translationStatus: 'success', createdAt: '2026-07-16T00:00:00.000Z' },
      ],
    });
    render(<LeapSupplierPortalApp />);
    await loginAndOpenMessages();

    await waitFor(() => expect(screen.getByText('请确认刹车片的适配情况。')).toBeInTheDocument());
    expect(screen.queryByText('Please confirm the brake pad fitment.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText(/show original|显示原文/i));
    await waitFor(() => expect(screen.getByText('Please confirm the brake pad fitment.')).toBeInTheDocument());
  });

  it('CRITICAL: sending a real message calls the real send endpoint and it appears immediately', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapSupplierPortalApp />);
    await loginAndOpenMessages();

    await waitFor(() => screen.getByPlaceholderText(/type a message|输入消息/i));
    fireEvent.change(screen.getByPlaceholderText(/type a message|输入消息/i), { target: { value: '库存充足，随时可以发货' } });
    fireEvent.keyDown(screen.getByPlaceholderText(/type a message|输入消息/i), { key: 'Enter' });

    await waitFor(() => expect(screen.getByText('库存充足，随时可以发货')).toBeInTheDocument());
  });

  it('shows a real empty state when there are no messages yet', async () => {
    globalThis.fetch = mockFetchRouter({ messages: [] });
    render(<LeapSupplierPortalApp />);
    await loginAndOpenMessages();

    await waitFor(() => expect(screen.getByText(/no messages yet|暂无消息/i)).toBeInTheDocument());
  });
});
