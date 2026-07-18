import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LeapSupplierPortalApp from './App';

const SUPPLIER_USER = { id: 'supplier_dev_seed', email: 'supplier@leap.dev', name: 'Wei Zhang', role: 'supplier', supplierId: 's1' };
const SUPPLIER_PROFILE = { id: 's1', name: 'Guangzhou AutoParts Co.', country: 'China', contactEmail: 'wei@gz.cn', verificationStatus: 'verified', listingCount: 2, createdAt: '2025-11-02T00:00:00.000Z' };

const MOCK_BRANDS = [{ id: 'b1', name: 'BMW' }];
const MOCK_MODELS = [{ id: 'm1', name: '1 Series' }];
const MOCK_GENERATIONS = [{ id: 'g1', name: 'F20', yearStart: 2015, yearEnd: 2019 }];

const MOCK_DRAFTS = [
  { id: 'p1', name: '前刹车盘', oemNumber: 'BI-1', price: 200, category: 'brake', part: 'Front Brake Disc', position: 'Front', weightKg: 5, images: [], missing: ['photos'] },
  { id: 'p2', name: '后刹车盘', oemNumber: 'BI-2', price: 180, category: null, part: null, position: null, weightKg: null, images: [], missing: ['category', 'part', 'position', 'dimensions', 'photos'] },
];

function mockFetchRouter({ drafts = MOCK_DRAFTS, capturedRequests = [] } = {}) {
  let currentDrafts = [...drafts];
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
    if (u.endsWith('/supplier/me/products/drafts')) return Promise.resolve({ ok: true, json: async () => currentDrafts });
    if (method === 'PATCH' && u.match(/\/supplier\/me\/products\/.+\/complete$/)) {
      const id = u.split('/').slice(-2)[0];
      capturedRequests.push(JSON.parse(options.body));
      currentDrafts = currentDrafts.filter((d) => d.id !== id);
      return Promise.resolve({ ok: true, json: async () => ({ id, status: 'translating' }) });
    }
    if (u.endsWith('/catalog/categories')) return Promise.resolve({ ok: true, json: async () => [{ id: 'brake', nameEn: 'Brake System' }, { id: 'filters', nameEn: 'Filters' }] });
    if (u.endsWith('/catalog/categories/brake/parts')) return Promise.resolve({ ok: true, json: async () => [{ nameEn: 'Front Brake Disc' }, { nameEn: 'Rear Brake Disc' }] });
    if (u.endsWith('/catalog/categories/filters/parts')) return Promise.resolve({ ok: true, json: async () => [{ nameEn: 'Air Filter' }, { nameEn: 'Oil Filter' }] });
    if (u.endsWith('/fitment/brands')) return Promise.resolve({ ok: true, json: async () => MOCK_BRANDS });
    if (u.endsWith('/fitment/brands/b1/models')) return Promise.resolve({ ok: true, json: async () => MOCK_MODELS });
    if (u.endsWith('/fitment/models/m1/generations')) return Promise.resolve({ ok: true, json: async () => MOCK_GENERATIONS });
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
}

async function loginAndGoToProducts() {
  await waitFor(() => screen.getByLabelText(/邮箱|email/i));
  fireEvent.change(screen.getByLabelText(/邮箱|email/i), { target: { value: 'supplier@leap.dev' } });
  fireEvent.change(screen.getByLabelText(/密码|password/i), { target: { value: 'supplier_dev_password_123' } });
  fireEvent.click(screen.getByRole('button', { name: /登录|log in/i }));
  await waitFor(() => expect(screen.getAllByText('Guangzhou AutoParts Co.')[0]).toBeInTheDocument());
  fireEvent.click(screen.getByText(/商品管理|products/i));
  await waitFor(() => screen.getByText(/待完善|my drafts/i));
}

beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('Real supplier bulk upload / drafts UI (mocked fetch, full component tree)', () => {
  it('CRITICAL: My Drafts shows real drafts with their real missing fields', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapSupplierPortalApp />);
    await loginAndGoToProducts();

    fireEvent.click(screen.getByText(/待完善|my drafts/i));
    await waitFor(() => screen.getByText('前刹车盘'));
    expect(screen.getByText((content) => content.includes('BI-1') && content.includes('photos'))).toBeInTheDocument();
    expect(screen.getByText('后刹车盘')).toBeInTheDocument();
  });

  it('CRITICAL: a fully-matched draft only shows the photo upload step, not category/part/position/dimension fields', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapSupplierPortalApp />);
    await loginAndGoToProducts();

    fireEvent.click(screen.getByText(/待完善|my drafts/i));
    await waitFor(() => screen.getByText('前刹车盘'));
    const completeButtons = screen.getAllByRole('button', { name: /完善|complete/i });
    fireEvent.click(completeButtons[0]);

    await waitFor(() => screen.getByText(/product photos|商品照片/i));
    expect(screen.queryByText(/^category$|^分类$/i)).not.toBeInTheDocument();
  });

  it('CRITICAL: a minimal draft shows all the real missing fields, including category/part/position/dimensions', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapSupplierPortalApp />);
    await loginAndGoToProducts();

    fireEvent.click(screen.getByText(/待完善|my drafts/i));
    await waitFor(() => screen.getByText('后刹车盘'));

    const completeButtons = screen.getAllByRole('button', { name: /完善|complete/i });
    fireEvent.click(completeButtons[1]); // 后刹车盘 is the second draft in the array

    await waitFor(() => expect(screen.getByText(/^category$|^分类$/i)).toBeInTheDocument());
    expect(screen.getByText(/^position$|^位置$/i)).toBeInTheDocument();
    expect(screen.getByText(/weight kg|重量/i)).toBeInTheDocument();
  });

  it('CRITICAL: switching Category resets the real Part selection to a valid option for the NEW category, never submitting a stale mismatched pair', async () => {
    const capturedRequests = [];
    globalThis.fetch = mockFetchRouter({ capturedRequests });
    render(<LeapSupplierPortalApp />);
    await loginAndGoToProducts();

    fireEvent.click(screen.getByText(/待完善|my drafts/i));
    await waitFor(() => screen.getByText('后刹车盘'));
    const completeButtons = screen.getAllByRole('button', { name: /完善|complete/i });
    fireEvent.click(completeButtons[1]); // 后刹车盘 is the second draft in the array

    await waitFor(() => expect(screen.getByText('Front Brake Disc')).toBeInTheDocument());

    // Real category dropdown defaults to Brake System, with a real
    // Brake part auto-selected. Now switch to Filters.
    const categorySelect = screen.getByText('Brake System').closest('select');
    fireEvent.change(categorySelect, { target: { value: 'filters' } });

    // The real bug: without the fix, the Part dropdown would still show
    // "Front Brake Disc" -- a real part that does NOT belong to Filters.
    await waitFor(() => expect(screen.getByText('Air Filter')).toBeInTheDocument());
    expect(screen.queryByText('Front Brake Disc')).not.toBeInTheDocument();

    // Submitting now should send a genuinely matching category+part pair.
    const submitButtons = screen.getAllByText(/提交审核|submit for review/i);
    fireEvent.click(submitButtons[0]);

    await waitFor(() => expect(capturedRequests.length).toBe(1));
    expect(capturedRequests[0].category).toBe('filters');
    expect(['Air Filter', 'Oil Filter']).toContain(capturedRequests[0].part);
  });

  it('the vehicle picker cascade in Bulk Upload works the same real way as the single-product form', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapSupplierPortalApp />);
    await loginAndGoToProducts();

    fireEvent.click(screen.getByText(/批量上传|bulk upload/i));
    await waitFor(() => screen.getByText('BMW'));

    const selects = screen.getAllByDisplayValue(/select…|请选择/i);
    fireEvent.change(selects[0], { target: { value: 'b1' } }); // Brand is the first real select in the cascade
    await waitFor(() => expect(screen.getByText('1 Series')).toBeInTheDocument());
  });
});
