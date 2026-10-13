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

function mockServer(created = []) {
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

describe('Add product: choose the vehicle in three steps and see the admin\'s photo (mocked fetch, real component tree)', () => {
  it('CRITICAL: the picker asks Brand, then Model, then Year, in that order, and nothing else (no generation, engine or transmission)', async () => {
    globalThis.fetch = mockServer();
    render(<LeapSupplierPortalApp />);
    await openAddProduct();
    const labels = ['vehicle-brand', 'vehicle-model', 'vehicle-year'].map((id) => document.querySelector(`label[for="${id}"]`).textContent.replace(/^\d/, ''));
    expect(labels.map((t) => t.toLowerCase())).toEqual(expect.arrayContaining([expect.stringMatching(/brand|品牌/), expect.stringMatching(/model|车型/), expect.stringMatching(/year|年份/)]));
    expect(screen.queryByText(/generation|世代|engine|发动机|transmission|变速箱/i)).not.toBeInTheDocument();
    expect(el('vehicle-model').disabled).toBe(true);                       // each step opens only after the one before it
    expect(el('vehicle-year').disabled).toBe(true);
    choose('vehicle-brand', 'b_geely');
    await waitFor(() => expect(el('vehicle-model').disabled).toBe(false));
    expect(el('vehicle-year').disabled).toBe(true);
    choose('vehicle-model', 'm_cool');
    await waitFor(() => expect(el('vehicle-year').disabled).toBe(false));
  });

  it('CRITICAL: the photo follows the choices: the brand\'s after the brand and the model, the YEAR\'s once a year with a photo is chosen', async () => {
    globalThis.fetch = mockServer();
    render(<LeapSupplierPortalApp />);
    await openAddProduct();
    expect(photoImg()).toBeNull();                                         // nothing chosen yet: just the car icon
    choose('vehicle-brand', 'b_geely');
    await waitFor(() => expect(photoImg()).not.toBeNull());
    expect(photoImg().getAttribute('src')).toContain('/uploads/geely.png');
    expect(chip().textContent).toMatch(/brand photo|品牌照片/i);
    expect(caption('Geely')).toBeTruthy();
    await waitFor(() => expect(el('vehicle-model').options.length).toBeGreaterThan(1));
    choose('vehicle-model', 'm_cool');
    await waitFor(() => expect(screen.getByText('Geely Coolray')).toBeInTheDocument());
    expect(photoImg().getAttribute('src')).toContain('/uploads/geely.png');   // models have no photo: still the brand's
    await waitFor(() => expect(el('vehicle-year').options.length).toBeGreaterThan(1));
    choose('vehicle-year', 'g_2023');
    await waitFor(() => expect(screen.getByText('Geely Coolray, 2023')).toBeInTheDocument());
    expect(photoImg().getAttribute('src')).toContain('/uploads/y2023.jpg');   // the year's own photo
    expect(chip().textContent).toMatch(/year photo|年份照片/i);
  });

  it('CRITICAL: a year with NO photo falls back to the brand photo; a brand and year with none show just the car icon', async () => {
    globalThis.fetch = mockServer();
    render(<LeapSupplierPortalApp />);
    await openAddProduct();
    await pick('vehicle', 'b_geely', 'm_cool', 'g_2021');
    await waitFor(() => expect(screen.getByText('Geely Coolray, 2021')).toBeInTheDocument());
    expect(photoImg().getAttribute('src')).toContain('/uploads/geely.png');
    expect(chip().textContent).toMatch(/brand photo|品牌照片/i);
    await pick('vehicle', 'b_zeekr', 'm_x', 'g_x2022');
    await waitFor(() => expect(screen.getByText('Zeekr X, 2022')).toBeInTheDocument());
    expect(photoImg()).toBeNull();                                          // no photo anywhere: the car icon, and no "photo" label claiming otherwise
    expect(chip()).toBeNull();
  });

  it('CRITICAL: a year entry holds ONE year, so choosing it also chooses the year: there is no "Which year?" question', async () => {
    globalThis.fetch = mockServer();
    render(<LeapSupplierPortalApp />);
    await openAddProduct();
    await pick('vehicle', 'b_geely', 'm_cool', 'g_2023');
    await waitFor(() => expect(screen.getByText('Geely Coolray, 2023')).toBeInTheDocument());
    expect(el('vehicle-which-year')).toBeNull();
    const options = Array.from(el('vehicle-year').options).map((o) => o.textContent);
    expect(options.slice(1)).toEqual(['2023', '2021']);                      // listed as just the year, newest first as the server sends them
  });

  it('CRITICAL: an OLDER entry (a name and a range) is listed with its range and asks "Which year?" within it; the caption names it', async () => {
    globalThis.fetch = mockServer();
    render(<LeapSupplierPortalApp />);
    await openAddProduct();
    await pick('vehicle', 'b_bmw', 'm_1', null);
    expect(Array.from(el('vehicle-year').options).map((o) => o.textContent).slice(1)).toEqual(['F20 (2015–2019)']);
    choose('vehicle-year', 'g_f20');
    await waitFor(() => expect(el('vehicle-which-year')).not.toBeNull());
    expect(Array.from(el('vehicle-which-year').options).map((o) => o.textContent).slice(1)).toEqual(['2015', '2016', '2017', '2018', '2019']);
    expect(screen.getByText('BMW 1 Series F20')).toBeInTheDocument();         // no year yet
    choose('vehicle-which-year', '2017');
    await waitFor(() => expect(screen.getByText('BMW 1 Series F20, 2017')).toBeInTheDocument());
    expect(photoImg().getAttribute('src')).toContain('/uploads/f20.jpg');
  });

  it('changing the brand clears the model and the year, and the photo goes back to the new brand\'s', async () => {
    globalThis.fetch = mockServer();
    render(<LeapSupplierPortalApp />);
    await openAddProduct();
    await pick('vehicle', 'b_geely', 'm_cool', 'g_2023');
    await waitFor(() => expect(screen.getByText('Geely Coolray, 2023')).toBeInTheDocument());
    choose('vehicle-brand', 'b_bmw');
    await waitFor(() => expect(caption('BMW')).toBeTruthy());
    expect(el('vehicle-model').value).toBe('');
    expect(el('vehicle-year').value).toBe('');
    expect(el('vehicle-year').disabled).toBe(true);
    expect(photoImg().getAttribute('src')).toContain('/uploads/bmw.png');
  });

  it('CRITICAL: saving sends only the year entry and the year: { generationId, year }, no engine, no transmission', async () => {
    const created = [];
    globalThis.fetch = mockServer(created);
    render(<LeapSupplierPortalApp />);
    await openAddProduct();
    await pick('vehicle', 'b_geely', 'm_cool', 'g_2023');
    await waitFor(() => expect(screen.getByText('Geely Coolray, 2023')).toBeInTheDocument());
    await fillTheRestAndSubmit();
    await waitFor(() => expect(created).toHaveLength(1));
    expect(created[0].fitment).toEqual({ generationId: 'g_2023', year: 2023 });
    expect(Object.keys(created[0].fitment).sort()).toEqual(['generationId', 'year']);
  });

  it('CRITICAL: an older entry saves the year the supplier chose within its range', async () => {
    const created = [];
    globalThis.fetch = mockServer(created);
    render(<LeapSupplierPortalApp />);
    await openAddProduct();
    await pick('vehicle', 'b_bmw', 'm_1', 'g_f20');
    await waitFor(() => expect(el('vehicle-which-year')).not.toBeNull());
    choose('vehicle-which-year', '2017');
    await fillTheRestAndSubmit();
    await waitFor(() => expect(created).toHaveLength(1));
    expect(created[0].fitment).toEqual({ generationId: 'g_f20', year: 2017 });
  });

  it('CRITICAL: nothing chosen is explained in the new words ("brand, model and year"), and an older entry without its year says "year"; nothing is saved', async () => {
    const created = [];
    globalThis.fetch = mockServer(created);
    render(<LeapSupplierPortalApp />);
    await openAddProduct();
    await fillTheRestAndSubmit();
    expect(await screen.findByText(/brand, model and year|品牌、车型和年份/)).toBeInTheDocument();
    await pick('vehicle', 'b_bmw', 'm_1', 'g_f20');
    await waitFor(() => expect(el('vehicle-which-year')).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: /提交平台审核|submit for platform review/i }));
    await waitFor(() => expect(screen.queryByText(/brand, model and year|品牌、车型和年份/)).not.toBeInTheDocument());
    expect(screen.getByText(/please fill in: .*year|请填写：.*年份/i)).toBeInTheDocument();
    expect(created).toEqual([]);
  });
});

