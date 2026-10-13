import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LeapAdminApp from './App';

const ADMIN_USER = { id: 'admin_dev_seed', email: 'admin@leap.dev', name: 'Dev Admin', role: 'admin', isOwner: true, allowedPages: 'all' };

function mockFetchRouter() {
  let brands = [{ id: 'brand_bmw', name: 'BMW' }];
  const modelsByBrand = { brand_bmw: [{ id: 'model_1', brandId: 'brand_bmw', name: '1 Series' }] };
  const gensByModel = { model_1: [{ id: 'gen_f20', modelId: 'model_1', name: 'F20', yearStart: 2015, yearEnd: 2019 }] };
  const enginesByGen = { gen_f20: [{ id: 'eng_1', generationId: 'gen_f20', name: '118d 2.0D' }] };
  const transByGen = { gen_f20: [{ id: 'trans_1', generationId: 'gen_f20', name: '6-Speed Manual' }] };

  return vi.fn((url, options) => {
    const u = String(url);
    const method = options?.method || 'GET';
    if (u.includes('/auth/login')) return Promise.resolve({ ok: true, json: async () => ({ token: 'fake.jwt.token', user: ADMIN_USER }) });
    if (u.includes('/auth/me')) return Promise.resolve({ ok: true, json: async () => ADMIN_USER });
    if (u.endsWith('/overview')) {
      return Promise.resolve({ ok: true, json: async () => ({ totalOrders: 0, activeSuppliers: 0, pendingSuppliers: 0, openDisputes: 0, pendingModeration: 0, openTickets: 0, ordersByDay: [], unitsByCategory: [], topSuppliers: [] }) });
    }
    if (method === 'POST' && u.endsWith('/fitment/brands')) {
      const body = JSON.parse(options.body);
      const newBrand = { id: 'brand_new', name: body.name, nameAr: body.nameAr, photoUrl: body.photoUrl };
      brands = [...brands, newBrand];
      return Promise.resolve({ ok: true, status: 201, json: async () => newBrand });
    }
    if (method === 'POST' && u.endsWith('/uploads/product-image')) {
      return Promise.resolve({ ok: true, status: 201, json: async () => ({ url: '/uploads/fake-brand-photo.jpg', width: 1000, height: 1000, storage: 'local' }) });
    }
    if (u.endsWith('/fitment/brands')) return Promise.resolve({ ok: true, json: async () => brands });
    if (u.match(/\/fitment\/brands\/brand_bmw\/models$/)) return Promise.resolve({ ok: true, json: async () => modelsByBrand.brand_bmw });
    if (u.match(/\/fitment\/models\/model_1\/generations$/)) return Promise.resolve({ ok: true, json: async () => gensByModel.model_1 });
    if (u.match(/\/fitment\/generations\/gen_f20\/engines$/)) return Promise.resolve({ ok: true, json: async () => enginesByGen.gen_f20 });
    if (u.match(/\/fitment\/generations\/gen_f20\/transmissions$/)) return Promise.resolve({ ok: true, json: async () => transByGen.gen_f20 });
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
}

async function loginAndGoToVehicleData() {
  fireEvent.click(await screen.findByRole('button', { name: /log in/i }));
  await waitFor(() => screen.getByLabelText(/email/i));
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'admin@leap.dev' } });
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'admin_dev_password_123' } });
  fireEvent.click(screen.getByRole('button', { name: /log in/i }));
  await waitFor(() => expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: /vehicle data/i }));
}

beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('Vehicle Data page — real fitment cascade management (mocked fetch, real component tree)', () => {
  it('renders real brands and drills down through Model -> Generation -> Engines/Transmissions', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAndGoToVehicleData();

    await waitFor(() => expect(screen.getByText('BMW')).toBeInTheDocument());
    fireEvent.click(screen.getByText('BMW'));

    await waitFor(() => expect(screen.getByText('1 Series')).toBeInTheDocument());
    fireEvent.click(screen.getByText('1 Series'));

    await waitFor(() => expect(screen.getByText('F20')).toBeInTheDocument());
    fireEvent.click(screen.getByText('F20'));

    await waitFor(() => expect(screen.getByText('118d 2.0D')).toBeInTheDocument());
    expect(screen.getByText('6-Speed Manual')).toBeInTheDocument();
  });

  it('the breadcrumb lets you navigate back up the cascade', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAndGoToVehicleData();

    fireEvent.click(await screen.findByText('BMW'));
    await waitFor(() => screen.getByText('1 Series'));

    // Click the "Brands" breadcrumb to go back up.
    // "Brands" is now ALSO the name of a tab (a button) on this page, so pick the breadcrumb itself: a span.
    fireEvent.click(screen.getAllByText('Brands').find((el) => el.tagName === 'SPAN'));
    await waitFor(() => expect(screen.queryByText('1 Series')).not.toBeInTheDocument());
  });

  it('adding a new brand calls the real create endpoint (with its now-required Arabic name and photo) and shows it in the list', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAndGoToVehicleData();

    await waitFor(() => screen.getByPlaceholderText(/english name/i));
    fireEvent.change(screen.getByPlaceholderText(/english name/i), { target: { value: 'Nissan' } });
    fireEvent.change(screen.getByPlaceholderText(/arabic name/i), { target: { value: 'نيسان' } });

    const file = new File(['fake-image-content'], 'brand.jpg', { type: 'image/jpeg' });
    const fileInput = document.querySelector('input[type="file"]');
    fireEvent.change(fileInput, { target: { files: [file] } });

    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));

    await waitFor(() => expect(screen.getByText('Nissan')).toBeInTheDocument());
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------
// The photo moved to the vehicle YEAR (generation): optional for a brand and a model, REQUIRED when a year is added, and years that already exist without
// one are flagged "No photo yet" and can get one.
// ---------------------------------------------------------------------------------------------------------------------------------------------------------
function mockYearPhotoRouter() {
  const calls = [];
  let brands = [{ id: 'brand_bmw', name: 'BMW', nameAr: 'بي إم دبليو' }];
  let gens = [
    { id: 'gen_f20', modelId: 'model_1', name: 'F20', yearStart: 2015, yearEnd: 2019, photoUrl: null },            // an old year: no photo
    { id: 'gen_f40', modelId: 'model_1', name: 'F40', yearStart: 2019, yearEnd: null, photoUrl: '/uploads/f40.jpg' },
  ];
  const ok = (body, status = 200) => Promise.resolve({ ok: true, status, json: async () => body });
  const fn = vi.fn((url, options) => {
    const u = String(url).replace(/^https?:\/\/[^/]+/, '');
    const method = options?.method || 'GET';
    const isUpload = u.endsWith('/uploads/product-image');
    calls.push({ method, url: u, body: !isUpload && options?.body ? JSON.parse(options.body) : null });
    if (u.includes('/auth/login')) return ok({ token: 'fake.jwt.token', user: ADMIN_USER });
    if (u.includes('/auth/me')) return ok(ADMIN_USER);
    if (u.endsWith('/overview')) return ok({ totalOrders: 0, activeSuppliers: 0, pendingSuppliers: 0, openDisputes: 0, pendingModeration: 0, openTickets: 0, ordersByDay: [], unitsByCategory: [], topSuppliers: [] });
    if (isUpload) return ok({ url: '/uploads/uploaded-year.jpg', width: 1000, height: 1000, storage: 'local' }, 201);
    if (method === 'POST' && u.endsWith('/fitment/brands')) { const b = JSON.parse(options.body); const nb = { id: 'brand_new', name: b.name, nameAr: b.nameAr, photoUrl: b.photoUrl || null }; brands = [...brands, nb]; return ok(nb, 201); }
    if (method === 'POST' && u.endsWith('/fitment/models/model_1/generations')) {
      const b = JSON.parse(options.body); const g = { id: 'gen_new', modelId: 'model_1', name: b.name, yearStart: b.yearStart, yearEnd: b.yearEnd || null, photoUrl: b.photoUrl };
      gens = [...gens, g]; return ok(g, 201);
    }
    if (method === 'PATCH' && u.endsWith('/fitment/generations/gen_f20/photo')) { gens = gens.map((g) => (g.id === 'gen_f20' ? { ...g, photoUrl: JSON.parse(options.body).photoUrl } : g)); return ok(gens[0]); }
    if (u.endsWith('/fitment/brands')) return ok(brands);
    if (u.match(/\/fitment\/brands\/brand_bmw\/models$/)) return ok([{ id: 'model_1', brandId: 'brand_bmw', name: '1 Series' }]);
    if (u.match(/\/fitment\/models\/model_1\/generations$/)) return ok(gens);
    return ok({});
  });
  return { fn, calls };
}
const photoFile = () => new File(['fake-image-content'], 'photo.jpg', { type: 'image/jpeg' });
const inputOf = (labelText) => screen.getByText(labelText).closest('label').querySelector('input[type="file"]');
async function openYearsOfFirstModel() {
  fireEvent.click(await screen.findByText('BMW'));
  fireEvent.click(await screen.findByText('1 Series'));
  await screen.findByText('F20');
}

