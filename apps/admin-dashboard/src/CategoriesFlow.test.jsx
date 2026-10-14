import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LeapAdminApp from './App';

const ADMIN_USER = { id: 'admin_dev_seed', email: 'admin@leap.dev', name: 'Dev Admin', role: 'admin', isOwner: true, allowedPages: 'all' };

const MOCK_CATEGORIES = [{ id: 'brake', nameEn: 'Brake System', nameAr: 'نظام الفرامل', sortOrder: 10 }];
const MOCK_PARTS = [
  { id: 'part_1', categoryId: 'brake', nameEn: 'Front Brake Disc', nameAr: 'قرص فرامل أمامي', sortOrder: 10, weightKg: 5, lengthCm: 30, widthCm: 30, heightCm: 5 },    // set by the admin
  { id: 'part_2', categoryId: 'brake', nameEn: 'Brake Hose', nameAr: 'خرطوم الفرامل', sortOrder: 20, weightKg: null, lengthCm: null, widthCm: null, heightCm: null },   // none yet
];

function mockFetchRouter({ categories = MOCK_CATEGORIES, parts = MOCK_PARTS, calls = [] } = {}) {
  let cats = [...categories];
  let categoryParts = [...parts];
  const ok = (body, status = 200) => Promise.resolve({ ok: true, status, json: async () => body });
  return vi.fn((url, options) => {
    const u = String(url);
    const method = options?.method || 'GET';
    if (u.includes('/auth/login')) return ok({ token: 'fake.jwt.token', user: ADMIN_USER });
    if (u.includes('/auth/me')) return ok(ADMIN_USER);
    if (u.endsWith('/overview')) return ok({ totalOrders: 0, activeSuppliers: 0, pendingSuppliers: 0, openDisputes: 0, pendingModeration: 0, openTickets: 0, ordersByDay: [], unitsByCategory: [], topSuppliers: [] });
    if (method === 'POST' && u.endsWith('/catalog/categories')) {
      const b = JSON.parse(options.body);
      calls.push({ method, url: u, body: b });
      const newCat = { id: b.id, nameEn: b.nameEn, nameAr: b.nameAr, photoUrl: b.photoUrl, sortOrder: b.sortOrder };
      cats = [...cats, newCat];
      return ok(newCat, 201);
    }
    if (method === 'POST' && u.endsWith('/uploads/product-image')) return ok({ url: '/uploads/fake-category-photo.jpg', width: 1000, height: 1000, storage: 'local' }, 201);
    if (u.endsWith('/catalog/categories')) return ok(cats);
    if (method === 'POST' && u.match(/\/catalog\/categories\/.+\/parts$/)) {
      const b = JSON.parse(options.body);
      calls.push({ method, url: u, body: b });
      const newPart = { id: 'part_new', categoryId: 'brake', nameEn: b.nameEn, nameAr: b.nameAr, sortOrder: b.sortOrder, weightKg: b.weightKg ?? null, lengthCm: b.lengthCm ?? null, widthCm: b.widthCm ?? null, heightCm: b.heightCm ?? null };
      categoryParts = [...categoryParts, newPart];
      return ok(newPart, 201);
    }
    if (method === 'PATCH' && u.match(/\/catalog\/parts\/[^/]+$/)) {
      const b = JSON.parse(options.body);
      const id = u.split('/').pop();
      calls.push({ method, url: u, body: b });
      categoryParts = categoryParts.map((p) => (p.id === id ? { ...p, nameEn: b.nameEn, nameAr: b.nameAr, ...(b.weightKg !== undefined ? { weightKg: b.weightKg, lengthCm: b.lengthCm, widthCm: b.widthCm, heightCm: b.heightCm } : {}) } : p));
      return ok(categoryParts.find((p) => p.id === id));
    }
    if (u.match(/\/catalog\/categories\/.+\/parts$/)) return ok(categoryParts);
    return ok({});
  });
}

async function loginAndGoToCategories() {
  fireEvent.click(await screen.findByRole('button', { name: /log in/i }));
  await waitFor(() => screen.getByLabelText(/email/i));
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'admin@leap.dev' } });
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'admin_dev_password_123' } });
  fireEvent.click(screen.getByRole('button', { name: /log in/i }));
  await waitFor(() => expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: /^categories$/i }));
}
async function openBrakeParts() {
  fireEvent.click(await screen.findByText('Brake System'));
  await waitFor(() => screen.getByPlaceholderText(/english part name/i));
}

