import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// "Make the catalog exactly this sheet" on the catalog import screen: the choice, what is sent, the box of what would be removed, the typed confirmation, and the result. The server is replaced by fixed answers shaped like the real ones
// (the real ones are checked in services/api/test/catalogReplace.test.js).
vi.mock('./exportToExcel', () => ({ exportToExcel: vi.fn(async () => {}) }));
import { exportToExcel } from './exportToExcel';
import CatalogImportPanel from './CatalogImportPanel';
import { REPLACE_PHRASE } from './CatalogReplaceOptions';

const removal = (over = {}) => ({
  alsoProducts: false, counts: { categories: 2, parts: 3, products: 0 },
  categories: [{ id: 'electrical', name: 'Electrical', code: null }, { id: 'suspension', name: 'Suspension', code: 'SUS' }],
  parts: [{ id: 'p1', name: 'Alternator', category: 'electrical', code: null }, { id: 'p2', name: 'Starter', category: 'electrical', code: null }, { id: 'p3', name: 'Spring', category: 'suspension', code: null }], products: [],
  kept: { categories: [{ id: 'brake', name: 'Brake System', reason: '1 product uses it' }], parts: [{ id: 'p9', name: 'Pads', category: 'brake', reason: '1 product uses it' }], products: [] }, ...over,
});
const row = (n) => ({ rowNumber: n, category: 'Engine', code: `ENG-00${n}`, part: `Part ${n}`, positions: 'Front', size: { lengthCm: 1, widthCm: 1, heightCm: 1, weightKg: 1 }, sizeBasis: 'estimate', status: 'new', messages: [] });
const preview = (over = {}) => ({ fileName: 'Catalog.xlsx', mode: 'skip', sheet: 'Part types', rows: [row(2), row(3)], notes: [], nearDuplicates: [], issues: [], blocking: false, ready: true, nothingToImport: false, removal: null,
  summary: { rows: 2, rowsWithErrors: 0, rowsWithWarnings: 0, newCategories: 1, existingCategories: 0, updatedCategories: 0, newParts: 2, existingParts: 0, updatedParts: 0, placeholdersUsed: 3, productsAffected: 0, estimatedParts: 2, keptMeasuredSizes: 0 }, ...over });
