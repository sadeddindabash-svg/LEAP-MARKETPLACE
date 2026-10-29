import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import LeapSupplierPortalApp from './App';

// The supplier picks the vehicle in three steps, Brand, then Model, then Year (the same sequence as the admin's Vehicle Data), and sees the photo the admin
// added: the YEAR's once a year is chosen, the brand's before that. Engine, transmission and "generation" are not asked any more. (Mocked fetch, real component tree.)
const SUPPLIER_USER = { id: 'supplier_dev_seed', email: 'supplier@leap.dev', name: 'Wei Zhang', role: 'supplier', supplierId: 's1' };
const SUPPLIER_PROFILE = { id: 's1', name: 'Guangzhou AutoParts Co.', country: 'China', contactEmail: 'wei@gz.cn', verificationStatus: 'verified', listingCount: 2, createdAt: '2025-11-02T00:00:00.000Z' };

const BRANDS = [
  { id: 'b_geely', name: 'Geely', photoUrl: '/uploads/geely.png' },
  { id: 'b_bmw', name: 'BMW', photoUrl: '/uploads/bmw.png' },
  { id: 'b_zeekr', name: 'Zeekr', photoUrl: null },                                                       // a brand without a photo
];
const MODELS = { b_geely: [{ id: 'm_cool', name: 'Coolray' }], b_bmw: [{ id: 'm_1', name: '1 Series' }], b_zeekr: [{ id: 'm_x', name: 'X' }] };
const YEARS = {
  m_cool: [
    { id: 'g_2023', name: '2023', yearStart: 2023, yearEnd: 2023, photoUrl: '/uploads/y2023.jpg' },        // a year WITH its photo
    { id: 'g_2021', name: '2021', yearStart: 2021, yearEnd: 2021, photoUrl: null },                        // a year without one (old data)
  ],
  m_1: [{ id: 'g_f20', name: 'F20', yearStart: 2015, yearEnd: 2019, photoUrl: '/uploads/f20.jpg' }],      // an older entry: a name and a range
  m_x: [{ id: 'g_x2022', name: '2022', yearStart: 2022, yearEnd: 2022, photoUrl: null }],
};

const VERSIONS = {
  g_2023: [
    { id: 'v_rwd', name: 'Premium RWD', nameZh: '高配后驱', engine: '1 motor', seats: 5 },
    { id: 'v_awd', name: 'Performance AWD', nameZh: '性能四驱', engine: '2 motors', seats: 5 },
    { id: 'v_exc', name: 'Excellence AWD', nameZh: '旗舰四驱', engine: '2 motors', seats: 5 },
  ],
  g_2021: [],      // a car whose generation has no versions in the catalogue
};

