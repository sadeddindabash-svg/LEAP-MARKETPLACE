import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import LeapAdminApp from './App';

// Vehicle Data adds a vehicle in three steps and asks for only this:
//   Brand : English name + Arabic name + photo (all required)
//   Model : English name + Arabic name (no photo)
//   Year  : the year in English digits + photo (both required)
// Engines and transmissions are not part of it any more. (Mocked fetch, real component tree.)
const ADMIN_USER = { id: 'admin_dev_seed', email: 'admin@leap.dev', name: 'Dev Admin', role: 'admin', isOwner: true, allowedPages: 'all' };

function mockRouter() {
  const calls = [];
  let brands = [{ id: 'brand_bmw', name: 'BMW', nameAr: 'بي إم دبليو', photoUrl: '/uploads/bmw.png' }];
  let models = [{ id: 'model_1', brandId: 'brand_bmw', name: '1 Series', nameAr: 'الفئة الأولى' }];
  let years = [
    { id: 'gen_2021', modelId: 'model_1', name: '2021', yearStart: 2021, yearEnd: 2021, photoUrl: null },                 // a one-year entry without a photo (old data)
    { id: 'gen_f20', modelId: 'model_1', name: 'F20', yearStart: 2015, yearEnd: 2019, photoUrl: null },                     // an older entry: a name and a range
    { id: 'gen_2023', modelId: 'model_1', name: '2023', yearStart: 2023, yearEnd: 2023, photoUrl: '/uploads/2023.jpg' },
  ];
  const ok = (body, status = 200) => Promise.resolve({ ok: true, status, json: async () => body });
  const fail = (status, error) => Promise.resolve({ ok: false, status, json: async () => ({ error }) });
  const fn = vi.fn((url, options) => {
    const u = String(url).replace(/^https?:\/\/[^/]+/, '');
    const method = options?.method || 'GET';
    const isUpload = u.endsWith('/uploads/product-image');
    calls.push({ method, url: u, body: !isUpload && options?.body ? JSON.parse(options.body) : null });
    if (u.includes('/auth/login')) return ok({ token: 'fake.jwt.token', user: ADMIN_USER });
    if (u.includes('/auth/me')) return ok(ADMIN_USER);
    if (u.endsWith('/overview')) return ok({ totalOrders: 0, activeSuppliers: 0, pendingSuppliers: 0, openDisputes: 0, pendingModeration: 0, openTickets: 0, ordersByDay: [], unitsByCategory: [], topSuppliers: [] });
    if (isUpload) return ok({ url: '/uploads/uploaded.jpg', width: 1000, height: 1000, storage: 'local' }, 201);
    if (method === 'POST' && u.endsWith('/fitment/brands')) { const b = JSON.parse(options.body); const nb = { id: 'brand_new', name: b.name, nameAr: b.nameAr, photoUrl: b.photoUrl }; brands = [...brands, nb]; return ok(nb, 201); }
    if (method === 'POST' && u.endsWith('/fitment/brands/brand_bmw/models')) { const b = JSON.parse(options.body); const nm = { id: 'model_new', brandId: 'brand_bmw', name: b.name, nameAr: b.nameAr }; models = [...models, nm]; return ok(nm, 201); }
    if (method === 'POST' && u.endsWith('/fitment/models/model_1/generations')) {
      const b = JSON.parse(options.body);
      if (years.some((y) => y.yearStart === Number(b.year) && y.yearEnd === Number(b.year))) return fail(409, `${b.year} already exists for this model`);
      const g = { id: `gen_${b.year}`, modelId: 'model_1', name: String(b.year), yearStart: Number(b.year), yearEnd: Number(b.year), photoUrl: b.photoUrl };
      years = [...years, g]; return ok(g, 201);
    }
    if (method === 'PATCH' && u.match(/\/fitment\/generations\/[^/]+\/photo$/)) { const id = u.split('/')[3]; years = years.map((y) => (y.id === id ? { ...y, photoUrl: JSON.parse(options.body).photoUrl } : y)); return ok(years.find((y) => y.id === id)); }
    if (method === 'DELETE' && u.match(/\/fitment\/generations\/[^/]+$/)) { const id = u.split('/')[3]; years = years.filter((y) => y.id !== id); return Promise.resolve({ ok: true, status: 204, json: async () => ({}) }); }
    if (u.endsWith('/fitment/brands')) return ok(brands);
    if (u.match(/\/fitment\/brands\/brand_bmw\/models$/)) return ok(models);
    if (u.match(/\/fitment\/models\/model_1\/generations$/)) return ok(years);
    return ok({});
  });
  return { fn, calls };
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
const photoFile = () => new File(['fake-image-content'], 'photo.jpg', { type: 'image/jpeg' });
const chooseInput = () => screen.getByText(/choose photo \(required\)|photo selected/i).closest('label').querySelector('input[type="file"]');
const add = () => fireEvent.click(screen.getByRole('button', { name: /^add$/i }));
const writes = (calls) => calls.filter((c) => c.method !== 'GET' && !c.url.includes('/auth/'));
async function openYears() {
  fireEvent.click(await screen.findByText('BMW'));
  fireEvent.click(await screen.findByText('1 Series'));
  await screen.findByText('F20');
}
const type = (placeholder, value) => fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value } });

beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('Vehicle Data: Brand, then Model, then Year (mocked fetch, real component tree)', () => {
  it('drills down Brand -> Model -> Years, with no engines or transmissions anywhere, and the breadcrumb leads back up', async () => {
    globalThis.fetch = mockRouter().fn;
    render(<LeapAdminApp />);
    await loginAndGoToVehicleData();
    await openYears();
    expect(screen.queryByText(/engine/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/transmission/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByText('BMW').find((el) => el.tagName === 'SPAN'));
    await waitFor(() => expect(screen.getByText('1 Series')).toBeInTheDocument());
    fireEvent.click(screen.getAllByText('Brands').find((el) => el.tagName === 'SPAN'));
    await waitFor(() => expect(screen.queryByText('1 Series')).not.toBeInTheDocument());
  });

  it('CRITICAL: a BRAND needs English name, Arabic name AND a photo: each missing one is explained and nothing is sent', async () => {
    const { fn, calls } = mockRouter(); globalThis.fetch = fn;
    render(<LeapAdminApp />);
    await loginAndGoToVehicleData();
    await waitFor(() => screen.getByPlaceholderText(/english name/i));
    expect(screen.getByText(/choose photo \(required\)/i)).toBeInTheDocument();
    add();
    expect(await screen.findByText(/english name is required/i)).toBeInTheDocument();
    type(/english name/i, 'Nissan'); add();
    expect(await screen.findByText(/arabic name is required/i)).toBeInTheDocument();
    type(/arabic name/i, 'نيسان'); add();
    expect(await screen.findByText(/a photo is required/i)).toBeInTheDocument();
    expect(writes(calls)).toEqual([]);                                                       // nothing uploaded, nothing created
  });

  it('CRITICAL: a brand with all three is uploaded first and created with its photo, and appears in the list', async () => {
    const { fn, calls } = mockRouter(); globalThis.fetch = fn;
    render(<LeapAdminApp />);
    await loginAndGoToVehicleData();
    await waitFor(() => screen.getByPlaceholderText(/english name/i));
    type(/english name/i, 'Nissan'); type(/arabic name/i, 'نيسان');
    fireEvent.change(chooseInput(), { target: { files: [photoFile()] } });
    add();
    await waitFor(() => expect(screen.getByText('Nissan')).toBeInTheDocument());
    const upload = calls.findIndex((c) => c.url.endsWith('/uploads/product-image'));
    const create = calls.findIndex((c) => c.method === 'POST' && c.url.endsWith('/fitment/brands'));
    expect(create).toBeGreaterThan(upload);
    expect(calls[create].body).toEqual({ name: 'Nissan', nameAr: 'نيسان', photoUrl: '/uploads/uploaded.jpg' });
  });

  it('CRITICAL: a MODEL asks for the two names only (no photo field at all), needs both, and is created with just them', async () => {
    const { fn, calls } = mockRouter(); globalThis.fetch = fn;
    render(<LeapAdminApp />);
    await loginAndGoToVehicleData();
    fireEvent.click(await screen.findByText('BMW'));
    await screen.findByText('1 Series');
    expect(screen.queryByText(/choose photo/i)).not.toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).toBeNull();                          // no file picker anywhere in the model step
    add();
    expect(await screen.findByText(/english name is required/i)).toBeInTheDocument();
    type(/new model under bmw/i, 'X5'); add();
    expect(await screen.findByText(/arabic name is required/i)).toBeInTheDocument();
    expect(writes(calls)).toEqual([]);
    type(/arabic name/i, 'إكس 5'); add();
    await waitFor(() => expect(screen.getByText('X5')).toBeInTheDocument());
    const create = calls.find((c) => c.method === 'POST' && c.url.endsWith('/models'));
    expect(create.body).toEqual({ name: 'X5', nameAr: 'إكس 5' });                              // no photo sent
    expect(calls.some((c) => c.url.endsWith('/uploads/product-image'))).toBe(false);
  });

  it('CRITICAL: a YEAR asks for the year in English digits and a photo only; a wrong year or no photo is explained and nothing is sent', async () => {
    const { fn, calls } = mockRouter(); globalThis.fetch = fn;
    render(<LeapAdminApp />);
    await loginAndGoToVehicleData();
    await openYears();
    expect(screen.getByPlaceholderText(/year \(english digits/i)).toBeInTheDocument();
    expect(screen.getByText(/choose photo \(required\)/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/start year|end year|new generation/i)).not.toBeInTheDocument();   // no name, no range
    add();
    expect(await screen.findByText(/year is required/i)).toBeInTheDocument();
    type(/year \(english/i, '21'); add();
    expect(await screen.findByText(/four digits, for example 2021/i)).toBeInTheDocument();
    type(/year \(english/i, '1900'); add();
    expect(await screen.findByText(/must be between 1950 and/i)).toBeInTheDocument();
    type(/year \(english/i, '2024'); add();
    expect(await screen.findByText(/a photo is required/i)).toBeInTheDocument();
    expect(writes(calls)).toEqual([]);
  });

  it('CRITICAL: a year typed in Arabic digits is accepted, the photo is uploaded first, and the new year appears at the TOP (newest first)', async () => {
    const { fn, calls } = mockRouter(); globalThis.fetch = fn;
    render(<LeapAdminApp />);
    await loginAndGoToVehicleData();
    await openYears();
    type(/year \(english/i, '٢٠٢٤');
    fireEvent.change(chooseInput(), { target: { files: [photoFile()] } });
    add();
    await waitFor(() => expect(screen.getByText('2024')).toBeInTheDocument());
    const upload = calls.findIndex((c) => c.url.endsWith('/uploads/product-image'));
    const create = calls.findIndex((c) => c.method === 'POST' && c.url.endsWith('/models/model_1/generations'));
    expect(create).toBeGreaterThan(upload);
    expect(calls[create].body).toEqual({ year: 2024, photoUrl: '/uploads/uploaded.jpg' });    // converted to 2024; nothing else is sent
    const order = screen.getAllByText(/^(2024|2023|2021|F20)$/).map((el) => el.textContent);
    expect(order).toEqual(['2024', '2023', '2021', 'F20']);                                    // newest first, the older entry last
  });

  it('a year that already exists is refused by the server and the message is shown; the list does not change', async () => {
    const { fn } = mockRouter(); globalThis.fetch = fn;
    render(<LeapAdminApp />);
    await loginAndGoToVehicleData();
    await openYears();
    type(/year \(english/i, '2023');
    fireEvent.change(chooseInput(), { target: { files: [photoFile()] } });
    add();
    expect(await screen.findByText('2023 already exists for this model')).toBeInTheDocument();
    expect(screen.getAllByText('2023')).toHaveLength(1);
  });

  it('CRITICAL: the year list says which years have a photo; older entries are marked with their range and can still be edited; one-year entries cannot be edited, only deleted', async () => {
    globalThis.fetch = mockRouter().fn;
    render(<LeapAdminApp />);
    await loginAndGoToVehicleData();
    await openYears();
    expect(screen.getAllByText('Has photo')).toHaveLength(1);                                  // 2023
    expect(screen.getAllByText('No photo yet')).toHaveLength(2);                               // 2021 and F20
    expect(screen.getByText('Replace photo')).toBeInTheDocument();
    expect(screen.getAllByText('Add photo')).toHaveLength(2);
    expect(screen.getByText('Older entry')).toBeInTheDocument();
    expect(screen.getByText('2015 to 2019')).toBeInTheDocument();
    expect(screen.getAllByTitle('Edit this older entry')).toHaveLength(1);                     // F20 only
    expect(screen.queryByTitle(/move up|move down/i)).not.toBeInTheDocument();                // years are not reordered by hand
    for (const y of ['2023', '2021', 'F20']) expect(screen.getByLabelText(`Delete ${y}`)).toBeInTheDocument();
  });

  it('CRITICAL: "Add photo" on an existing year uploads the photo and sets it on that year; the badge changes', async () => {
    const { fn, calls } = mockRouter(); globalThis.fetch = fn;
    render(<LeapAdminApp />);
    await loginAndGoToVehicleData();
    await openYears();
    const row2021 = screen.getByText('2021').closest('div[style*="justify-content"]');
    fireEvent.change(within(row2021).getByText('Add photo').closest('label').querySelector('input'), { target: { files: [photoFile()] } });
    await waitFor(() => expect(screen.getAllByText('Has photo')).toHaveLength(2));
    expect(calls.find((c) => c.method === 'PATCH' && c.url.endsWith('/fitment/generations/gen_2021/photo')).body).toEqual({ photoUrl: '/uploads/uploaded.jpg' });
  });

  it('deleting a year asks first, then removes it', async () => {
    const { fn, calls } = mockRouter(); globalThis.fetch = fn;
    render(<LeapAdminApp />);
    await loginAndGoToVehicleData();
    await openYears();
    fireEvent.click(screen.getByLabelText('Delete 2021'));
    expect(await screen.findByText(/delete "2021"\?/i)).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);                              // nothing yet: it asked
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));          // the dialog's own button (the row buttons are "Delete 2021" and so on)
    await waitFor(() => expect(screen.queryByText('2021')).not.toBeInTheDocument());
    expect(calls.some((c) => c.method === 'DELETE' && c.url.endsWith('/fitment/generations/gen_2021'))).toBe(true);
  });
});