let calls, answers;
beforeEach(() => {
  localStorage.clear(); localStorage.setItem('leap_admin_token', 't'); exportToExcel.mockClear(); URL.createObjectURL = vi.fn(() => 'blob:x'); URL.revokeObjectURL = vi.fn(); calls = [];
  answers = { preview: () => preview({ removal: removal() }), commit: () => ({ imported: true, batchId: 'cimp_1', picturesRemoved: 0, ...preview({ removal: removal() }) }) };
  globalThis.fetch = vi.fn(async (url, options) => {
    const u = String(url).replace(/^https?:\/\/[^/]+/, ''); const b = options?.body; const form = b instanceof FormData ? { removeOthers: b.get('removeOthers'), alsoProducts: b.get('alsoProducts'), confirm: b.get('confirm') } : null; calls.push({ url: u, form });
    if (u.endsWith('/health')) return { ok: true, status: 200, json: async () => ({ categories: { total: 1, inCatalog: 0, withoutRealPhoto: 0 }, parts: { total: 1, inCatalog: 0, withoutRealPhoto: 0, onEstimatedSize: 0 }, productsPricedOnEstimates: 0 }) };
    if (u.endsWith('/batches')) return { ok: true, status: 200, json: async () => [] };
    const which = u.endsWith('/preview') ? 'preview' : 'commit'; return { ok: true, status: which === 'commit' ? 201 : 200, json: async () => answers[which]() };
  });
});
const xlsx = () => new File([new Uint8Array(2048)], 'Catalog.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
const sent = (what) => calls.filter((c) => c.url.endsWith(`/${what}`));
const replaceBox = () => screen.getByLabelText(/Make the catalog exactly this sheet/); const productsBox = () => screen.getByLabelText(/Also delete the products that use the old categories/);
const check = async () => { fireEvent.change(screen.getByLabelText('Excel file'), { target: { files: [xlsx()] } }); fireEvent.click(screen.getByRole('button', { name: /check file/i })); await screen.findByText('rows read'); };
const importBtn = () => screen.getByRole('button', { name: /^Import \d/ });
const show = () => render(<CatalogImportPanel onSessionExpired={vi.fn()} />);

describe('the choice', () => {
  it('is off at first, and nothing about removal is sent while it is off', async () => {
    show(); expect(replaceBox().checked).toBe(false); expect(screen.queryByLabelText(/Also delete the products/)).not.toBeInTheDocument(); answers.preview = () => preview(); await check(); expect(sent('preview')[0].form.removeOthers).toBeNull(); expect(screen.queryByText(/Will be removed/)).not.toBeInTheDocument();
  });
  it('turning it on offers the products choice (off at first); both are sent with the check', async () => {
    show(); fireEvent.click(replaceBox()); expect(productsBox().checked).toBe(false); await check(); expect(sent('preview')[0].form).toEqual({ removeOthers: '1', alsoProducts: '0', confirm: '' });
  });
  it('changing a choice after the check checks the file again with the new choice, and clears the typed sentence', async () => {
    show(); fireEvent.click(replaceBox()); await check(); fireEvent.change(screen.getByLabelText('Type to confirm'), { target: { value: REPLACE_PHRASE } }); fireEvent.click(productsBox()); await waitFor(() => expect(sent('preview')).toHaveLength(2));
    expect(sent('preview')[1].form.alsoProducts).toBe('1'); await screen.findByText('rows read'); expect(screen.getByLabelText('Type to confirm').value).toBe('');
  });
  it('the sentence to type is the one the server asks for', () => { const server = readFileSync(join(__dirname, '../../../services/api/src/modules/catalogImport/replace.js'), 'utf8'); expect(/REPLACE_PHRASE = '([^']+)'/.exec(server)[1]).toBe(REPLACE_PHRASE); });
});
describe('what would be removed', () => {
  it('says how many categories and sub-categories, lists them, and lists what stays and why', async () => {
    show(); fireEvent.click(replaceBox()); await check(); expect(screen.getByText('Will be removed (it is not in this sheet)')).toBeInTheDocument(); expect(screen.getByText('2 categories').tagName).toBe('B'); expect(screen.getByText('3 sub-categories').tagName).toBe('B'); expect(screen.queryByText(/\d products?$/)).not.toBeInTheDocument();
    expect(screen.getByText(/Electrical/)).toBeInTheDocument(); expect(screen.getByText(/Alternator/)).toBeInTheDocument(); expect(screen.getByText(/Suspension \(SUS\)/)).toBeInTheDocument(); expect(screen.getByText(/2 items stay because a product still uses them/)).toBeInTheDocument();
    expect(screen.getByText(/Category Brake System:/)).toBeInTheDocument(); expect(screen.getAllByText('1 product uses it')).toHaveLength(2);
  });
  it('with the products choice on, it also says how many products would go and lists them', async () => {
    answers.preview = () => preview({ removal: removal({ alsoProducts: true, counts: { categories: 2, parts: 3, products: 2 }, products: [{ id: 'pr1', name: 'Old pad', category: 'brake', part: 'Pads' }, { id: 'pr2', name: 'Old plug', category: 'engine', part: 'Plug' }] }) }); show(); fireEvent.click(replaceBox()); fireEvent.click(productsBox()); await check();
    expect(screen.getByText('2 products').tagName).toBe('B'); expect(screen.getByText(/Old pad/)).toBeInTheDocument();
  });
  it('says so when there is nothing old to remove', async () => { answers.preview = () => preview({ removal: removal({ counts: { categories: 0, parts: 0, products: 0 }, categories: [], parts: [], kept: { categories: [], parts: [], products: [] } }) }); show(); fireEvent.click(replaceBox()); await check(); expect(screen.getByText('Nothing old to remove')).toBeInTheDocument(); expect(screen.queryByText(/stay because/)).not.toBeInTheDocument(); });
  it('a long list shows the first twelve, with "Show all"', async () => {
    const parts = Array.from({ length: 30 }, (_, i) => ({ id: `q${i}`, name: `Old part ${i}`, category: 'x', code: null })); answers.preview = () => preview({ removal: removal({ counts: { categories: 0, parts: 30, products: 0 }, categories: [], parts }) }); show(); fireEvent.click(replaceBox()); await check();
    expect(screen.getAllByText(/Old part \d+/)).toHaveLength(12); fireEvent.click(screen.getByRole('button', { name: 'Show all 30' })); expect(screen.getAllByText(/Old part \d+/)).toHaveLength(30);
  });
  it('the list can be downloaded: removed and staying items, each marked', async () => {
    show(); fireEvent.click(replaceBox()); await check(); fireEvent.click(screen.getByRole('button', { name: /Download this list/ })); expect(exportToExcel).toHaveBeenCalledTimes(1); const { rows, filename } = exportToExcel.mock.calls[0][0]; expect(filename).toBe('Catalog_to_be_removed.xlsx');
    expect(rows.filter((r) => r.stays === 'removed')).toHaveLength(5); expect(rows.filter((r) => r.stays === 'stays').map((r) => r.reason)).toEqual(['1 product uses it', '1 product uses it']); expect(rows.find((r) => r.id === 'p1')).toMatchObject({ what: 'Sub-category', name: 'Alternator', category: 'electrical' });
  });
});
describe('the banner under the summary', () => {
  it('says in one line what will also be removed, right under the numbers (so a long list below cannot hide it), and its button goes to the list and the confirmation', async () => {
    const jump = vi.fn(); show(); fireEvent.click(replaceBox()); await check(); const note = screen.getByRole('note'); expect(note.textContent).toContain('This import will also remove 2 categories, 3 sub-categories that are not in this sheet.'); expect(note.textContent).not.toMatch(/product/);
    Element.prototype.scrollIntoView = jump; fireEvent.click(within(note).getByRole('button', { name: 'See the list and confirm' })); expect(jump).toHaveBeenCalledTimes(1); expect(document.getElementById('catalog-removal-box')).not.toBeNull();
    const order = [...document.body.querySelectorAll('[role=note], table')]; expect(order[0]).toBe(note);
  });
  it('counts the products too when they would be deleted, and says nothing when there is nothing to remove or the choice is off', async () => {
    answers.preview = () => preview({ removal: removal({ alsoProducts: true, counts: { categories: 1, parts: 0, products: 1 } }) }); const { unmount } = show(); fireEvent.click(replaceBox()); fireEvent.click(productsBox()); await check(); expect(screen.getByRole('note').textContent).toContain('1 category, 0 sub-categories, 1 product that are not in this sheet'); unmount();
    answers.preview = () => preview({ removal: removal({ counts: { categories: 0, parts: 0, products: 0 } }) }); const second = show(); fireEvent.click(replaceBox()); await check(); expect(screen.queryByRole('note')).not.toBeInTheDocument(); second.unmount();
    answers.preview = () => preview(); show(); await check(); expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });
});
describe('the typed confirmation and the import', () => {
  it('the import button is off until the exact sentence is typed (a wrong or half sentence does not count)', async () => {
    show(); fireEvent.click(replaceBox()); await check(); expect(importBtn()).toBeDisabled(); expect(importBtn().textContent).toBe('Import 1 category and 2 parts and remove 5 old items');
    for (const v of ['replace catalog', 'REPLACE', 'REPLACE CATALOG!', 'REMOVE OLD']) { fireEvent.change(screen.getByLabelText('Type to confirm'), { target: { value: v } }); expect(importBtn()).toBeDisabled(); }
    fireEvent.change(screen.getByLabelText('Type to confirm'), { target: { value: REPLACE_PHRASE } }); expect(importBtn()).not.toBeDisabled();
  });
  it('warns that it cannot be undone, and that Undo does not bring the removed items back', async () => { show(); fireEvent.click(replaceBox()); await check(); expect(screen.getByText('This cannot be undone.')).toBeInTheDocument(); expect(screen.getByText(/does not bring back what was removed here/)).toBeInTheDocument(); });
  it('the import sends the choices and the typed sentence; the result says what was removed', async () => {
    answers.commit = () => ({ imported: true, batchId: 'cimp_1', picturesRemoved: 4, ...preview({ removal: removal() }) }); show(); fireEvent.click(replaceBox()); await check(); fireEvent.change(screen.getByLabelText('Type to confirm'), { target: { value: REPLACE_PHRASE } }); fireEvent.click(importBtn());
    await screen.findByText('Import finished'); expect(sent('commit')[0].form).toEqual({ removeOthers: '1', alsoProducts: '0', confirm: REPLACE_PHRASE }); expect(screen.getByText(/Removed because they were not in the sheet: 2 categories, 3 sub-categories; 4 unused pictures deleted from the server\./)).toBeInTheDocument();
  });
  it('with the products choice the result also counts the products', async () => { answers.commit = () => ({ imported: true, batchId: 'c', picturesRemoved: 0, ...preview({ removal: removal({ alsoProducts: true, counts: { categories: 1, parts: 1, products: 1 } }) }) }); show(); fireEvent.click(replaceBox()); fireEvent.click(productsBox()); await check(); fireEvent.change(screen.getByLabelText('Type to confirm'), { target: { value: REPLACE_PHRASE } }); fireEvent.click(importBtn()); expect(await screen.findByText(/Removed because they were not in the sheet: 1 category, 1 sub-category, 1 product\./)).toBeInTheDocument(); });
  it('an ordinary import (the choice off) still reads "Import N categories and N parts" and has no removal line', async () => { answers.preview = () => preview(); answers.commit = () => ({ imported: true, batchId: 'c', ...preview() }); show(); await check(); expect(importBtn().textContent).toBe('Import 1 category and 2 parts'); expect(importBtn()).not.toBeDisabled(); fireEvent.click(importBtn()); await screen.findByText('Import finished'); expect(screen.queryByText(/not in the sheet/)).not.toBeInTheDocument(); });
  it('"Check another file" puts the choice back to off', async () => { show(); fireEvent.click(replaceBox()); await check(); fireEvent.change(screen.getByLabelText('Type to confirm'), { target: { value: REPLACE_PHRASE } }); fireEvent.click(importBtn()); await screen.findByText('Import finished'); fireEvent.click(screen.getByRole('button', { name: 'Check another file' })); expect(replaceBox().checked).toBe(false); });
  it('a refusal from the server (the sentence missing) is shown and nothing is reported as removed', async () => {
    show(); fireEvent.click(replaceBox()); await check(); fireEvent.change(screen.getByLabelText('Type to confirm'), { target: { value: REPLACE_PHRASE } }); globalThis.fetch = vi.fn(async () => ({ ok: false, status: 400, json: async () => ({ error: 'To remove everything that is not in the sheet, type REPLACE CATALOG to confirm. Nothing was changed.' }) })); fireEvent.click(importBtn());
    expect(await screen.findByRole('alert')).toHaveTextContent('Nothing was changed.'); expect(screen.queryByText('Import finished')).not.toBeInTheDocument();
  });
});
