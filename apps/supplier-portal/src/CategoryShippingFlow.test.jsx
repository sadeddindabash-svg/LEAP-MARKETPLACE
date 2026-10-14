import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import LeapSupplierPortalApp from './App';

// When the admin has set a category's weight and package size (backend migration 103), the supplier enters none of the four for products in it; in a category that
// has none yet the supplier still enters them, as before. Both the Add product form and the form that finishes a draft. (Mocked fetch, real component tree.)
const SUPPLIER_USER = { id: 'supplier_dev_seed', email: 'supplier@leap.dev', name: 'Wei Zhang', role: 'supplier', supplierId: 's1' };
const SUPPLIER_PROFILE = { id: 's1', name: 'Guangzhou AutoParts Co.', country: 'China', contactEmail: 'wei@gz.cn', verificationStatus: 'verified', listingCount: 2, createdAt: '2025-11-02T00:00:00.000Z' };

const CATEGORIES = [
  { id: 'brake', nameEn: 'Brake System', nameAr: null, sortOrder: 10, weightKg: 5, lengthCm: 30, widthCm: 30, heightCm: 5 },       // set by the admin
  { id: 'lighting', nameEn: 'Lighting', nameAr: null, sortOrder: 20, weightKg: null, lengthCm: null, widthCm: null, heightCm: null },   // none yet
];
const PARTS = { brake: [{ id: 'part_1', categoryId: 'brake', nameEn: 'Front Brake Disc', nameAr: null, sortOrder: 10 }], lighting: [{ id: 'part_2', categoryId: 'lighting', nameEn: 'Headlight', nameAr: null, sortOrder: 10 }] };
const DRAFT = { id: 'd1', oemNumber: 'OEM-D1', name: '草稿商品测试名称', nameZh: '草稿商品测试名称', category: null, part: null, position: null, weightKg: null, lengthCm: null, widthCm: null, heightCm: null, images: [], videoUrl: null, missing: ['category', 'part', 'position', 'dimensions'] };

function mockServer({ created = [], completed = [] } = {}) {
  const ok = (body, status = 200) => Promise.resolve({ ok: true, status, json: async () => body });
  return vi.fn((url, options) => {
    const u = String(url).replace(/^https?:\/\/[^/]+/, '');
    const method = options?.method || 'GET';
    if (u.includes('/auth/login')) return ok({ token: 'fake.jwt.token', user: SUPPLIER_USER });
    if (u.includes('/auth/me')) return ok(SUPPLIER_USER);
    if (u.endsWith('/supplier/me/overview')) return ok({ totalOrders: 0, pendingOrders: 0, totalListings: 0, pendingReturns: 0, ordersByDay: [], topProducts: [], recentOrders: [] });
    if (method === 'POST' && u.endsWith('/supplier/me/products')) { created.push(JSON.parse(options.body)); return ok({ id: 'p_new', status: 'pending' }, 201); }
    if (method === 'PATCH' && u.endsWith('/supplier/me/products/d1/complete')) { completed.push(JSON.parse(options.body)); return ok({ id: 'd1', status: 'translating' }); }
    if (u.endsWith('/supplier/me/products/drafts')) return ok([DRAFT]);
    if (u.endsWith('/supplier/me/products')) return ok([]);
    if (u.endsWith('/supplier/me')) return ok(SUPPLIER_PROFILE);
    if (u.endsWith('/catalog/product-requirements')) return ok({ minPhotos: 0, photosRequired: false, videoRequired: false, maxVideoDurationSeconds: 8 });
    if (u.endsWith('/catalog/categories')) return ok(CATEGORIES);
    const parts = u.match(/\/catalog\/categories\/(\w+)\/parts$/); if (parts) return ok(PARTS[parts[1]] || []);
    if (u.endsWith('/fitment/brands')) return ok([{ id: 'b1', name: 'Geely', photoUrl: null }]);
    if (u.match(/\/fitment\/brands\/b1\/models$/)) return ok([{ id: 'm1', name: 'Coolray' }]);
    if (u.match(/\/fitment\/models\/m1\/generations$/)) return ok([{ id: 'g1', name: '2021', yearStart: 2021, yearEnd: 2021, photoUrl: null }]);
    return ok({});
  });
}