describe('Bulk upload: the vehicle for the whole batch is chosen the same way', () => {
  async function openBulk() {
    await login();
    await waitFor(() => screen.getByText(/批量上传|bulk upload/i));
    fireEvent.click(screen.getByText(/批量上传|bulk upload/i));
    await waitFor(() => expect(el('bulk-brand')).not.toBeNull());
    await waitFor(() => expect(within(el('bulk-brand')).getByText('Geely')).toBeInTheDocument());
  }

  it('CRITICAL: the same three steps and the same photo, in a smaller panel; no generation, engine or transmission', async () => {
    globalThis.fetch = mockServer();
    render(<LeapSupplierPortalApp />);
    await openBulk();
    expect(screen.queryByText(/generation|世代|engine|发动机|transmission|变速箱/i)).not.toBeInTheDocument();
    await pick('bulk', 'b_geely', 'm_cool', 'g_2023');
    await waitFor(() => expect(screen.getByText('Geely Coolray, 2023')).toBeInTheDocument());
    expect(photoImg().getAttribute('src')).toContain('/uploads/y2023.jpg');
    expect(chip().textContent).toMatch(/year photo|年份照片/i);
  });

  it('CRITICAL: the file can be chosen only once the vehicle (and, for an older entry, its year) is complete', async () => {
    globalThis.fetch = mockServer();
    render(<LeapSupplierPortalApp />);
    await openBulk();
    const fileInput = () => document.querySelector('input[type="file"][accept=".xlsx"]');
    expect(fileInput().disabled).toBe(true);
    await pick('bulk', 'b_bmw', 'm_1', 'g_f20');
    await waitFor(() => expect(el('bulk-which-year')).not.toBeNull());
    expect(fileInput().disabled).toBe(true);                                // an older entry still needs its year
    choose('bulk-which-year', '2016');
    await waitFor(() => expect(fileInput().disabled).toBe(false));
    choose('bulk-brand', 'b_geely');                                        // changing the brand clears the choice again
    await waitFor(() => expect(fileInput().disabled).toBe(true));
  });
});
