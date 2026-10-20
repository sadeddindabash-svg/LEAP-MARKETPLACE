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
let calls, answers;
function mockFetch() {
  calls = [];
  answers = {
    preview: () => ({ status: 200, body: preview() }), commit: () => ({ status: 201, body: { imported: true, batchId: 'cimp_1', ...preview() } }), health: () => ({ status: 200, body: HEALTH }),
    batches: () => ({ status: 200, body: [] }), undo: () => ({ status: 200, body: { undone: true, partsRemoved: 3, categoriesRemoved: 2, partsKeptBecauseInUse: 0, categoriesKeptBecauseInUse: 0, olderPartsFilledAndKept: 0, note: 'Blanks that the import filled on rows that already existed are kept.' } }),
  };
  globalThis.fetch = vi.fn(async (url, options) => {
    const u = String(url).replace(/^https?:\/\/[^/]+/, ''); const method = options?.method || 'GET';
    const form = options?.body instanceof FormData ? { file: options.body.get('file'), mode: options.body.get('mode') } : null;
    calls.push({ method, url: u, auth: options?.headers?.Authorization, form });
    if (u.endsWith('/import/template')) return { ok: true, status: 200, blob: async () => new Blob(['x']) };
    const which = u.endsWith('/preview') ? 'preview' : u.endsWith('/commit') ? 'commit' : u.endsWith('/health') ? 'health' : u.endsWith('/undo') ? 'undo' : 'batches';
    const a = answers[which]();
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
});