async function login() {
  await waitFor(() => screen.getByLabelText(/邮箱|email/i));
  fireEvent.change(screen.getByLabelText(/邮箱|email/i), { target: { value: 'supplier@leap.dev' } });
  fireEvent.change(screen.getByLabelText(/密码|password/i), { target: { value: 'supplier_dev_password_123' } });
  fireEvent.click(screen.getByRole('button', { name: /登录|log in/i }));
  await waitFor(() => expect(screen.getAllByText('Guangzhou AutoParts Co.')[0]).toBeInTheDocument());
  fireEvent.click(screen.getByText(/商品管理|products/i));
}
async function openAddProduct() {
  await login();
  await waitFor(() => screen.getByText(/手动添加商品|add product/i));
  fireEvent.click(screen.getByText(/手动添加商品|add product/i));
  await waitFor(() => expect(within(document.getElementById('vehicle-brand')).getByText('Geely')).toBeInTheDocument());
  await waitFor(() => expect(screen.getByText('Brake System')).toBeInTheDocument());        // the first category is chosen by itself
}
const el = (id) => document.getElementById(id);
const choose = (id, value) => fireEvent.change(el(id), { target: { value } });
async function pickVehicle() {
  choose('vehicle-brand', 'b1');
  await waitFor(() => expect(el('vehicle-model').options.length).toBeGreaterThan(1));
  choose('vehicle-model', 'm1');
  await waitFor(() => expect(el('vehicle-year').options.length).toBeGreaterThan(1));
  choose('vehicle-year', 'g1');
}
const categorySelect = () => screen.getAllByText('Brake System').map((e) => e.closest('select')).find(Boolean);
const switchCategory = (id) => fireEvent.change(categorySelect(), { target: { value: id } });
const fieldInput = (labelRegex) => screen.getByText(labelRegex).parentElement.querySelector('input');
const WEIGHT = /^(重量 \(kg\)|Weight \(kg\))$/, LENGTH = /^(长度 \(cm\)|Length \(cm\))$/, WIDTH = /^(宽度 \(cm\)|Width \(cm\))$/, HEIGHT = /^(高度 \(cm\)|Height \(cm\))$/;
const submit = () => fireEvent.click(screen.getByRole('button', { name: /提交平台审核|submit for platform review/i }));
function fillBasics() {
  fireEvent.change(fieldInput(/^(商品名称（中文）|Product name \(Chinese\))$/), { target: { value: '前刹车盘' } });
  fireEvent.change(fieldInput(/^(OEM 编号|OEM Number)$/), { target: { value: 'OEM-1' } });
  fireEvent.change(fieldInput(/^(价格 \(¥ 人民币\)|Price \(¥ RMB\))$/), { target: { value: '120' } });
}
const block = () => screen.queryByTestId('category-shipping');

beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('Add product: the weight and size come from the category when the admin has set them', () => {
  it('CRITICAL: in a category that has them, the form shows them read-only ("From the category Brake System") and asks for none of the four', async () => {
    globalThis.fetch = mockServer();
    render(<LeapSupplierPortalApp />);
    await openAddProduct();
    expect(block()).not.toBeNull();
    expect(within(block()).getByText(/from the category brake system|来自分类「brake system」/i)).toBeInTheDocument();
    for (const value of ['5 kg', '30 cm', '5 cm']) expect(within(block()).getAllByText(value).length).toBeGreaterThan(0);
    for (const label of [WEIGHT, LENGTH, WIDTH, HEIGHT]) expect(screen.queryByText(label)).not.toBeInTheDocument();       // no inputs for them
  });

  it('CRITICAL: saving there sends none of the four (nothing is asked, nothing is sent), and the vehicle goes as { generationId, year }', async () => {
    const created = [];
    globalThis.fetch = mockServer({ created });
    render(<LeapSupplierPortalApp />);
    await openAddProduct();
    await pickVehicle();
    fillBasics();
    submit();
    await waitFor(() => expect(created).toHaveLength(1));
    expect(created[0].category).toBe('brake');
    for (const key of ['weightKg', 'lengthCm', 'widthCm', 'heightCm']) expect(created[0]).not.toHaveProperty(key);
    expect(created[0].fitment).toEqual({ generationId: 'g1', year: 2021 });
  });

  it('CRITICAL: in a category with none yet the four inputs are shown as before, are required (each named), and are sent as numbers', async () => {
    const created = [];
    globalThis.fetch = mockServer({ created });
    render(<LeapSupplierPortalApp />);
    await openAddProduct();
    switchCategory('lighting');
    await waitFor(() => expect(screen.getByText(WEIGHT)).toBeInTheDocument());
    expect(block()).toBeNull();
    await pickVehicle();
    fillBasics();
    submit();
    expect(await screen.findByText(/please fill in: .*weight.*length.*width.*height|请填写：.*重量.*长度.*宽度.*高度/i)).toBeInTheDocument();
    expect(created).toEqual([]);
    fireEvent.change(fieldInput(WEIGHT), { target: { value: '1.5' } });
    fireEvent.change(fieldInput(LENGTH), { target: { value: '20' } });
    fireEvent.change(fieldInput(WIDTH), { target: { value: '15' } });
    fireEvent.change(fieldInput(HEIGHT), { target: { value: '10' } });
    submit();
    await waitFor(() => expect(created).toHaveLength(1));
    expect(created[0]).toMatchObject({ category: 'lighting', weightKg: 1.5, lengthCm: 20, widthCm: 15, heightCm: 10 });
  });

  it('switching category swaps the inputs and the read-only block both ways; a weight typed for one category is NOT sent for one that has its own', async () => {
    const created = [];
    globalThis.fetch = mockServer({ created });
    render(<LeapSupplierPortalApp />);
    await openAddProduct();
    switchCategory('lighting');
    await waitFor(() => expect(screen.getByText(WEIGHT)).toBeInTheDocument());
    fireEvent.change(fieldInput(WEIGHT), { target: { value: '99' } });
    fireEvent.change(fieldInput(LENGTH), { target: { value: '99' } });
    switchCategory('brake');
    await waitFor(() => expect(block()).not.toBeNull());
    expect(screen.queryByText(WEIGHT)).not.toBeInTheDocument();
    await pickVehicle();
    fillBasics();
    submit();
    await waitFor(() => expect(created).toHaveLength(1));
    expect(created[0]).not.toHaveProperty('weightKg');                         // the 99 typed for Lighting is gone
    expect(created[0]).not.toHaveProperty('lengthCm');
  });

  it('with nothing chosen yet, the "fill in" message for a category that has them does not ask for weight or size', async () => {
    globalThis.fetch = mockServer();
    render(<LeapSupplierPortalApp />);
    await openAddProduct();
    submit();
    const message = await screen.findByText(/please fill in|请填写/i);
    expect(message.textContent).not.toMatch(/weight|length|width|height|重量|长度|宽度|高度/i);
  });
});

