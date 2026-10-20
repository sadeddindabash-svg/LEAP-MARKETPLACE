import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import CatalogEditorPanel from './CatalogEditorPanel';

// The editing screen, with the server replaced by fixed answers shaped like the real ones (see services/api/test/catalogImport.test.js).
const CATS = [
  { id: 'cat_brk', code: 'BRK', nameEn: 'Brakes', nameAr: 'الفرامل', nameZh: '制动', sortOrder: 10, photoUrl: '/uploads/placeholder-category.png', hasPlaceholderPhoto: true, partCount: 2 },
  { id: 'lighting', code: null, nameEn: 'Lighting', nameAr: 'الإضاءة', nameZh: null, sortOrder: 20, photoUrl: '/uploads/x.jpg', hasPlaceholderPhoto: false, partCount: 0 },
];
const part = (id, code, nameEn, over = {}) => ({ id, categoryId: 'cat_brk', code, nameEn, nameAr: 'طقم تيل', nameZh: '刹车片', subcategoryEn: nameEn, subcategoryAr: 'تيل', subcategoryZh: '刹车片', placementEn: 'Wheel', placementAr: 'عجلة', placementZh: '车轮',
  allowedPositions: ['Front', 'Rear'], appliesTo: 'All vehicles', specialShipping: null, keywordsEn: null, keywordsAr: null, keywordsZh: null, weightKg: 0.9, lengthCm: 25, widthCm: 15, heightCm: 10, sizeBasis: 'estimate', photoUrl: '/uploads/placeholder-part.png', hasPlaceholderPhoto: true, ...over });
