import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('./exportToExcel', () => ({ exportToExcel: vi.fn(async () => {}) }));
import { exportToExcel } from './exportToExcel';
import CatalogImportPanel from './CatalogImportPanel';

// The catalog import screen, with the server replaced by fixed answers shaped exactly like the real ones (checked against the real server in services/api/test/catalogImport.test.js).
const msg = (level, text) => ({ level, text });
const size = { lengthCm: 25, widthCm: 15, heightCm: 10, weightKg: 0.9 };
const row = (n, over = {}) => ({ rowNumber: n, category: 'Brakes', code: `BRK-00${n}`, part: `Part ${n}`, positions: 'Front, Rear', size, sizeBasis: 'estimate', status: 'new', messages: [], ...over });
function preview(over = {}) {
  const rows = over.rows || [row(2), row(3), row(4)];
  return {
    fileName: 'Leap_Parts_Catalog.xlsx', mode: 'skip', sheet: 'Part types', rows, notes: [], nearDuplicates: [], issues: [], blocking: false, ready: true, nothingToImport: false,
    summary: { rows: rows.length, rowsWithErrors: 0, rowsWithWarnings: 0, newCategories: 2, existingCategories: 0, updatedCategories: 0, newParts: 3, existingParts: 0, updatedParts: 0, placeholdersUsed: 5, productsAffected: 0, estimatedParts: 3, keptMeasuredSizes: 0, ...(over.summary || {}) },
    ...Object.fromEntries(Object.entries(over).filter(([k]) => !['rows', 'summary'].includes(k))),
  };
}
const HEALTH = { categories: { total: 8, inCatalog: 2, withoutRealPhoto: 2 }, parts: { total: 39, inCatalog: 3, withoutRealPhoto: 3, onEstimatedSize: 3 }, productsPricedOnEstimates: 1 };
const CLEAN = { removed: { categories: [{ id: 'engine', name: 'Engine' }, { id: 'lighting', name: 'Lighting' }], parts: [{ id: 'p1', name: 'Oil Filter', category: 'engine' }], products: [] },
  kept: { categories: [{ id: 'brake', name: 'Brake System', products: 1, parts: 7, reason: '1 product(s) still use it' }], products: [] }, hasImports: false, counts: { categories: 4, parts: 36, products: 0, categoriesKept: 2, productsKept: 0 } };