describe('Finishing a draft: the same rule', () => {
  async function openDraft() {
    await login();
    await waitFor(() => screen.getByText(/待完善的商品|my drafts/i));
    fireEvent.click(screen.getByText(/待完善的商品|my drafts/i));
    await waitFor(() => screen.getByText(/OEM-D1/));
    fireEvent.click(screen.getByText(/^(完善|Complete)$/));
    await waitFor(() => expect(screen.getByText('Brake System')).toBeInTheDocument());
  }
  const finish = () => fireEvent.click(screen.getAllByRole('button').filter((b) => /完成|提交|submit|save|finish|complete/i.test(b.textContent)).pop());

  it('CRITICAL: a draft whose category has them shows them read-only and asks for none; completing sends none', async () => {
    const completed = [];
    globalThis.fetch = mockServer({ completed });
    render(<LeapSupplierPortalApp />);
    await openDraft();
    expect(block()).not.toBeNull();
    expect(within(block()).getAllByText('5 kg').length).toBeGreaterThan(0);
    expect(screen.queryByText(/^(重量 kg|Weight kg)$/)).not.toBeInTheDocument();
    finish();
    await waitFor(() => expect(completed).toHaveLength(1));
    expect(completed[0]).toMatchObject({ category: 'brake' });
    for (const key of ['weightKg', 'lengthCm', 'widthCm', 'heightCm']) expect(completed[0]).not.toHaveProperty(key);
  });

  it('CRITICAL: choosing a category with none brings the four inputs back, and they are sent as numbers', async () => {
    const completed = [];
    globalThis.fetch = mockServer({ completed });
    render(<LeapSupplierPortalApp />);
    await openDraft();
    fireEvent.change(categorySelect(), { target: { value: 'lighting' } });
    await waitFor(() => expect(screen.getByText(/^(重量 kg|Weight kg)$/)).toBeInTheDocument());
    expect(block()).toBeNull();
    const input = (label) => screen.getByText(label).parentElement.querySelector('input');
    fireEvent.change(input(/^(重量 kg|Weight kg)$/), { target: { value: '2' } });
    fireEvent.change(input(/^(长 cm|Length cm)$/), { target: { value: '10' } });
    fireEvent.change(input(/^(宽 cm|Width cm)$/), { target: { value: '11' } });
    fireEvent.change(input(/^(高 cm|Height cm)$/), { target: { value: '12' } });
    finish();
    await waitFor(() => expect(completed).toHaveLength(1));
    expect(completed[0]).toMatchObject({ category: 'lighting', weightKg: 2, lengthCm: 10, widthCm: 11, heightCm: 12 });
  });
});
