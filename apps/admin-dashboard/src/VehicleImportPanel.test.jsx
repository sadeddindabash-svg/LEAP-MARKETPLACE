import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

vi.mock('./exportToExcel', () => ({ exportToExcel: vi.fn(async () => {}) }));
import { exportToExcel } from './exportToExcel';
import VehicleImportPanel from './VehicleImportPanel';

// The "Import from Excel" screen, with the server replaced by fixed answers shaped exactly like the real preview and import answers.
const msg = (level, text) => ({ level, text });
const NO_PIC = msg('warning', 'No picture: the version will be saved marked "No photo yet" (add the photo later by hand)');
function preview(over = {}) {
  const rows = over.rows || [
    { rowNumber: 2, brand: 'AITO', model: 'M5', year: 2022, version: 'AWD Flagship', seats: 5, picture: { width: 400, height: 400 }, status: 'new', messages: [] },
    { rowNumber: 3, brand: 'AITO', model: 'M5', year: 2022, version: 'AWD Performance', seats: 5, picture: null, status: 'new', messages: [NO_PIC] },
  ];
  return {
    fileName: 'Leap_AITO.xlsx', mode: 'skip', sheet: 'AITO', rows, notes: [], issues: [], blocking: false, ready: true, nothingToImport: false,
    summary: { rows: rows.length, rowsWithErrors: 0, rowsWithWarnings: 1, picturesFound: 1, missingBrands: [], newModels: 1, newYears: 1, newVersions: 2, existingVersions: 0, updatedVersions: 0, picturesToSave: 1, newWithoutPicture: 1, brandNamesUpdated: 0, modelNamesUpdated: 0, ...(over.summary || {}) },
    ...Object.fromEntries(Object.entries(over).filter(([k]) => !['rows', 'summary'].includes(k))),
  };
}
let calls, answers;
function mockFetch() {
  calls = []; answers = { preview: () => ({ status: 200, body: preview() }), commit: () => ({ status: 201, body: { imported: true, ...preview() } }) };
  globalThis.fetch = vi.fn(async (url, options) => {
    const u = String(url).replace(/^https?:\/\/[^/]+/, ''); const method = options?.method || 'GET';
    const form = options?.body instanceof FormData ? { file: options.body.get('file'), mode: options.body.get('mode') } : null;
    calls.push({ method, url: u, auth: options?.headers?.Authorization, form });
    if (u.endsWith('/fitment/import/template')) return { ok: true, status: 200, blob: async () => new Blob(['x']) };
    const which = u.endsWith('/preview') ? 'preview' : 'commit';
    const a = answers[which]();
    return { ok: a.status < 400, status: a.status, json: async () => a.body };
  });
}
const xlsx = (name = 'Leap_AITO.xlsx') => new File([new Uint8Array(2048)], name, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
async function chooseAndCheck(props = {}) {
  render(<VehicleImportPanel onSessionExpired={vi.fn()} {...props} />);
  fireEvent.change(screen.getByLabelText('Excel file'), { target: { files: [xlsx()] } });
  fireEvent.click(screen.getByRole('button', { name: /check file/i }));
  await screen.findByText('rows read');
}
const importButton = () => screen.getByRole('button', { name: /^import \d+ vehicles?$|^importing/i });

beforeEach(() => {
  localStorage.clear(); localStorage.setItem('leap_admin_token', 'fake.jwt.token'); mockFetch(); exportToExcel.mockClear();
  URL.createObjectURL = vi.fn(() => 'blob:x'); URL.revokeObjectURL = vi.fn();
});
afterEach(() => { vi.restoreAllMocks(); });

describe('the Import from Excel screen', () => {
  it('the template is downloaded with the admin\'s token, as a file named Leap_Vehicle_Import_Template.xlsx', async () => {
    const clicked = []; vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () { clicked.push(this.download); });
    render(<VehicleImportPanel onSessionExpired={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /download the template/i }));
    await waitFor(() => expect(clicked).toEqual(['Leap_Vehicle_Import_Template.xlsx']));
    expect(calls[0]).toMatchObject({ method: 'GET', url: '/fitment/import/template', auth: 'Bearer fake.jwt.token' });
  });

  it('CRITICAL: nothing can be checked until a file is chosen; the check sends the file and the mode, writes nothing (it is the PREVIEW), and shows the numbers', async () => {
    render(<VehicleImportPanel onSessionExpired={vi.fn()} />);
    expect(screen.getByRole('button', { name: /check file/i })).toBeDisabled();
    expect(calls).toEqual([]);
    fireEvent.change(screen.getByLabelText('Excel file'), { target: { files: [xlsx()] } });
    expect(screen.getByText(/Leap_AITO\.xlsx/)).toBeInTheDocument();
    expect(screen.getByText(/2 KB/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /check file/i }));
    await screen.findByText('rows read');
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ method: 'POST', url: '/fitment/import/preview', auth: 'Bearer fake.jwt.token' });
    expect(calls[0].form.mode).toBe('skip'); expect(calls[0].form.file.name).toBe('Leap_AITO.xlsx');
    const tile = (label) => screen.getByText(label).previousSibling.textContent;
    expect(tile('rows read')).toBe('2'); expect(tile('new models')).toBe('1'); expect(tile('new years')).toBe('1'); expect(tile('new versions')).toBe('2');
    expect(tile('pictures found')).toBe('1'); expect(tile('saved as "No photo yet"')).toBe('1');
    expect(screen.getByText(/1 new version has no picture/)).toBeInTheDocument();
    expect(importButton()).toHaveTextContent('Import 2 vehicles'); expect(importButton()).toBeEnabled();
    expect(screen.getByText('400×400')).toBeInTheDocument();
  });

  it('CRITICAL: a brand that does not exist blocks the import: it is named, the Import button is off, and "Go to Brands" takes the admin there', async () => {
    answers.preview = () => ({ status: 200, body: preview({ blocking: true, ready: false, summary: { rowsWithErrors: 2, missingBrands: ['AITO'], newVersions: 0, newModels: 0, newYears: 0, newWithoutPicture: 0 },
      rows: [{ rowNumber: 2, brand: 'AITO', model: 'M5', year: 2022, version: 'A', seats: 5, picture: null, status: 'error', messages: [msg('error', 'Brand "AITO" does not exist yet. Add it first in Vehicle Data (Brands tab, with its photo), then check the file again.')] }] }) });
    const onGoToBrands = vi.fn();
    await chooseAndCheck({ onGoToBrands });
    expect(screen.getByRole('alert')).toHaveTextContent(/Brand "AITO" does not exist yet\. Add it first in the Brands tab.*blocks the import/);
    expect(importButton()).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /go to brands/i }));
    expect(onGoToBrands).toHaveBeenCalled();
  });

  it('rows with problems that are not a missing brand also block the import, and say how many', async () => {
    answers.preview = () => ({ status: 200, body: preview({ blocking: true, ready: false, summary: { rowsWithErrors: 3 }, rows: [{ rowNumber: 5, brand: 'AITO', model: 'M5', year: 2022, version: 'X', seats: 5, picture: null, status: 'error', messages: [msg('error', 'Engine (Chinese) is empty')] }] }) });
    await chooseAndCheck();
    expect(screen.getByRole('alert')).toHaveTextContent('3 rows have problems. Fix the file and check it again. This blocks the import.');
    expect(screen.getByText('Engine (Chinese) is empty')).toBeInTheDocument();
    expect(importButton()).toBeDisabled();
  });

  it('CRITICAL: choosing "Update rows that already exist" checks the SAME file again with that mode, and shows the "to update" count', async () => {
    await chooseAndCheck();
    answers.preview = () => ({ status: 200, body: preview({ mode: 'update', summary: { updatedVersions: 4, newVersions: 1 } }) });
    fireEvent.click(screen.getByLabelText(/update rows that already exist/i));
    await screen.findByText('to update');
    expect(calls.filter((c) => c.url.endsWith('/preview'))).toHaveLength(2);
    expect(calls[1].form.mode).toBe('update');
    expect(calls[1].form.file.name).toBe('Leap_AITO.xlsx');
    expect(screen.getByText('to update').previousSibling.textContent).toBe('4');
    expect(importButton()).toHaveTextContent('Import 5 vehicles');
  });

  it('CRITICAL: Import sends the file and the mode to the import, shows what was done, and offers to check another file', async () => {
    await chooseAndCheck();
    answers.commit = () => ({ status: 201, body: { imported: true, ...preview() } });
    fireEvent.click(importButton());
    await screen.findByText('Import finished');
    expect(calls.at(-1)).toMatchObject({ method: 'POST', url: '/fitment/import/commit' });
    expect(calls.at(-1).form.mode).toBe('skip');
    expect(screen.getByText(/2 versions added.*1 model and 1 year created.*1 picture saved/)).toBeInTheDocument();
    expect(screen.getByText(/1 version is marked "No photo yet"/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /check another file/i }));
    expect(screen.getByRole('button', { name: /check file/i })).toBeDisabled();
    expect(screen.queryByText('Import finished')).not.toBeInTheDocument();
  });

  it('CRITICAL: an import started after choosing "Update rows that already exist" is sent in UPDATE mode (not skip), with the same file', async () => {
    await chooseAndCheck();
    answers.preview = () => ({ status: 200, body: preview({ mode: 'update', summary: { updatedVersions: 3 } }) });
    fireEvent.click(screen.getByLabelText(/update rows that already exist/i));
    await screen.findByText('to update');
    fireEvent.click(importButton());
    await screen.findByText('Import finished');
    expect(calls.at(-1)).toMatchObject({ method: 'POST', url: '/fitment/import/commit' });
    expect(calls.at(-1).form.mode).toBe('update');
    expect(calls.at(-1).form.file.name).toBe('Leap_AITO.xlsx');
  });

  it('CRITICAL: if the import is refused (the file changed, or has problems) its own message and rows are shown, and nothing is marked done', async () => {
    await chooseAndCheck();
    answers.commit = () => ({ status: 400, body: { error: 'The file has problems, so nothing was imported. Fix them and check the file again.', ...preview({ blocking: true, ready: false, summary: { rowsWithErrors: 1 }, rows: [{ rowNumber: 9, brand: 'AITO', model: 'M5', year: 2022, version: 'Z', seats: 5, picture: null, status: 'error', messages: [msg('error', 'Seats (English) "13" is not a whole number from 1 to 12')] }] }) } });
    fireEvent.click(importButton());
    expect(await screen.findByText(/nothing was imported/)).toBeInTheDocument();
    expect(screen.getByText(/"13" is not a whole number from 1 to 12/)).toBeInTheDocument();
    expect(screen.queryByText('Import finished')).not.toBeInTheDocument();
    expect(importButton()).toBeDisabled();
  });

  it('"nothing to import" is explained, and the Import button stays off', async () => {
    answers.preview = () => ({ status: 200, body: preview({ ready: false, nothingToImport: true, summary: { newVersions: 0, newModels: 0, newYears: 0, existingVersions: 2, newWithoutPicture: 0 }, rows: [{ rowNumber: 2, brand: 'AITO', model: 'M5', year: 2022, version: 'A', seats: 5, picture: null, status: 'exists', messages: [msg('info', 'Already exists: skipped')] }] }) });
    await chooseAndCheck();
    expect(screen.getByText(/Nothing to import: every row already exists/)).toBeInTheDocument();
    expect(screen.getByText('Already exists')).toBeInTheDocument();
    expect(importButton()).toBeDisabled();
  });

  it('a file the server cannot read is explained in its own words and no result is shown', async () => {
    answers.preview = () => ({ status: 400, body: { error: 'This is not a valid .xlsx file. Save the sheet as an Excel Workbook (.xlsx) and try again.' } });
    render(<VehicleImportPanel onSessionExpired={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Excel file'), { target: { files: [xlsx('notes.xlsx')] } });
    fireEvent.click(screen.getByRole('button', { name: /check file/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('not a valid .xlsx file');
    expect(screen.queryByText('rows read')).not.toBeInTheDocument();
  });

  it('an expired session sends the admin back to sign in (check and import)', async () => {
    const onSessionExpired = vi.fn();
    answers.preview = () => ({ status: 401, body: { error: 'expired' } });
    render(<VehicleImportPanel onSessionExpired={onSessionExpired} />);
    fireEvent.change(screen.getByLabelText('Excel file'), { target: { files: [xlsx()] } });
    fireEvent.click(screen.getByRole('button', { name: /check file/i }));
    await waitFor(() => expect(onSessionExpired).toHaveBeenCalled());
  });

  it('with many rows the first 100 are shown and "Show all" shows the rest; "Problems and warnings only" narrows the list', async () => {
    const rows = Array.from({ length: 150 }, (_, i) => ({ rowNumber: i + 2, brand: 'AITO', model: 'M5', year: 2022, version: `V${i}`, seats: 5, picture: i % 50 === 0 ? null : { width: 400, height: 400 }, status: 'new', messages: i % 50 === 0 ? [NO_PIC] : [] }));
    answers.preview = () => ({ status: 200, body: preview({ rows, summary: { rows: 150, newVersions: 150 } }) });
    await chooseAndCheck();
    expect(screen.getAllByRole('row')).toHaveLength(1 + 100);
    expect(screen.getByText('150 of 150 rows')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /show all 150 rows/i }));
    expect(screen.getAllByRole('row')).toHaveLength(1 + 150);
    fireEvent.click(screen.getByLabelText(/problems and warnings only/i));
    expect(screen.getAllByRole('row')).toHaveLength(1 + 3);
    expect(screen.getByText('3 of 150 rows')).toBeInTheDocument();
  });

  it('the report is a spreadsheet with a line for every row: its row number, result, picture and messages', async () => {
    await chooseAndCheck();
    fireEvent.click(screen.getByRole('button', { name: /download report/i }));
    await waitFor(() => expect(exportToExcel).toHaveBeenCalled());
    const arg = exportToExcel.mock.calls[0][0];
    expect(arg.filename).toBe('Vehicle_import_report_Leap_AITO.xlsx');
    expect(arg.columns.map((c) => c.header)).toEqual(['Row', 'Brand', 'Model', 'Year', 'Version', 'Seats', 'Picture', 'Result', 'Messages']);
    expect(arg.rows).toHaveLength(2);
    expect(arg.rows[1]).toMatchObject({ row: 3, picture: 'none', result: 'New' });
    expect(arg.rows[1].messages).toMatch(/No picture/);
  });
});