let calls, answers;
function mockFetch() {
  calls = [];
  answers = {
    preview: () => ({ status: 200, body: preview() }), commit: () => ({ status: 201, body: { imported: true, batchId: 'cimp_1', ...preview() } }), health: () => ({ status: 200, body: HEALTH }),
    cleanupPreview: () => ({ status: 200, body: CLEAN }), cleanupCommit: () => ({ status: 200, body: { removedNow: true, ...CLEAN } }),
    batches: () => ({ status: 200, body: [] }), undo: () => ({ status: 200, body: { undone: true, partsRemoved: 3, categoriesRemoved: 2, partsKeptBecauseInUse: 0, categoriesKeptBecauseInUse: 0, olderPartsFilledAndKept: 0, note: 'Blanks that the import filled on rows that already existed are kept.' } }),
  };
  globalThis.fetch = vi.fn(async (url, options) => {
    const u = String(url).replace(/^https?:\/\/[^/]+/, ''); const method = options?.method || 'GET';
    const form = options?.body instanceof FormData ? { file: options.body.get('file'), mode: options.body.get('mode') } : null;
    calls.push({ method, url: u, auth: options?.headers?.Authorization, form, json: typeof options?.body === 'string' ? JSON.parse(options.body) : null });
    if (u.endsWith('/import/template')) return { ok: true, status: 200, blob: async () => new Blob(['x']) };
    const which = u.includes('/cleanup/preview') ? 'cleanupPreview' : u.includes('/cleanup/commit') ? 'cleanupCommit' : u.endsWith('/preview') ? 'preview' : u.endsWith('/commit') ? 'commit' : u.endsWith('/health') ? 'health' : u.endsWith('/undo') ? 'undo' : 'batches';
    const a = await answers[which]();
    return { ok: a.status < 400, status: a.status, json: async () => a.body };
  });
}
const xlsx = (name = 'Leap_Parts_Catalog.xlsx') => new File([new Uint8Array(2048)], name, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
async function chooseAndCheck(props = {}) {
  render(<CatalogImportPanel onSessionExpired={vi.fn()} {...props} />);
  fireEvent.change(screen.getByLabelText('Excel file'), { target: { files: [xlsx()] } });
  fireEvent.click(screen.getByRole('button', { name: /check file/i }));
  await screen.findByText('rows read');
}
beforeEach(() => { localStorage.clear(); localStorage.setItem('leap_admin_token', 'fake.jwt.token'); mockFetch(); exportToExcel.mockClear(); URL.createObjectURL = vi.fn(() => 'blob:x'); URL.revokeObjectURL = vi.fn(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('CatalogImportPanel', () => {
  it('explains the file and downloads the template with the admin token', async () => {
    render(<CatalogImportPanel onSessionExpired={vi.fn()} />);
    expect(screen.getByText(/a main category is one word/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /download the template/i }));
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled());
    const t = calls.find((c) => c.url.endsWith('/catalog/admin/import/template')); expect(t.auth).toBe('Bearer fake.jwt.token');
  });

  it('checks the file (nothing is saved) and shows the counts, the placeholder and estimate warnings and every row', async () => {
    await chooseAndCheck();
    const check = calls.find((c) => c.url.endsWith('/import/preview')); expect(check.form.mode).toBe('skip'); expect(check.form.file.name).toBe('Leap_Parts_Catalog.xlsx');
    expect(screen.getByText('use the photo placeholder')).toBeInTheDocument(); expect(screen.getByText('sizes are estimates')).toBeInTheDocument();
    expect(screen.getByText(/saved as estimates/i)).toBeInTheDocument();
    expect(screen.getAllByText('Part 2').length).toBe(1); expect(screen.getAllByText(/25 x 15 x 10 cm, 0.9 kg/).length).toBe(3);
    expect(screen.getByRole('button', { name: /import 2 categories and 3 parts/i })).toBeEnabled();
    expect(calls.some((c) => c.url.endsWith('/import/commit'))).toBe(false);
  });

  it('warns about a look-alike of an existing category without merging anything', async () => {
    answers.preview = () => ({ status: 200, body: preview({ nearDuplicates: [{ newName: 'Brakes', existingName: 'Brake System', existingId: 'brake' }] }) });
    await chooseAndCheck();
    expect(screen.getByText(/possible duplicates of existing categories/i)).toBeInTheDocument(); expect(screen.getByText(/"Brakes" and the existing "Brake System"/)).toBeInTheDocument();
  });

  it('a file with problems cannot be imported, shows each problem, and can be filtered to problems only', async () => {
    const bad = preview({ blocking: true, ready: false, rows: [row(2), row(3, { status: 'error', messages: [msg('error', 'The main category "Brake System" must be exactly one word (it has 2)')] })], summary: { rowsWithErrors: 1 } });
    answers.preview = () => ({ status: 200, body: bad });
    await chooseAndCheck();
    expect(screen.getByText(/1 row has a problem/i)).toBeInTheDocument(); expect(screen.getByText(/must be exactly one word/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^import \d+ categor/i })).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/only rows with problems/i)); expect(screen.getByText('1 of 2 rows')).toBeInTheDocument();
  });

  it('imports, says what was added, and then lists the import with an Undo', async () => {
    let imported = false;
    answers.commit = () => { imported = true; return { status: 201, body: { imported: true, batchId: 'cimp_1', ...preview() } }; };
    answers.batches = () => ({ status: 200, body: imported ? [{ id: 'cimp_1', createdAt: '2026-10-20T10:00:00Z', createdBy: 'a', fileName: 'Leap_Parts_Catalog.xlsx', mode: 'skip', categoriesAdded: 2, partsAdded: 3, partsUpdated: 0, undoneAt: null }] : [] });
    await chooseAndCheck();
    fireEvent.click(screen.getByRole('button', { name: /import 2 categories and 3 parts/i }));
    expect(await screen.findByText('Import finished')).toBeInTheDocument(); expect(screen.getByText(/2 categories and 3 parts added/)).toBeInTheDocument(); expect(screen.getByText(/5 items use the photo placeholder/)).toBeInTheDocument();
    expect(await screen.findByText('Imports so far')).toBeInTheDocument(); expect(screen.getByRole('button', { name: /undo/i })).toBeInTheDocument();
  });

  it('update mode re-checks the file in that mode and shows the products whose shipping would change', async () => {
    answers.preview = () => ({ status: 200, body: preview({ summary: { updatedParts: 2, productsAffected: 4 } }) });
    await chooseAndCheck();
    fireEvent.click(screen.getByLabelText(/update rows that already exist/i));
    await waitFor(() => expect(calls.filter((c) => c.url.endsWith('/import/preview')).length).toBe(2));
    expect(calls.filter((c) => c.url.endsWith('/import/preview'))[1].form.mode).toBe('update');
    expect(await screen.findByText("products' shipping changes")).toBeInTheDocument(); expect(screen.getByText('to update')).toBeInTheDocument();
  });

  it('undo asks first, then removes what the import created and says what stayed', async () => {
    answers.batches = () => ({ status: 200, body: [{ id: 'cimp_1', createdAt: '2026-10-20T10:00:00Z', createdBy: 'a', fileName: 'Leap_Parts_Catalog.xlsx', mode: 'skip', categoriesAdded: 2, partsAdded: 3, partsUpdated: 0, undoneAt: null }] });
    render(<CatalogImportPanel onSessionExpired={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: /undo/i }));
    expect(screen.getByText(/parts that products use stay/i)).toBeInTheDocument(); expect(calls.some((c) => c.url.endsWith('/undo'))).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: /yes, undo it/i }));
    expect(await screen.findByText(/Import undone: 3 parts and 2 categories removed/)).toBeInTheDocument();
    expect(calls.find((c) => c.url.endsWith('/import/batches/cimp_1/undo')).method).toBe('POST');
  });

  it('shows the catalog health: placeholders, estimated sizes, and products shipped on estimates', async () => {
    render(<CatalogImportPanel onSessionExpired={vi.fn()} />);
    expect(await screen.findByText('Catalog health')).toBeInTheDocument();
    expect(screen.getByText('still without a real photo').previousSibling).toHaveTextContent('5'); expect(screen.getByText('parts on an estimated size').previousSibling).toHaveTextContent('3');
    expect(screen.getByText('products shipped on estimates').previousSibling).toHaveTextContent('1');
  });

  it('an expired session sends the admin back to the login', async () => {
    answers.preview = () => ({ status: 401, body: { error: 'x' } }); const expired = vi.fn();
    render(<CatalogImportPanel onSessionExpired={expired} />);
    fireEvent.change(screen.getByLabelText('Excel file'), { target: { files: [xlsx()] } }); fireEvent.click(screen.getByRole('button', { name: /check file/i }));
    await waitFor(() => expect(expired).toHaveBeenCalled());
  });

  it('a refusal that explains itself shows its message and its rows', async () => {
    answers.commit = () => ({ status: 400, body: { error: 'The file has problems, so nothing was imported. Fix them and check the file again.', ...preview({ blocking: true, ready: false, rows: [row(2, { status: 'error', messages: [msg('error', 'Position "Middle" is not accepted')] })], summary: { rowsWithErrors: 1 } }) } });
    await chooseAndCheck();
    fireEvent.click(screen.getByRole('button', { name: /import 2 categories and 3 parts/i }));
    const alerts = await screen.findAllByRole('alert'); expect(alerts.some((a) => /nothing was imported/.test(a.textContent))).toBe(true); expect(alerts.length).toBe(2); expect(screen.getByText(/"Middle" is not accepted/)).toBeInTheDocument();
  });

  it('start clean: shows what would be removed and what stays, and removes nothing yet', async () => {
    render(<CatalogImportPanel onSessionExpired={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /check what the old catalog contains/i }));
    expect(await screen.findByText('old categories to remove')).toBeInTheDocument(); expect(screen.getByText('old parts to remove').previousSibling).toHaveTextContent('36');
    expect(screen.getByText(/Categories that will be removed: Engine, Lighting/)).toBeInTheDocument(); expect(screen.getByText(/Stays: "Brake System": 1 product\(s\) still use it/)).toBeInTheDocument();
    expect(calls.some((c) => c.url.includes('/cleanup/commit'))).toBe(false); expect(calls.find((c) => c.url.includes('/cleanup/preview')).url).not.toMatch(/alsoProducts/);
  });

  it('start clean: the Remove button stays off until the exact confirmation is typed, then removes and offers the list', async () => {
    render(<CatalogImportPanel onSessionExpired={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /check what the old catalog contains/i })); await screen.findByText('old parts to remove');
    const remove = screen.getByRole('button', { name: /remove the old catalog/i }); expect(remove).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Confirmation'), { target: { value: 'remove old' } }); expect(remove).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Confirmation'), { target: { value: 'REMOVE OLD' } }); expect(remove).toBeEnabled(); fireEvent.click(remove);
    expect(await screen.findByText(/Old catalog removed: 4 categories, 36 parts/)).toBeInTheDocument();
    const commit = calls.find((c) => c.url.includes('/cleanup/commit')); expect(commit.method).toBe('POST'); expect(commit.json).toEqual({ confirm: 'REMOVE OLD', alsoProducts: false });
    fireEvent.click(screen.getByRole('button', { name: /download the list of what was removed/i })); expect(exportToExcel).toHaveBeenCalledTimes(1);
    expect(exportToExcel.mock.calls[0][0].rows.map((r) => r.name)).toEqual(['Engine', 'Lighting', 'Oil Filter']);
  });

  it('start clean: the products option re-checks the list with products, shows what stays, and is sent with the removal', async () => {
    const withProducts = { ...CLEAN, removed: { ...CLEAN.removed, products: [{ id: 'p1', name: 'Test brake pad', category: 'brake', part: null }] }, kept: { categories: [], products: [{ id: 'p2', name: 'Ordered pad', category: 'engine', part: null, reason: 'it has been in an order: order history keeps its products' }] }, counts: { ...CLEAN.counts, products: 1, productsKept: 1, categoriesKept: 0 } };
    answers.cleanupPreview = () => ({ status: 200, body: withProducts });
    render(<CatalogImportPanel onSessionExpired={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /check what the old catalog contains/i })); await screen.findByText('old parts to remove');
    fireEvent.click(screen.getByLabelText(/also delete the test products/i));
    expect(await screen.findByText('test products to remove')).toBeInTheDocument(); expect(screen.getByText(/Stays: product "Ordered pad": it has been in an order/)).toBeInTheDocument();
    expect(calls.filter((c) => c.url.includes('/cleanup/preview')).pop().url).toMatch(/alsoProducts=1/);
    fireEvent.change(screen.getByLabelText('Confirmation'), { target: { value: 'REMOVE OLD' } }); fireEvent.click(screen.getByRole('button', { name: /remove the old catalog/i }));
    await screen.findByText(/Old catalog removed/); expect(calls.find((c) => c.url.includes('/cleanup/commit')).json.alsoProducts).toBe(true);
  });

  it('start clean: says so when there is nothing old to remove, and warns when an import already exists', async () => {
    answers.cleanupPreview = () => ({ status: 200, body: { ...CLEAN, hasImports: true, removed: { categories: [], parts: [], products: [] }, kept: { categories: [], products: [] }, counts: { categories: 0, parts: 0, products: 0, categoriesKept: 0, productsKept: 0 } } });
    render(<CatalogImportPanel onSessionExpired={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /check what the old catalog contains/i }));
    expect(await screen.findByText('There is nothing old to remove.')).toBeInTheDocument(); expect(screen.getByText(/A catalog import already exists/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Confirmation')).not.toBeInTheDocument();
  });

  it('start clean: a refusal from the server is shown and nothing is reported as removed', async () => {
    answers.cleanupCommit = () => ({ status: 409, body: { error: 'Something else still uses part of the old catalog, so nothing was removed.' } });
    render(<CatalogImportPanel onSessionExpired={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /check what the old catalog contains/i })); await screen.findByText('old parts to remove');
    fireEvent.change(screen.getByLabelText('Confirmation'), { target: { value: 'REMOVE OLD' } }); fireEvent.click(screen.getByRole('button', { name: /remove the old catalog/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/nothing was removed/); expect(screen.queryByText(/Old catalog removed/)).not.toBeInTheDocument();
  });

  it('start clean: an expired session returns to the login', async () => {
    answers.cleanupPreview = () => ({ status: 401, body: { error: 'x' } }); const expired = vi.fn();
    render(<CatalogImportPanel onSessionExpired={expired} />); fireEvent.click(screen.getByRole('button', { name: /check what the old catalog contains/i }));
    await waitFor(() => expect(expired).toHaveBeenCalled());
  });

  it('start clean: while the list reloads after the products option is ticked, no old numbers are shown and Remove stays off', async () => {
    const withProducts = { ...CLEAN, counts: { ...CLEAN.counts, categories: 6, products: 2 } }; let release; let calls = 0;
    answers.cleanupPreview = () => (++calls === 1 ? { status: 200, body: CLEAN } : new Promise((resolve) => { release = () => resolve({ status: 200, body: withProducts }); }));
    render(<CatalogImportPanel onSessionExpired={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /check what the old catalog contains/i })); await screen.findByText('old parts to remove');
    fireEvent.change(screen.getByLabelText('Confirmation'), { target: { value: 'REMOVE OLD' } });
    fireEvent.click(screen.getByLabelText(/also delete the test products/i));
    expect(await screen.findByText('Checking…')).toBeInTheDocument(); expect(screen.queryByText('old categories to remove')).not.toBeInTheDocument(); expect(screen.getByRole('button', { name: /working|remove the old catalog/i })).toBeDisabled();
    release();
    expect(await screen.findByText('test products to remove')).toBeInTheDocument(); expect(screen.getByText('test products to remove').previousSibling).toHaveTextContent('2'); expect(screen.getByText('old categories to remove').previousSibling).toHaveTextContent('6');
  });
});