const PARTS = [part('p1', 'BRK-001', 'Brake Pad Set'), part('p2', 'BRK-002', 'Brake Disc', { sizeBasis: 'measured', hasPlaceholderPhoto: false })];
let calls, answer;
function mockFetch() {
  calls = []; answer = {};
  globalThis.fetch = vi.fn(async (url, options) => {
    const u = String(url).replace(/^https?:\/\/[^/]+\/catalog\/admin/, ''); const method = options?.method || 'GET'; const body = options?.body ? JSON.parse(options.body) : null;
    calls.push({ method, url: u, auth: options?.headers?.Authorization, body });
    const custom = answer[`${method} ${u}`]; if (custom) return { ok: custom.status < 400, status: custom.status, json: async () => custom.body };
    if (method === 'GET' && u === '/categories') return { ok: true, status: 200, json: async () => CATS };
    if (method === 'GET' && u === '/categories/cat_brk/parts') return { ok: true, status: 200, json: async () => PARTS };
    if (method === 'PATCH' && u.startsWith('/parts/')) { const base = PARTS.find((p) => p.id === u.split('/')[2]); return { ok: true, status: 200, json: async () => ({ ...base, ...body, productsRenamed: 0, productsAffectedBySize: 0 }) }; }
    if (method === 'PATCH' && u.startsWith('/categories/')) return { ok: true, status: 200, json: async () => ({ ...CATS[0], ...body }) };
    if (method === 'POST' && u === '/parts/review') return { ok: true, status: 200, json: async () => ({ marked: 1 }) };
    return { ok: false, status: 404, json: async () => ({ error: 'not found' }) };
  });
}
async function openBrakes(props = {}) {
  render(<CatalogEditorPanel onSessionExpired={vi.fn()} {...props} />);
  fireEvent.click(await screen.findByRole('button', { name: /^Brakes/ })); await screen.findByText('BRK-001');
}
const patches = () => calls.filter((c) => c.method === 'PATCH');
beforeEach(() => { localStorage.clear(); localStorage.setItem('leap_admin_token', 'fake.jwt.token'); mockFetch(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('CatalogEditorPanel', () => {
  it('lists the categories, then the parts of the chosen one with their placeholder and estimate tags', async () => {
    await openBrakes();
    expect(calls[0].auth).toBe('Bearer fake.jwt.token'); expect(screen.getByText('Categories (2)')).toBeInTheDocument();
    expect(screen.getByText('BRK-002')).toBeInTheDocument(); expect(screen.getAllByText('estimate').length).toBe(1); expect(screen.getAllByText('placeholder').length).toBe(1); expect(screen.getAllByText('Front, Rear').length).toBe(2);
  });

  it('filters the parts', async () => {
    await openBrakes(); fireEvent.change(screen.getByLabelText('Filter parts'), { target: { value: 'disc' } });
    expect(screen.queryByText('BRK-001')).not.toBeInTheDocument(); expect(screen.getByText('BRK-002')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Filter parts'), { target: { value: 'zzz' } }); expect(screen.getByText('No parts to show.')).toBeInTheDocument();
  });

  it('saves ONLY the field that changed (the Chinese name) and updates the list', async () => {
    await openBrakes(); fireEvent.click(screen.getByRole('button', { name: 'Edit Brake Pad Set' }));
    fireEvent.change(screen.getByLabelText('Chinese name'), { target: { value: '刹车片组' } }); fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Part saved.');
    expect(patches()).toHaveLength(1); expect(patches()[0].url).toBe('/parts/p1'); expect(patches()[0].body).toEqual({ nameZh: '刹车片组' });
  });

  it('a typed size sends all four values and no size basis, and says it is now measured', async () => {
    await openBrakes(); fireEvent.click(screen.getByRole('button', { name: 'Edit Brake Pad Set' }));
    fireEvent.change(screen.getByLabelText('Weight (kg)'), { target: { value: '1.2' } }); fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('status')).toHaveTextContent(/marked as measured/);
    expect(patches()[0].body).toEqual({ weightKg: 1.2, lengthCm: 25, widthCm: 15, heightCm: 10 });
  });

  it('allowed positions are chosen with checkboxes and sent as a list', async () => {
    await openBrakes(); fireEvent.click(screen.getByRole('button', { name: 'Edit Brake Pad Set' }));
    fireEvent.click(screen.getByLabelText('Position Left')); fireEvent.click(screen.getByLabelText('Position Rear')); fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('status'); expect(patches()[0].body).toEqual({ allowedPositions: ['Front', 'Left'] });
  });

  it('a rename tells how many products follow it, and shipping changes are announced', async () => {
    answer['PATCH /parts/p1'] = { status: 200, body: { ...PARTS[0], nameEn: 'Brake Pad Kit', productsRenamed: 3, productsAffectedBySize: 2 } };
    await openBrakes(); fireEvent.click(screen.getByRole('button', { name: 'Edit Brake Pad Set' }));
    fireEvent.change(screen.getByLabelText('English name'), { target: { value: 'Brake Pad Kit' } }); fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    const status = await screen.findByRole('status'); expect(status).toHaveTextContent('3 product(s) that use it now carry the new name'); expect(status).toHaveTextContent('shipping of 2 product(s)');
    expect(await screen.findByText('Brake Pad Kit')).toBeInTheDocument();
  });

  it('a refusal from the server is shown and the form stays open so nothing typed is lost', async () => {
    answer['PATCH /parts/p1'] = { status: 400, body: { error: 'The sub-category "One Two Three Four" must be 1 to 3 words (it has 4)' } };
    await openBrakes(); fireEvent.click(screen.getByRole('button', { name: 'Edit Brake Pad Set' }));
    fireEvent.change(screen.getByLabelText('Sub-category (English)'), { target: { value: 'One Two Three Four' } }); fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/must be 1 to 3 words/);
    expect(screen.getByLabelText('Sub-category (English)')).toHaveValue('One Two Three Four'); expect(screen.getByRole('group', { name: 'Edit part' })).toBeInTheDocument();
  });

  it('saving without a change says so and sends nothing', async () => {
    await openBrakes(); fireEvent.click(screen.getByRole('button', { name: 'Edit Brake Pad Set' })); fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('status')).toHaveTextContent(/no field was changed/i); expect(patches()).toHaveLength(0);
  });

  it('"Mark size as reviewed" turns an estimate into a measured size (only offered for estimates)', async () => {
    await openBrakes(); fireEvent.click(screen.getByRole('button', { name: 'Edit Brake Disc' }));
    expect(screen.queryByRole('button', { name: /mark size as reviewed/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' })); fireEvent.click(screen.getByRole('button', { name: 'Edit Brake Pad Set' }));
    fireEvent.click(screen.getByRole('button', { name: /mark size as reviewed/i }));
    expect(await screen.findByRole('status')).toHaveTextContent(/marked as reviewed/i);
    const review = calls.find((c) => c.url === '/parts/review'); expect(review.method).toBe('POST'); expect(review.body).toEqual({ ids: ['p1'] });
    expect(screen.queryByRole('button', { name: /mark size as reviewed/i })).not.toBeInTheDocument();
  });

  it('edits a category (code and names) and an expired session returns to the login', async () => {
    const expired = vi.fn(); render(<CatalogEditorPanel onSessionExpired={expired} />);
    fireEvent.click(await screen.findByRole('button', { name: /^Brakes/ })); fireEvent.click(await screen.findByRole('button', { name: 'Edit category' }));
    fireEvent.change(screen.getByLabelText('Chinese name'), { target: { value: '刹车系统' } }); fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Category saved.'); expect(patches()[0]).toMatchObject({ url: '/categories/cat_brk', body: { nameZh: '刹车系统' } });
    fireEvent.click(screen.getByRole('button', { name: 'Edit category' })); answer['PATCH /categories/cat_brk'] = { status: 401, body: { error: 'x' } };
    fireEvent.change(screen.getByLabelText('Arabic name'), { target: { value: 'نظام' } }); fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(expired).toHaveBeenCalled());
  });
});