// the Shipping group of the add-part form: Weight (kg), Length (cm), Width (cm), Height (cm)
const FIELD_LABELS = { weightKg: 'Weight (kg)', lengthCm: 'Length (cm)', widthCm: 'Width (cm)', heightCm: 'Height (cm)' };
function fillShipping(values) {
  for (const [key, value] of Object.entries(values)) fireEvent.change(screen.getByLabelText(FIELD_LABELS[key]), { target: { value } });
}
function fillPartNames(en = 'Brake Fluid', ar = 'سائل الفرامل') {
  fireEvent.change(screen.getByPlaceholderText(/english part name/i), { target: { value: en } });
  fireEvent.change(screen.getByPlaceholderText(/arabic name \(required\)/i), { target: { value: ar } });
}
const addPart = () => fireEvent.click(screen.getByRole('button', { name: /add part/i }));
const writes = (calls) => calls.filter((c) => c.method !== 'GET');
// the edit dialog's own inputs, found by their label text
const dialogInput = (label) => screen.getAllByText(label).map((el) => el.parentElement.querySelector('input')).filter(Boolean).pop();
// the pencil button of a part's row (it has no text, only an icon)
const openEdit = (name) => {
  let el = screen.getByText(name);
  while (el && !el.querySelector('.lucide-pencil')) el = el.parentElement;
  fireEvent.click(el.querySelector('.lucide-pencil').closest('button'));
};

beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('Categories page — real category/part reference management (mocked fetch, real component tree)', () => {
  it('renders the real seeded category', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAndGoToCategories();

    await waitFor(() => expect(screen.getByText('Brake System')).toBeInTheDocument());
  });

  it('adding a new category calls the real create endpoint (with its now-required Arabic name and photo) and shows it immediately', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAndGoToCategories();

    await waitFor(() => screen.getByPlaceholderText(/id \(e\.g\./i));
    fireEvent.change(screen.getByPlaceholderText(/id \(e\.g\./i), { target: { value: 'tires' } });
    fireEvent.change(screen.getByPlaceholderText(/^english name$/i), { target: { value: 'Tires' } });
    fireEvent.change(screen.getByPlaceholderText(/arabic name/i), { target: { value: 'إطارات' } });

    const file = new File(['fake-image-content'], 'category.jpg', { type: 'image/jpeg' });
    const fileInput = document.querySelector('input[type="file"]');
    fireEvent.change(fileInput, { target: { files: [file] } });

    fireEvent.click(screen.getByRole('button', { name: /add category/i }));

    await waitFor(() => expect(screen.getByText('Tires')).toBeInTheDocument());
  });

  it('CRITICAL: a major category carries NO weight or size: no Shipping group in its add form, nothing at the end of its row, and none is sent', async () => {
    const calls = [];
    globalThis.fetch = mockFetchRouter({ calls });
    render(<LeapAdminApp />);
    await loginAndGoToCategories();
    await waitFor(() => screen.getByPlaceholderText(/id \(e\.g\./i));
    expect(screen.queryByText(/^Shipping/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Weight (kg)')).not.toBeInTheDocument();
    expect(screen.queryByText(/no weight or size yet/i)).not.toBeInTheDocument();
    expect(screen.queryByText('5 kg')).not.toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/id \(e\.g\./i), { target: { value: 'tires' } });
    fireEvent.change(screen.getByPlaceholderText(/^english name$/i), { target: { value: 'Tires' } });
    fireEvent.change(screen.getByPlaceholderText(/arabic name/i), { target: { value: 'إطارات' } });
    fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [new File(['x'], 'c.jpg', { type: 'image/jpeg' })] } });
    fireEvent.click(screen.getByRole('button', { name: /add category/i }));
    await waitFor(() => expect(screen.getByText('Tires')).toBeInTheDocument());
    const create = calls.find((c) => c.method === 'POST' && c.url.endsWith('/catalog/categories'));
    for (const key of ['weightKg', 'lengthCm', 'widthCm', 'heightCm']) expect(create.body).not.toHaveProperty(key);
  });

  it('clicking a category drills into its real parts list', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAndGoToCategories();

    await waitFor(() => screen.getByText('Brake System'));
    fireEvent.click(screen.getByText('Brake System'));

    await waitFor(() => expect(screen.getByText('Front Brake Disc')).toBeInTheDocument());
    expect(screen.getByText(/Brake System — Parts/)).toBeInTheDocument();
  });

  it('shows a real empty state when a category has no parts yet', async () => {
    globalThis.fetch = mockFetchRouter({ parts: [] });
    render(<LeapAdminApp />);
    await loginAndGoToCategories();

    fireEvent.click(await screen.findByText('Brake System'));
    await waitFor(() => expect(screen.getByText(/no parts yet/i)).toBeInTheDocument());
  });

  // -------------------------------------------------------------------------------------------------------------------------------------------------------
  // Each PART (the sub-category) has a weight and a package size, set here by the admin: the shipping cost of every product with that part uses them (migration 104).
  // -------------------------------------------------------------------------------------------------------------------------------------------------------
  it('CRITICAL: each part row ends with its weight and size, and a part without them says "No weight or size yet"', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAndGoToCategories();
    fireEvent.click(await screen.findByText('Brake System'));
    await waitFor(() => screen.getByText('Front Brake Disc'));
    expect(screen.getByText('5 kg')).toBeInTheDocument();
    expect(screen.getByText('30 × 30 × 5 cm')).toBeInTheDocument();
    expect(screen.getAllByText('No weight or size yet')).toHaveLength(1);      // Brake Hose only
  });

  it('CRITICAL: a new part needs all four values: each missing or invalid one is explained and nothing is sent', async () => {
    const calls = [];
    globalThis.fetch = mockFetchRouter({ calls });
    render(<LeapAdminApp />);
    await loginAndGoToCategories();
    await openBrakeParts();
    fillPartNames();
    addPart();
    expect(await screen.findByText('Weight (kg) is required.')).toBeInTheDocument();
    fillShipping({ weightKg: '2' }); addPart();
    expect(await screen.findByText('Length (cm) is required.')).toBeInTheDocument();
    fillShipping({ lengthCm: '20' }); addPart();
    expect(await screen.findByText('Width (cm) is required.')).toBeInTheDocument();
    fillShipping({ widthCm: '15' }); addPart();
    expect(await screen.findByText('Height (cm) is required.')).toBeInTheDocument();
    fillShipping({ heightCm: '0' }); addPart();
    expect(await screen.findByText('Height (cm) must be a number above zero.')).toBeInTheDocument();
    fillShipping({ heightCm: '-4' }); addPart();
    expect(await screen.findByText('Height (cm) must be a number above zero.')).toBeInTheDocument();
    fillShipping({ heightCm: 'abc' }); addPart();
    expect(await screen.findByText('Height (cm) must be a number above zero.')).toBeInTheDocument();
    expect(writes(calls).filter((c) => c.url.endsWith('/parts'))).toEqual([]);          // nothing was created by any of them
  });

  it('CRITICAL: a part with all four values is created with them as numbers (and its names), and its row shows them at once', async () => {
    const calls = [];
    globalThis.fetch = mockFetchRouter({ calls });
    render(<LeapAdminApp />);
    await loginAndGoToCategories();
    await openBrakeParts();
    fillPartNames();
    fillShipping({ weightKg: '2', lengthCm: '20.5', widthCm: '15', heightCm: '10' });
    addPart();
    await waitFor(() => expect(screen.getByText('Brake Fluid')).toBeInTheDocument());
    const create = calls.find((c) => c.method === 'POST' && c.url.endsWith('/parts'));
    expect(create.body).toMatchObject({ nameEn: 'Brake Fluid', nameAr: 'سائل الفرامل', weightKg: 2, lengthCm: 20.5, widthCm: 15, heightCm: 10 });
    expect(screen.getByText('2 kg')).toBeInTheDocument();
    expect(screen.getByText('20.5 × 15 × 10 cm')).toBeInTheDocument();
  });

  it('numbers typed with Arabic digits are accepted and sent as English numbers', async () => {
    const calls = [];
    globalThis.fetch = mockFetchRouter({ calls });
    render(<LeapAdminApp />);
    await loginAndGoToCategories();
    await openBrakeParts();
    fillPartNames();
    fillShipping({ weightKg: '٢', lengthCm: '٢٠', widthCm: '١٥', heightCm: '١٠' });
    addPart();
    await waitFor(() => expect(screen.getByText('Brake Fluid')).toBeInTheDocument());
    expect(calls.find((c) => c.method === 'POST' && c.url.endsWith('/parts')).body).toMatchObject({ weightKg: 2, lengthCm: 20, widthCm: 15, heightCm: 10 });
  });

  it('CRITICAL: the edit dialog shows the part\'s current weight and size, and saving sends all four with the names; the row updates', async () => {
    const calls = [];
    globalThis.fetch = mockFetchRouter({ calls });
    render(<LeapAdminApp />);
    await loginAndGoToCategories();
    await openBrakeParts();
    await waitFor(() => screen.getByText('Front Brake Disc'));
    openEdit('Front Brake Disc');
    await waitFor(() => expect(dialogInput('Weight (kg)')).toBeTruthy());
    expect(['Weight (kg)', 'Length (cm)', 'Width (cm)', 'Height (cm)'].map((l) => dialogInput(l).value)).toEqual(['5', '30', '30', '5']);
    fireEvent.change(dialogInput('Weight (kg)'), { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(screen.getByText('6 kg')).toBeInTheDocument());
    const patch = calls.find((c) => c.method === 'PATCH');
    expect(patch.url).toMatch(/\/catalog\/parts\/part_1$/);
    expect(patch.body).toEqual({ nameEn: 'Front Brake Disc', nameAr: 'قرص فرامل أمامي', weightKg: 6, lengthCm: 30, widthCm: 30, heightCm: 5 });
  });

  it('a part that has no weight or size yet can still be renamed: all four empty means only the names are sent', async () => {
    const calls = [];
    globalThis.fetch = mockFetchRouter({ calls });
    render(<LeapAdminApp />);
    await loginAndGoToCategories();
    await openBrakeParts();
    await waitFor(() => screen.getByText('Brake Hose'));
    openEdit('Brake Hose');
    await waitFor(() => expect(dialogInput('Weight (kg)')).toBeTruthy());
    expect(dialogInput('Weight (kg)').value).toBe('');
    fireEvent.change(dialogInput('English name'), { target: { value: 'Brake Line' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(screen.getByText('Brake Line')).toBeInTheDocument());
    expect(calls.find((c) => c.method === 'PATCH').body).toEqual({ nameEn: 'Brake Line', nameAr: 'خرطوم الفرامل' });          // no weight or size keys: left alone
    expect(screen.getAllByText('No weight or size yet')).toHaveLength(1);
  });

  it('CRITICAL: typing only some of the four in the edit dialog is refused with the missing one named, and nothing is sent', async () => {
    const calls = [];
    globalThis.fetch = mockFetchRouter({ calls });
    render(<LeapAdminApp />);
    await loginAndGoToCategories();
    await openBrakeParts();
    await waitFor(() => screen.getByText('Brake Hose'));
    openEdit('Brake Hose');
    await waitFor(() => expect(dialogInput('Weight (kg)')).toBeTruthy());
    fireEvent.change(dialogInput('Weight (kg)'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect((await screen.findAllByText('Length (cm) is required.')).length).toBeGreaterThan(0);        // shown in the dialog (and in the page's banner)
    expect(calls.filter((c) => c.method === 'PATCH')).toEqual([]);
    for (const [label, value] of [['Length (cm)', '20'], ['Width (cm)', '15'], ['Height (cm)', '-1']]) fireEvent.change(dialogInput(label), { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect((await screen.findAllByText('Height (cm) must be a number above zero.')).length).toBeGreaterThan(0);
    expect(calls.filter((c) => c.method === 'PATCH')).toEqual([]);
  });

  it('CRITICAL: what the admin typed stays in the dialog after a validation message (nothing has to be typed again)', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAndGoToCategories();
    await openBrakeParts();
    await waitFor(() => screen.getByText('Brake Hose'));
    openEdit('Brake Hose');
    await waitFor(() => expect(dialogInput('Weight (kg)')).toBeTruthy());
    fireEvent.change(dialogInput('English name'), { target: { value: 'Brake Line' } });
    fireEvent.change(dialogInput('Weight (kg)'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await screen.findAllByText('Length (cm) is required.');
    expect(dialogInput('Weight (kg)').value).toBe('2');
    expect(dialogInput('English name').value).toBe('Brake Line');
  });
});
