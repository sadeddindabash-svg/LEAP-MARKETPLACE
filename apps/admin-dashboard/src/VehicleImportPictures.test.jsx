import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// "Use the pictures in this file for vehicles that already exist": the choice on the vehicle import screen, what is sent with the file, the new tile, and the "old pictures removed" message. The server is replaced by fixed answers.
vi.mock('./exportToExcel', () => ({ exportToExcel: vi.fn(async () => {}) }));
import VehicleImportPanel from './VehicleImportPanel';

const preview = (summary = {}) => ({ fileName: 'ARCFOX.xlsx', mode: 'skip', sheet: 'Sheet1', rows: [{ rowNumber: 2, brand: 'ARCFOX', model: 'T1', year: 2024, version: 'Base', seats: 5, picture: { width: 400, height: 400 }, status: 'update', messages: [] }], notes: [], issues: [], blocking: false, ready: true, nothingToImport: false,
  summary: { rows: 1, rowsWithErrors: 0, rowsWithWarnings: 0, picturesFound: 1, missingBrands: [], newModels: 0, newYears: 0, newVersions: 0, existingVersions: 0, updatedVersions: 1, picturesToSave: 1, picturesReplaced: 1, newWithoutPicture: 0, ...summary } });
let calls, answers;
beforeEach(() => {
  localStorage.setItem('leap_admin_token', 't'); calls = []; answers = { preview: () => preview(), commit: () => ({ imported: true, oldPicturesRemoved: 2, ...preview() }) };
  globalThis.fetch = vi.fn(async (url, options) => {
    const u = String(url).replace(/^https?:\/\/[^/]+/, ''); const body = options?.body;
    calls.push({ url: u, mode: body instanceof FormData ? body.get('mode') : null, pictures: body instanceof FormData ? body.get('replacePictures') : null });
    if (u.includes('unused-pictures')) return { ok: true, status: 200, json: async () => ({ count: 0, bytes: 0, scanned: 0, tooNew: 0 }) };
    const which = u.endsWith('/preview') ? 'preview' : 'commit'; return { ok: true, status: which === 'commit' ? 201 : 200, json: async () => answers[which]() };
  });
});
const xlsx = () => new File([new Uint8Array(2048)], 'ARCFOX.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
const choose = () => fireEvent.change(screen.getByLabelText('Excel file'), { target: { files: [xlsx()] } });
const box = () => screen.getByLabelText(/Use the pictures in this file for vehicles that already exist/);
const sent = (what) => calls.filter((c) => c.url.endsWith(`/${what}`));
const check = async () => { choose(); fireEvent.click(screen.getByRole('button', { name: /check file/i })); await screen.findByText(/pictures found/); };
const show = () => render(<VehicleImportPanel onSessionExpired={vi.fn()} onGoToBrands={vi.fn()} />);

describe('the choice', () => {
  it('is there, ticked at first, and says the old pictures are removed', () => { show(); expect(box().checked).toBe(true); expect(screen.getByText(/the old pictures are removed/)).toBeInTheDocument(); });
  it('the file is checked with the choice sent as 1 (ticked) or 0 (unticked)', async () => {
    show(); await check(); expect(sent('preview')[0].pictures).toBe('1'); fireEvent.click(box()); await waitFor(() => expect(sent('preview')).toHaveLength(2)); expect(sent('preview')[1].pictures).toBe('0'); expect(box().checked).toBe(false);
  });
  it('unticked before checking sends 0, and the same choice goes with the import itself', async () => {
    show(); fireEvent.click(box()); await check(); expect(sent('preview')[0].pictures).toBe('0'); fireEvent.click(screen.getByRole('button', { name: /^import \d+ vehicles?$/i })); await screen.findByText('Import finished'); expect(sent('commit')[0].pictures).toBe('0');
    fireEvent.click(screen.getByRole('button', { name: /check another file/i })); expect(box().checked).toBe(true);
  });
  it('the import sends 1 when it is ticked', async () => { show(); await check(); fireEvent.click(screen.getByRole('button', { name: /^import \d+ vehicles?$/i })); await screen.findByText('Import finished'); expect(sent('commit')[0].pictures).toBe('1'); });
  it('when updating it is always on: shown ticked, and cannot be changed', async () => { show(); fireEvent.click(screen.getByLabelText(/update rows that already exist/i)); expect(box().checked).toBe(true); expect(box()).toBeDisabled(); expect(screen.getByText(/always on when updating/)).toBeInTheDocument(); });
});
describe('what the screen says', () => {
  it('shows how many pictures will replace old ones, and nothing when none will', async () => {
    answers.preview = () => preview({ picturesReplaced: 3 }); show(); await check(); expect(screen.getByText('pictures replace old ones').previousSibling.textContent).toBe('3');
  });
  it('no tile when no picture replaces an old one', async () => { answers.preview = () => preview({ picturesReplaced: 0 }); show(); await check(); expect(screen.queryByText('pictures replace old ones')).not.toBeInTheDocument(); });
  it('after the import it says how many old pictures were removed (singular and plural), and nothing when none were', async () => {
    show(); await check(); fireEvent.click(screen.getByRole('button', { name: /^import \d+ vehicles?$/i })); expect(await screen.findByText('2 old pictures were removed from the server.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /check another file/i })); answers.commit = () => ({ imported: true, oldPicturesRemoved: 1, ...preview() }); await check(); fireEvent.click(screen.getByRole('button', { name: /^import \d+ vehicles?$/i })); expect(await screen.findByText('1 old picture was removed from the server.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /check another file/i })); answers.commit = () => ({ imported: true, oldPicturesRemoved: 0, ...preview() }); await check(); fireEvent.click(screen.getByRole('button', { name: /^import \d+ vehicles?$/i })); await screen.findByText('Import finished'); expect(screen.queryByText(/removed from the server/)).not.toBeInTheDocument();
  });
  it('the "Pictures nothing uses" card is on the screen', () => { show(); expect(screen.getByText('Pictures nothing uses')).toBeInTheDocument(); });
});