describe('Vehicle Data: the photo is required for a YEAR, optional for a brand and a model (mocked fetch, real component tree)', () => {
  it('CRITICAL: a brand can be added WITHOUT a photo (nothing is uploaded, no photo is sent), and the brand form says the photo is optional', async () => {
    const { fn, calls } = mockYearPhotoRouter(); globalThis.fetch = fn;
    render(<LeapAdminApp />);
    await loginAndGoToVehicleData();
    await waitFor(() => screen.getByPlaceholderText(/english name/i));
    expect(screen.getByText(/choose photo \(optional\)/i)).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/english name/i), { target: { value: 'Nissan' } });
    fireEvent.change(screen.getByPlaceholderText(/arabic name/i), { target: { value: 'نيسان' } });
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));
    await waitFor(() => expect(screen.getByText('Nissan')).toBeInTheDocument());
    expect(screen.queryByText(/a photo is required/i)).not.toBeInTheDocument();
    const create = calls.find((c) => c.method === 'POST' && c.url.endsWith('/fitment/brands'));
    expect(create.body).toMatchObject({ name: 'Nissan', nameAr: 'نيسان' });
    expect(create.body.photoUrl).toBeUndefined();
    expect(calls.some((c) => c.url.endsWith('/uploads/product-image'))).toBe(false);
  });

  it('a brand added WITH a photo still uploads it first and sends its address', async () => {
    const { fn, calls } = mockYearPhotoRouter(); globalThis.fetch = fn;
    render(<LeapAdminApp />);
    await loginAndGoToVehicleData();
    await waitFor(() => screen.getByPlaceholderText(/english name/i));
    fireEvent.change(screen.getByPlaceholderText(/english name/i), { target: { value: 'Kia' } });
    fireEvent.change(screen.getByPlaceholderText(/arabic name/i), { target: { value: 'كيا' } });
    fireEvent.change(inputOf(/choose photo \(optional\)/i), { target: { files: [photoFile()] } });
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));
    await waitFor(() => expect(screen.getByText('Kia')).toBeInTheDocument());
    expect(calls.find((c) => c.method === 'POST' && c.url.endsWith('/fitment/brands')).body.photoUrl).toBe('/uploads/uploaded-year.jpg');
  });

  it('CRITICAL: a YEAR cannot be added without a photo: "A photo is required." is shown and nothing is sent; the picker is marked required', async () => {
    const { fn, calls } = mockYearPhotoRouter(); globalThis.fetch = fn;
    render(<LeapAdminApp />);
    await loginAndGoToVehicleData();
    await openYearsOfFirstModel();
    expect(screen.getByText(/choose photo \(required\)/i)).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/new generation under/i), { target: { value: 'G20' } });
    fireEvent.change(screen.getByPlaceholderText(/start year/i), { target: { value: '2023' } });
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));
    await waitFor(() => expect(screen.getByText(/a photo is required/i)).toBeInTheDocument());
    expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/generations'))).toBe(false);
    expect(calls.some((c) => c.url.endsWith('/uploads/product-image'))).toBe(false);
    expect(screen.queryByText('G20')).not.toBeInTheDocument();
  });

  it('CRITICAL: a YEAR with a photo is uploaded first and created with the photo, and appears in the list marked "Has photo"', async () => {
    const { fn, calls } = mockYearPhotoRouter(); globalThis.fetch = fn;
    render(<LeapAdminApp />);
    await loginAndGoToVehicleData();
    await openYearsOfFirstModel();
    fireEvent.change(screen.getByPlaceholderText(/new generation under/i), { target: { value: 'G20' } });
    fireEvent.change(screen.getByPlaceholderText(/start year/i), { target: { value: '2023' } });
    fireEvent.change(inputOf(/choose photo \(required\)/i), { target: { files: [photoFile()] } });
    expect(await screen.findByText(/photo selected/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));
    await waitFor(() => expect(screen.getByText('G20')).toBeInTheDocument());
    const upload = calls.findIndex((c) => c.url.endsWith('/uploads/product-image'));
    const create = calls.findIndex((c) => c.method === 'POST' && c.url.endsWith('/fitment/models/model_1/generations'));
    expect(upload).toBeGreaterThan(-1);
    expect(create).toBeGreaterThan(upload);                                           // the photo goes up BEFORE the year is created
    expect(calls[create].body).toMatchObject({ name: 'G20', yearStart: 2023, photoUrl: '/uploads/uploaded-year.jpg' });
    expect(screen.queryByText(/a photo is required/i)).not.toBeInTheDocument();
    expect(screen.getAllByText('Has photo')).toHaveLength(2);                          // F40 and the new G20
  });

  it('CRITICAL: the year list shows which years have a photo and which do not (an old year is "No photo yet" with an "Add photo" button)', async () => {
    globalThis.fetch = mockYearPhotoRouter().fn;
    render(<LeapAdminApp />);
    await loginAndGoToVehicleData();
    await openYearsOfFirstModel();
    expect(screen.getAllByText('No photo yet')).toHaveLength(1);                       // F20 only
    expect(screen.getAllByText('Has photo')).toHaveLength(1);                          // F40
    expect(screen.getByText('Add photo')).toBeInTheDocument();
    expect(screen.getByText('Replace photo')).toBeInTheDocument();
  });

  it('CRITICAL: "Add photo" on an existing year uploads the photo, sets it on that year, and the list updates', async () => {
    const { fn, calls } = mockYearPhotoRouter(); globalThis.fetch = fn;
    render(<LeapAdminApp />);
    await loginAndGoToVehicleData();
    await openYearsOfFirstModel();
    fireEvent.change(inputOf('Add photo'), { target: { files: [photoFile()] } });
    await waitFor(() => expect(screen.queryByText('No photo yet')).not.toBeInTheDocument());
    const patch = calls.find((c) => c.method === 'PATCH' && c.url.endsWith('/fitment/generations/gen_f20/photo'));
    expect(patch.body).toEqual({ photoUrl: '/uploads/uploaded-year.jpg' });
    expect(screen.getAllByText('Has photo')).toHaveLength(2);
    expect(screen.queryByText('Add photo')).not.toBeInTheDocument();
  });

  it('a model is still added without a photo (optional), exactly as before', async () => {
    const { fn, calls } = mockYearPhotoRouter(); globalThis.fetch = fn;
    render(<LeapAdminApp />);
    await loginAndGoToVehicleData();
    fireEvent.click(await screen.findByText('BMW'));
    await screen.findByText('1 Series');
    expect(screen.getByText(/choose photo \(optional\)/i)).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST' && c.url.includes('/models'))).toBe(false);   // nothing is created just by opening the form
  });
});