function mockServer(created = [], { versionsFail = false } = {}) {
  const ok = (body, status = 200) => Promise.resolve({ ok: true, status, json: async () => body });
  return vi.fn((url, options) => {
    const u = String(url).replace(/^https?:\/\/[^/]+/, '');
    const method = options?.method || 'GET';
    if (u.includes('/auth/login')) return ok({ token: 'fake.jwt.token', user: SUPPLIER_USER });
    if (u.includes('/auth/me')) return ok(SUPPLIER_USER);
    if (u.endsWith('/supplier/me/overview')) return ok({ totalOrders: 0, pendingOrders: 0, totalListings: 0, pendingReturns: 0, ordersByDay: [], topProducts: [], recentOrders: [] });
    if (method === 'POST' && u.endsWith('/supplier/me/products')) { created.push(JSON.parse(options.body)); return ok({ id: 'p_new', status: 'pending' }, 201); }
    if (u.endsWith('/supplier/me/products')) return ok([]);
    if (u.endsWith('/supplier/me/products/drafts')) return ok([]);
    if (u.endsWith('/supplier/me')) return ok(SUPPLIER_PROFILE);
    if (u.endsWith('/catalog/product-requirements')) return ok({ minPhotos: 0, photosRequired: false, videoRequired: false, maxVideoDurationSeconds: 8 });
    if (u.endsWith('/catalog/categories')) return ok([{ id: 'brake', nameEn: 'Brake System', nameAr: null, sortOrder: 10 }]);
    if (u.endsWith('/catalog/categories/brake/parts')) return ok([{ id: 'part_1', categoryId: 'brake', nameEn: 'Front Brake Disc', nameAr: null, sortOrder: 10 }]);
    const versions = u.match(/\/fitment\/generations\/(\w+)\/versions$/); if (versions) return versionsFail ? Promise.resolve({ ok: false, status: 500, json: async () => ({}) }) : ok(VERSIONS[versions[1]] || []);
    if (u.endsWith('/fitment/brands')) return ok(BRANDS);
    const models = u.match(/\/fitment\/brands\/(\w+)\/models$/); if (models) return ok(MODELS[models[1]] || []);
    const years = u.match(/\/fitment\/models\/(\w+)\/generations$/); if (years) return ok(YEARS[years[1]] || []);
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
  await waitFor(() => expect(document.getElementById('vehicle-brand')).not.toBeNull());
  await waitFor(() => expect(within(document.getElementById('vehicle-brand')).getByText('Geely')).toBeInTheDocument());
}
const el = (id) => document.getElementById(id);
const choose = (id, value) => fireEvent.change(el(id), { target: { value } });
async function pick(prefix, brand, model, yearEntry) {
  choose(`${prefix}-brand`, brand);
  await waitFor(() => expect(el(`${prefix}-model`).options.length).toBeGreaterThan(1));
  choose(`${prefix}-model`, model);
  await waitFor(() => expect(el(`${prefix}-year`).options.length).toBeGreaterThan(1));
  if (yearEntry) choose(`${prefix}-year`, yearEntry);
}
// the line under the photo (not a dropdown option that happens to read the same, like "Geely")
const caption = (text) => screen.queryAllByText(text).find((e) => e.tagName !== 'OPTION');
const photoImg = () => document.querySelector('img[alt]:not([alt=""])');
const chip = () => screen.queryByText(/^(year photo|年份照片|brand photo|品牌照片)$/i);
const fieldInput = (labelRegex) => screen.getByText(labelRegex).parentElement.querySelector('input');
async function fillTheRestAndSubmit() {
  fireEvent.change(fieldInput(/^(商品名称（中文）|Product name \(Chinese\))$/), { target: { value: '前刹车盘' } });
  fireEvent.change(fieldInput(/^(OEM 编号|OEM Number)$/), { target: { value: 'OEM-1' } });
  fireEvent.change(fieldInput(/^(价格 \(¥ 人民币\)|Price \(¥ RMB\))$/), { target: { value: '120' } });
  fireEvent.change(fieldInput(/^(重量 \(kg\)|Weight \(kg\))$/), { target: { value: '4.5' } });
  fireEvent.change(fieldInput(/^(长度 \(cm\)|Length \(cm\))$/), { target: { value: '30' } });
  fireEvent.change(fieldInput(/^(宽度 \(cm\)|Width \(cm\))$/), { target: { value: '30' } });
  fireEvent.change(fieldInput(/^(高度 \(cm\)|Height \(cm\))$/), { target: { value: '5' } });
  fireEvent.click(screen.getByRole('button', { name: /提交平台审核|submit for platform review/i }));
}

beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

const step = () => screen.queryByTestId('versions-step');
const tick = (id) => fireEvent.click(screen.getByTestId(`version-${id}`));
const bodies = (created) => created.map((b) => b.fitment);

describe('Add product: the optional Versions step after the year (mocked fetch, real component tree)', () => {
  it('CRITICAL: a car whose generation has versions shows the step AFTER the year, with "All versions" chosen by default and the versions listed (not chosen yet)', async () => {
    globalThis.fetch = mockServer(); render(<LeapSupplierPortalApp />); await openAddProduct();
    expect(step()).toBeNull();                                         // nothing before a car is chosen
    await pick('vehicle', 'b_geely', 'm_cool', 'g_2023'); expect(step()).toBeNull();      // a year entry alone is not yet a car (the year of a range is chosen next, for a single year it is the car)
    await screen.findByTestId('versions-step'); expect(screen.getByTestId('versions-mode-all').checked).toBe(true); expect(screen.getByTestId('versions-mode-some').checked).toBe(false); expect(screen.queryByTestId('version-v_awd')).toBeNull();
  });
  it('CRITICAL: choosing nothing (the default) sends NO versions: exactly what was sent before this step existed', async () => {
    const created = []; globalThis.fetch = mockServer(created); render(<LeapSupplierPortalApp />); await openAddProduct(); await pick('vehicle', 'b_geely', 'm_cool', 'g_2023'); await screen.findByTestId('versions-step');
    await fillTheRestAndSubmit(); await waitFor(() => expect(created).toHaveLength(1)); expect(created[0].fitment).toEqual({ generationId: 'g_2023', year: 2023 }); expect('versionIds' in created[0].fitment).toBe(false);
  });
  it('CRITICAL: "Only some versions" lists them with engine and seats; the ticked ones are sent as versionIds', async () => {
    const created = []; globalThis.fetch = mockServer(created); render(<LeapSupplierPortalApp />); await openAddProduct(); await pick('vehicle', 'b_geely', 'm_cool', 'g_2023'); await screen.findByTestId('versions-step');
    fireEvent.click(screen.getByTestId('versions-mode-some')); const awd = await screen.findByTestId('version-v_awd'); expect(awd.closest('label')).toHaveTextContent(/Performance AWD|性能四驱/); expect(awd.closest('label')).toHaveTextContent('2 motors'); expect(awd.closest('label')).toHaveTextContent(/5 seats|5 座/);
    tick('v_awd'); tick('v_exc'); expect(screen.getByTestId('version-v_rwd').checked).toBe(false); await fillTheRestAndSubmit(); await waitFor(() => expect(created).toHaveLength(1)); expect(created[0].fitment).toEqual({ generationId: 'g_2023', year: 2023, versionIds: ['v_awd', 'v_exc'] });
  });
  it('"Only some versions" with none ticked cannot be submitted (it says so, and nothing is sent); ticking one fixes it', async () => {
    const created = []; globalThis.fetch = mockServer(created); render(<LeapSupplierPortalApp />); await openAddProduct(); await pick('vehicle', 'b_geely', 'm_cool', 'g_2023'); await screen.findByTestId('versions-step'); fireEvent.click(screen.getByTestId('versions-mode-some'));
    await fillTheRestAndSubmit(); expect(await screen.findByText(/at least one version|至少一个车型版本/)).toBeInTheDocument(); expect(created).toHaveLength(0);
    await screen.findByTestId('version-v_rwd'); tick('v_rwd'); await fillTheRestAndSubmit(); await waitFor(() => expect(created).toHaveLength(1)); expect(created[0].fitment.versionIds).toEqual(['v_rwd']);
  });
  it('going back to "All versions" after ticking sends no versions, and ticking a version again after un-ticking removes it', async () => {
    const created = []; globalThis.fetch = mockServer(created); render(<LeapSupplierPortalApp />); await openAddProduct(); await pick('vehicle', 'b_geely', 'm_cool', 'g_2023'); await screen.findByTestId('versions-step'); fireEvent.click(screen.getByTestId('versions-mode-some')); await screen.findByTestId('version-v_awd'); tick('v_awd'); tick('v_awd'); tick('v_rwd'); expect(screen.getByTestId('version-v_awd').checked).toBe(false);
    fireEvent.click(screen.getByTestId('versions-mode-all')); expect(screen.queryByTestId('version-v_awd')).toBeNull(); await fillTheRestAndSubmit(); await waitFor(() => expect(created).toHaveLength(1)); expect('versionIds' in created[0].fitment).toBe(false);
  });
  it('a car whose generation has NO versions shows a grey note and nothing to choose; the product is sent as before', async () => {
    const created = []; globalThis.fetch = mockServer(created); render(<LeapSupplierPortalApp />); await openAddProduct(); await pick('vehicle', 'b_geely', 'm_cool', 'g_2021'); const none = await screen.findByTestId('versions-none'); expect(none).toHaveTextContent(/No versions are listed|暂无版本信息/); expect(screen.queryByTestId('versions-mode-some')).toBeNull();
    await fillTheRestAndSubmit(); await waitFor(() => expect(created).toHaveLength(1)); expect(created[0].fitment).toEqual({ generationId: 'g_2021', year: 2021 });
  });
  it('the versions could not be loaded: it is treated as "no versions" (the supplier can still add the product)', async () => {
    const created = []; globalThis.fetch = mockServer(created, { versionsFail: true }); render(<LeapSupplierPortalApp />); await openAddProduct(); await pick('vehicle', 'b_geely', 'm_cool', 'g_2023'); expect(await screen.findByTestId('versions-none')).toBeInTheDocument(); await fillTheRestAndSubmit(); await waitFor(() => expect(created).toHaveLength(1)); expect('versionIds' in created[0].fitment).toBe(false);
  });
  it('CRITICAL: choosing another car starts the step over (the ticked versions of the first car are never sent for the second)', async () => {
    const created = []; globalThis.fetch = mockServer(created); render(<LeapSupplierPortalApp />); await openAddProduct(); await pick('vehicle', 'b_geely', 'm_cool', 'g_2023'); await screen.findByTestId('versions-step'); fireEvent.click(screen.getByTestId('versions-mode-some')); await screen.findByTestId('version-v_awd'); tick('v_awd');
    choose('vehicle-year', 'g_2021'); await screen.findByTestId('versions-none'); choose('vehicle-year', 'g_2023'); await screen.findByTestId('versions-step'); expect(screen.getByTestId('versions-mode-all').checked).toBe(true); expect(screen.queryByTestId('version-v_awd')).toBeNull();
    await fillTheRestAndSubmit(); await waitFor(() => expect(created).toHaveLength(1)); expect('versionIds' in created[0].fitment).toBe(false);
  });
  it('in English the step is in English; in Chinese it is in Chinese with the Chinese version names', async () => {
    globalThis.fetch = mockServer(); render(<LeapSupplierPortalApp />); await openAddProduct(); await pick('vehicle', 'b_geely', 'm_cool', 'g_2023'); const box = await screen.findByTestId('versions-step'); expect(box).toHaveTextContent(/车型版本（可选）/); fireEvent.click(screen.getByTestId('versions-mode-some')); await screen.findByTestId('version-v_awd'); expect(screen.getByTestId('version-v_awd').closest('label')).toHaveTextContent('性能四驱');
    fireEvent.click(screen.getByRole('button', { name: 'EN' })); await waitFor(() => expect(screen.getByTestId('versions-step')).toHaveTextContent('Versions (optional)')); expect(screen.getByTestId('version-v_awd').closest('label')).toHaveTextContent('Performance AWD');
  });
});
