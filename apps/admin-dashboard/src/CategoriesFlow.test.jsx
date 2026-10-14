import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LeapAdminApp from './App';

const ADMIN_USER = { id: 'admin_dev_seed', email: 'admin@leap.dev', name: 'Dev Admin', role: 'admin', isOwner: true, allowedPages: 'all' };

const MOCK_CATEGORIES = [
  { id: 'brake', nameEn: 'Brake System', nameAr: 'نظام الفرامل', sortOrder: 10, weightKg: 5, lengthCm: 30, widthCm: 30, heightCm: 5 },
  { id: 'lighting', nameEn: 'Lighting', nameAr: 'الإضاءة', sortOrder: 20, weightKg: null, lengthCm: null, widthCm: null, heightCm: null },   // no weight or size yet
];
const MOCK_PARTS = [{ id: 'part_1', categoryId: 'brake', nameEn: 'Front Brake Disc', nameAr: 'قرص فرامل أمامي', sortOrder: 10 }];

function mockFetchRouter({ categories = MOCK_CATEGORIES, parts = MOCK_PARTS, calls = [] } = {}) {
  let cats = [...categories];
  let categoryParts = [...parts];
  return vi.fn((url, options) => {
    const u = String(url);
    const method = options?.method || 'GET';
    if (u.includes('/auth/login')) return Promise.resolve({ ok: true, json: async () => ({ token: 'fake.jwt.token', user: ADMIN_USER }) });
    if (u.includes('/auth/me')) return Promise.resolve({ ok: true, json: async () => ADMIN_USER });
    if (u.endsWith('/overview')) {
      return Promise.resolve({ ok: true, json: async () => ({ totalOrders: 0, activeSuppliers: 0, pendingSuppliers: 0, openDisputes: 0, pendingModeration: 0, openTickets: 0, ordersByDay: [], unitsByCategory: [], topSuppliers: [] }) });
    }
    if (method === 'POST' && u.endsWith('/catalog/categories')) {
      const b = JSON.parse(options.body);
      calls.push({ method, url: u, body: b });
      const newCat = { id: b.id, nameEn: b.nameEn, nameAr: b.nameAr, photoUrl: b.photoUrl, sortOrder: b.sortOrder, weightKg: b.weightKg ?? null, lengthCm: b.lengthCm ?? null, widthCm: b.widthCm ?? null, heightCm: b.heightCm ?? null };
      cats = [...cats, newCat];
      return Promise.resolve({ ok: true, status: 201, json: async () => newCat });
    }
    if (method === 'PATCH' && u.match(/\/catalog\/categories\/[^/]+$/)) {
      const b = JSON.parse(options.body);
      const id = u.split('/').pop();
      calls.push({ method, url: u, body: b });
      cats = cats.map((c) => (c.id === id ? { ...c, nameEn: b.nameEn, nameAr: b.nameAr, ...(b.weightKg !== undefined ? { weightKg: b.weightKg, lengthCm: b.lengthCm, widthCm: b.widthCm, heightCm: b.heightCm } : {}) } : c));
      return Promise.resolve({ ok: true, status: 200, json: async () => cats.find((c) => c.id === id) });
    }
    if (method === 'POST' && u.endsWith('/uploads/product-image')) {
      return Promise.resolve({ ok: true, status: 201, json: async () => ({ url: '/uploads/fake-category-photo.jpg', width: 1000, height: 1000, storage: 'local' }) });
    }
    if (u.endsWith('/catalog/categories')) return Promise.resolve({ ok: true, json: async () => cats });
    if (method === 'POST' && u.match(/\/catalog\/categories\/.+\/parts$/)) {
      const b = JSON.parse(options.body);
      const newPart = { id: 'part_new', categoryId: 'brake', nameEn: b.nameEn, nameAr: b.nameAr, sortOrder: b.sortOrder };
      categoryParts = [...categoryParts, newPart];
      return Promise.resolve({ ok: true, status: 201, json: async () => newPart });
    }
    if (u.match(/\/catalog\/categories\/.+\/parts$/)) return Promise.resolve({ ok: true, json: async () => categoryParts });
    return Promise.resolve({ ok: true, json: async () => ({}) });
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

// the Shipping group of the add form: Weight (kg), Length (cm), Width (cm), Height (cm)
const FIELD_LABELS = { weightKg: 'Weight (kg)', lengthCm: 'Length (cm)', widthCm: 'Width (cm)', heightCm: 'Height (cm)' };
function fillShipping(values) {
  for (const [key, value] of Object.entries(values)) fireEvent.change(screen.getByLabelText(FIELD_LABELS[key]), { target: { value } });
}
function fillNamesAndPhoto() {
  fireEvent.change(screen.getByPlaceholderText(/id \(e\.g\./i), { target: { value: 'tires' } });
  fireEvent.change(screen.getByPlaceholderText(/^english name$/i), { target: { value: 'Tires' } });
  fireEvent.change(screen.getByPlaceholderText(/arabic name/i), { target: { value: 'إطارات' } });
  fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [new File(['x'], 'category.jpg', { type: 'image/jpeg' })] } });
}
const writes = (calls) => calls.filter((c) => c.method !== 'GET');
// the edit dialog's own inputs, found by their label text
const dialogInput = (label) => screen.getAllByText(label).map((el) => el.parentElement.querySelector('input')).filter(Boolean).pop();

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
    fillShipping({ weightKg: '9', lengthCm: '60', widthCm: '60', heightCm: '20' });

    const file = new File(['fake-image-content'], 'category.jpg', { type: 'image/jpeg' });
    const fileInput = document.querySelector('input[type="file"]');
    fireEvent.change(fileInput, { target: { files: [file] } });

    fireEvent.click(screen.getByRole('button', { name: /add category/i }));

    await waitFor(() => expect(screen.getByText('Tires')).toBeInTheDocument());
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

  it('adding a new part inside a category calls the real create endpoint and shows it immediately', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAndGoToCategories();

    fireEvent.click(await screen.findByText('Brake System'));
    await waitFor(() => screen.getByPlaceholderText(/english part name/i));
    fireEvent.change(screen.getByPlaceholderText(/english part name/i), { target: { value: 'Brake Fluid' } });
    fireEvent.change(screen.getByPlaceholderText(/arabic name \(required\)/i), { target: { value: 'سائل الفرامل' } });
    fireEvent.click(screen.getByRole('button', { name: /add part/i }));

    await waitFor(() => expect(screen.getByText('Brake Fluid')).toBeInTheDocument());
  });

  it('shows a real empty state when a category has no parts yet', async () => {
    globalThis.fetch = mockFetchRouter({ parts: [] });
    render(<LeapAdminApp />);
    await loginAndGoToCategories();

    fireEvent.click(await screen.findByText('Brake System'));
    await waitFor(() => expect(screen.getByText(/no parts yet/i)).toBeInTheDocument());
  });

  // -------------------------------------------------------------------------------------------------------------------------------------------------------
  // Each category has a weight and a package size, set here by the admin: the shipping cost of every product in the category uses them (backend migration 103).
  // -------------------------------------------------------------------------------------------------------------------------------------------------------
  it('CRITICAL: each category row ends with its weight and size, and a category without them says "No weight or size yet"', async () => {
    globalThis.fetch = mockFetchRouter();
    render(<LeapAdminApp />);
    await loginAndGoToCategories();
    await waitFor(() => screen.getByText('Brake System'));
    expect(screen.getByText('5 kg')).toBeInTheDocument();
    expect(screen.getByText('30 × 30 × 5 cm')).toBeInTheDocument();
    expect(screen.getAllByText('No weight or size yet')).toHaveLength(1);      // Lighting only
  });

  it('CRITICAL: a new category needs all four values: each missing or invalid one is explained and nothing is sent', async () => {
    const calls = [];
    globalThis.fetch = mockFetchRouter({ calls });
    render(<LeapAdminApp />);
    await loginAndGoToCategories();
    await waitFor(() => screen.getByPlaceholderText(/id \(e\.g\./i));
    fillNamesAndPhoto();
    const add = () => fireEvent.click(screen.getByRole('button', { name: /add category/i }));
    add();
    expect(await screen.findByText('Weight (kg) is required.')).toBeInTheDocument();
    fillShipping({ weightKg: '9' }); add();
    expect(await screen.findByText('Length (cm) is required.')).toBeInTheDocument();
    fillShipping({ lengthCm: '60' }); add();
    expect(await screen.findByText('Width (cm) is required.')).toBeInTheDocument();
    fillShipping({ widthCm: '60' }); add();
    expect(await screen.findByText('Height (cm) is required.')).toBeInTheDocument();
    fillShipping({ heightCm: '0' }); add();
    expect(await screen.findByText('Height (cm) must be a number above zero.')).toBeInTheDocument();
    fillShipping({ heightCm: '-4' }); add();
    expect(await screen.findByText('Height (cm) must be a number above zero.')).toBeInTheDocument();
    fillShipping({ heightCm: 'abc' }); add();
    expect(await screen.findByText('Height (cm) must be a number above zero.')).toBeInTheDocument();
    expect(writes(calls).filter((c) => c.url.endsWith('/catalog/categories'))).toEqual([]);          // nothing was created by any of them
  });

  it('CRITICAL: a category with all four values is created with them as numbers, and its row shows them at once', async () => {
    const calls = [];
    globalThis.fetch = mockFetchRouter({ calls });
    render(<LeapAdminApp />);
    await loginAndGoToCategories();
    await waitFor(() => screen.getByPlaceholderText(/id \(e\.g\./i));
    fillNamesAndPhoto();
    fillShipping({ weightKg: '9', lengthCm: '60.5', widthCm: '60', heightCm: '20' });
    fireEvent.click(screen.getByRole('button', { name: /add category/i }));
    await waitFor(() => expect(screen.getByText('Tires')).toBeInTheDocument());
    const create = calls.find((c) => c.method === 'POST' && c.url.endsWith('/catalog/categories'));
    expect(create.body).toMatchObject({ id: 'tires', nameEn: 'Tires', weightKg: 9, lengthCm: 60.5, widthCm: 60, heightCm: 20 });
    expect(screen.getByText('9 kg')).toBeInTheDocument();
    expect(screen.getByText('60.5 × 60 × 20 cm')).toBeInTheDocument();
  });

  it('numbers typed with Arabic digits are accepted and sent as English numbers', async () => {
    const calls = [];
    globalThis.fetch = mockFetchRouter({ calls });
    render(<LeapAdminApp />);
    await loginAndGoToCategories();
    await waitFor(() => screen.getByPlaceholderText(/id \(e\.g\./i));
    fillNamesAndPhoto();
    fillShipping({ weightKg: '٩', lengthCm: '٦٠', widthCm: '٦٠', heightCm: '٢٠' });
    fireEvent.click(screen.getByRole('button', { name: /add category/i }));
    await waitFor(() => expect(screen.getByText('Tires')).toBeInTheDocument());
    expect(calls.find((c) => c.method === 'POST').body).toMatchObject({ weightKg: 9, lengthCm: 60, widthCm: 60, heightCm: 20 });
  });

  // the pencil button of a category's row (it has no text, only an icon)
  const openEdit = (name) => {
    let el = screen.getByText(name);
    while (el && !el.querySelector('.lucide-pencil')) el = el.parentElement;
    fireEvent.click(el.querySelector('.lucide-pencil').closest('button'));
  };

  it('CRITICAL: the edit dialog shows the current weight and size, and saving sends all four with the names; the row updates', async () => {
    const calls = [];
    globalThis.fetch = mockFetchRouter({ calls });
    render(<LeapAdminApp />);
    await loginAndGoToCategories();
    await waitFor(() => screen.getByText('Brake System'));
    openEdit('Brake System');
    await waitFor(() => expect(dialogInput('Weight (kg)')).toBeTruthy());
    expect(['Weight (kg)', 'Length (cm)', 'Width (cm)', 'Height (cm)'].map((l) => dialogInput(l).value)).toEqual(['5', '30', '30', '5']);
    fireEvent.change(dialogInput('Weight (kg)'), { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(screen.getByText('6 kg')).toBeInTheDocument());
    const patch = calls.find((c) => c.method === 'PATCH');
    expect(patch.url).toMatch(/\/catalog\/categories\/brake$/);
    expect(patch.body).toEqual({ nameEn: 'Brake System', nameAr: 'نظام الفرامل', weightKg: 6, lengthCm: 30, widthCm: 30, heightCm: 5 });
  });

  it('a category that has no weight or size yet can still be renamed: all four empty means only the names are sent', async () => {
    const calls = [];
    globalThis.fetch = mockFetchRouter({ calls });
    render(<LeapAdminApp />);
    await loginAndGoToCategories();
    await waitFor(() => screen.getByText('Lighting'));
    openEdit('Lighting');
    await waitFor(() => expect(dialogInput('Weight (kg)')).toBeTruthy());
    expect(dialogInput('Weight (kg)').value).toBe('');
    fireEvent.change(dialogInput('English name'), { target: { value: 'Lights' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(screen.getByText('Lights')).toBeInTheDocument());
    const patch = calls.find((c) => c.method === 'PATCH');
    expect(patch.body).toEqual({ nameEn: 'Lights', nameAr: 'الإضاءة' });          // no weight or size keys: they are left alone
    expect(screen.getAllByText('No weight or size yet')).toHaveLength(1);
  });

  it('CRITICAL: typing only some of the four in the edit dialog is refused with the missing one named, and nothing is sent', async () => {
    const calls = [];
    globalThis.fetch = mockFetchRouter({ calls });
    render(<LeapAdminApp />);
    await loginAndGoToCategories();
    await waitFor(() => screen.getByText('Lighting'));
    openEdit('Lighting');
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
    await waitFor(() => screen.getByText('Lighting'));
    openEdit('Lighting');
    await waitFor(() => expect(dialogInput('Weight (kg)')).toBeTruthy());
    fireEvent.change(dialogInput('English name'), { target: { value: 'Lights' } });
    fireEvent.change(dialogInput('Weight (kg)'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await screen.findAllByText('Length (cm) is required.');
    expect(dialogInput('Weight (kg)').value).toBe('2');
    expect(dialogInput('English name').value).toBe('Lights');
  });
});
