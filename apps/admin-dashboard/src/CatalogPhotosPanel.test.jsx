import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

// Categories > Photos: coverage, the shot list, choosing pictures and the preview with a status for each, importing in batches, Undo, and the switch, with the shop replaced by fixed values.
const m = vi.hoisted(() => ({ cov: vi.fn(), batches: vi.fn(), undo: vi.fn(), fallback: vi.fn(), upload: vi.fn(), shot: vi.fn() }));
vi.mock('./catalogPhotosApi', () => ({ fetchCoverage: (...a) => m.cov(...a), fetchBatches: (...a) => m.batches(...a), undoBatch: (...a) => m.undo(...a), saveFallback: (...a) => m.fallback(...a), uploadPhotos: (...a) => m.upload(...a), downloadShotList: (...a) => m.shot(...a) }));
vi.mock('./auth', () => { class SessionExpiredError extends Error {} return { SessionExpiredError, getStoredToken: () => 'admin-token', API_BASE_URL: 'http://api.test' }; });
import CatalogPhotosPanel from './CatalogPhotosPanel';
import { SessionExpiredError } from './auth';

const sec = (code, nameEn, hasPhoto, parts, withPhoto) => ({ id: `s-${code}`, code, nameEn, hasPhoto, parts, partsWithPhoto: withPhoto });
const part = (code, group, hasPhoto = false) => ({ code, group, hasPhoto });
const COV = () => ({
  sections: [sec('BRK', 'Brakes', false, 3, 0), sec('LGT', 'Lighting', true, 1, 1)],
  parts: [part('BRK-001', 'g1'), part('BRK-002', 'g1'), part('BRK-003', 'g2'), part('LGT-001', 'g3', true)],
  totals: { sections: 2, sectionsWithPhoto: 1, parts: 4, partsWithPhoto: 1, pictures: 5 }, fallback: false,
});
const prepare = vi.fn(async (file) => { if (file.name.startsWith('broken')) throw new Error('cannot read'); return { width: file.w ?? 800, height: file.h ?? 800, blob: new Blob(['jpeg'], { type: 'image/jpeg' }) }; });
const file = (name, extra = {}) => Object.assign(new File(['x'], name, { type: 'image/jpeg' }), extra);
const show = async (cov = COV(), batches = [], props = {}) => { m.cov.mockResolvedValue(cov); m.batches.mockResolvedValue({ batches }); const view = render(<CatalogPhotosPanel prepare={prepare} onSessionExpired={props.onSessionExpired} />); await screen.findByText('Catalog photos: where we are'); return view; };
const choose = async (files) => { fireEvent.change(screen.getByTestId('photo-files'), { target: { files } }); await screen.findByText(/will be saved/); };
const cards = () => screen.getAllByTestId('photo-card').map((c) => [within(c).getByText(/\.jpg|\.png/).textContent, c.textContent.replace(within(c).getByText(/\.jpg|\.png/).textContent, '').trim()]);
beforeEach(() => {
  vi.clearAllMocks(); globalThis.URL.createObjectURL = vi.fn(() => 'blob:preview'); globalThis.URL.revokeObjectURL = vi.fn();
  m.upload.mockImplementation(async (t, id, files) => ({ results: files.map((f) => ({ file: f.name, code: f.name.replace('.jpg', ''), status: 'saved' })) })); m.undo.mockResolvedValue({ status: 'undone', restored: 3, changedSince: 0 }); m.fallback.mockImplementation(async (t, on) => ({ fallback: on })); m.shot.mockResolvedValue();
});

describe('where we are', () => {
  it('shows how many sections and parts have a picture, how many pictures are still to make, and each section', async () => {
    await show(); expect(screen.getByText(/1 of 2 have a picture/)).toBeInTheDocument(); expect(screen.getByText(/1 of 4 have a picture/)).toBeInTheDocument(); expect(screen.getByText('3').closest('div').textContent).toContain('Pictures still to make: 3 of 5');
    expect(within(screen.getByTestId('cov-BRK')).getByText('0 / 3')).toBeInTheDocument(); expect(within(screen.getByTestId('cov-LGT')).getByText('1 / 1')).toBeInTheDocument(); expect(screen.getByRole('progressbar', { name: 'Sections with a picture' })).toHaveAttribute('aria-valuenow', '1');
  });
  it('a shop that cannot be reached shows the problem; an expired sign-in goes to the sign-in page', async () => {
    m.cov.mockRejectedValue(new Error('Request failed (500)')); m.batches.mockResolvedValue({ batches: [] }); const { unmount } = render(<CatalogPhotosPanel prepare={prepare} />); expect(await screen.findByRole('alert')).toHaveTextContent('Request failed (500)'); unmount();
    const onSessionExpired = vi.fn(); m.cov.mockRejectedValue(new SessionExpiredError('x')); render(<CatalogPhotosPanel prepare={prepare} onSessionExpired={onSessionExpired} />); await waitFor(() => expect(onSessionExpired).toHaveBeenCalled());
  });
  it('the two shot list buttons ask for everything, and for only what is missing; a failure is shown', async () => {
    await show(); fireEvent.click(screen.getByRole('button', { name: 'Download the shot list (everything)' })); await waitFor(() => expect(m.shot).toHaveBeenCalledWith('admin-token', false));
    fireEvent.click(screen.getByRole('button', { name: 'Download the shot list (only what is missing)' })); await waitFor(() => expect(m.shot).toHaveBeenCalledWith('admin-token', true));
    m.shot.mockRejectedValue(new Error('Request failed (500)')); fireEvent.click(screen.getByRole('button', { name: 'Download the shot list (everything)' })); expect(await screen.findByRole('alert')).toHaveTextContent('Request failed (500)');
  });
});

describe('the preview', () => {
  it('shows every picture with its status, and the numbers above it; nothing has been sent yet', async () => {
    await show(); await choose([file('BRK.jpg'), file('LGT.jpg'), file('BRK-002.jpg'), file('ZZZ-999.jpg'), file('holiday.jpg'), file('broken.jpg'), file('BRK-003.jpg', { w: 300, h: 300 }), file('brk.png')]);
    expect(cards()).toEqual([['BRK.jpg', 'new'], ['LGT.jpg', 'has a picture: kept'], ['BRK-002.jpg', 'newalso BRK-001'], ['ZZZ-999.jpg', 'no such code'], ['holiday.jpg', 'name is not a code'], ['broken.jpg', 'no previewnot a picture'], ['BRK-003.jpg', 'too small'], ['brk.png', 'same code twice']]);
    expect(screen.getByText(/will be saved/).textContent.replace(/\s+/g, ' ')).toBe('2 will be saved · 1 already have a picture (kept) · 5 problems'); expect(m.upload).not.toHaveBeenCalled(); expect(screen.getByRole('button', { name: 'Import 2 pictures' })).toBeInTheDocument();
  });
  it('"replace" turns kept pictures into replacements and the count follows; "only the problems" hides the rest', async () => {
    await show(); await choose([file('BRK.jpg'), file('LGT.jpg'), file('ZZZ-999.jpg')]); fireEvent.click(screen.getByLabelText(/Replace pictures that are already real/)); expect(cards().map((c) => c[1])).toEqual(['new', 'replaces a picture', 'no such code']); expect(screen.getByRole('button', { name: 'Import 2 pictures' })).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Show only the problems')); expect(cards()).toEqual([['ZZZ-999.jpg', 'no such code']]);
  });
  it('nothing to save means the Import button is off, and Start over throws the preview away', async () => {
    await show(); await choose([file('ZZZ-999.jpg')]); expect(screen.getByRole('button', { name: 'Import 0 pictures' })).toBeDisabled(); fireEvent.click(screen.getByRole('button', { name: 'Start over' }));
    expect(screen.queryByTestId('photo-card')).not.toBeInTheDocument(); expect(URL.revokeObjectURL).toHaveBeenCalled(); expect(screen.getByTestId('photo-files')).toBeInTheDocument();
  });
});

describe('importing', () => {
  it('sends only the pictures to save, named by code, in batches of 20 with ONE import id, then reports and refreshes the numbers', async () => {
    const big = { sections: [sec('BIG', 'Big', true, 45, 0)], parts: Array.from({ length: 45 }, (_, i) => part(`BIG-${String(i + 1).padStart(3, '0')}`, `g${i}`)), totals: { sections: 1, sectionsWithPhoto: 1, parts: 45, partsWithPhoto: 0, pictures: 46 }, fallback: false };
    await show(big); await choose([...Array.from({ length: 45 }, (_, i) => file(`big-${String(i + 1).padStart(3, '0')}.png`)), file('nope.jpg')]); m.cov.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Import 45 pictures' })); expect(await screen.findByText('Done.')).toBeInTheDocument();
    expect(m.upload.mock.calls.map((c) => c[2].length)).toEqual([20, 20, 5]); expect(new Set(m.upload.mock.calls.map((c) => c[1])).size).toBe(1); expect(m.upload.mock.calls[0][1]).toMatch(/^imp-/); expect(m.upload.mock.calls[0][0]).toBe('admin-token');
    expect(m.upload.mock.calls[0][2][0].name).toBe('BIG-001.jpg'); expect(m.upload.mock.calls[0][2][0].blob).toBeInstanceOf(Blob); expect(m.upload.mock.calls[0][3]).toBe(false); expect(screen.getByRole('status').textContent).toContain('45 saved'); expect(m.cov).toHaveBeenCalled();
  });
  it('the replace choice goes to the shop with the pictures', async () => { await show(); await choose([file('LGT.jpg')]); fireEvent.click(screen.getByLabelText(/Replace pictures that are already real/)); fireEvent.click(screen.getByRole('button', { name: 'Import 1 picture' })); await screen.findByText('Done.'); expect(m.upload.mock.calls[0][3]).toBe(true); });
  it('what the shop could not save is listed with its reason', async () => {
    await show(); await choose([file('BRK.jpg'), file('BRK-003.jpg')]); m.upload.mockResolvedValue({ results: [{ file: 'BRK.jpg', status: 'saved' }, { file: 'BRK-003.jpg', status: 'wrong_size' }] }); fireEvent.click(screen.getByRole('button', { name: 'Import 2 pictures' }));
    expect(await screen.findByText('Done.')).toBeInTheDocument(); expect(screen.getByText(/1 saved/)).toBeInTheDocument(); expect(screen.getByText('BRK-003.jpg: wrong size')).toBeInTheDocument();
  });
  it('a failure part-way stops, says how many were already saved, and the preview stays for another try', async () => {
    const many = { sections: [sec('BIG', 'Big', true, 30, 0)], parts: Array.from({ length: 30 }, (_, i) => part(`BIG-${String(i + 1).padStart(3, '0')}`, `g${i}`)), totals: { sections: 1, sectionsWithPhoto: 1, parts: 30, partsWithPhoto: 0, pictures: 31 }, fallback: false };
    await show(many); await choose(Array.from({ length: 30 }, (_, i) => file(`BIG-${String(i + 1).padStart(3, '0')}.jpg`))); m.upload.mockImplementationOnce(async (t, id, files) => ({ results: files.map((f) => ({ file: f.name, status: 'saved' })) })).mockRejectedValueOnce(new Error('Network down'));
    fireEvent.click(screen.getByRole('button', { name: 'Import 30 pictures' })); expect(await screen.findByRole('alert')).toHaveTextContent('Network down. 20 pictures were saved before it stopped'); expect(screen.getAllByTestId('photo-card')).toHaveLength(30);
  });
  it('an expired sign-in while importing goes to the sign-in page', async () => { const onSessionExpired = vi.fn(); await show(COV(), [], { onSessionExpired }); await choose([file('BRK.jpg')]); m.upload.mockRejectedValue(new SessionExpiredError('x')); fireEvent.click(screen.getByRole('button', { name: 'Import 1 picture' })); await waitFor(() => expect(onSessionExpired).toHaveBeenCalled()); });
});

describe('earlier imports and Undo', () => {
  const B = [{ id: 'b2', at: '2026-10-21T10:00:00.000Z', by: 'a', count: 3, undone: false }, { id: 'b1', at: '2026-10-20T09:00:00.000Z', by: 'a', count: 5, undone: true }];
  it('lists them; only one that is not undone has an Undo button', async () => { await show(COV(), B); expect(within(screen.getByTestId('batch-b2')).getByRole('button', { name: /Undo the import/ })).toBeInTheDocument(); expect(within(screen.getByTestId('batch-b1')).queryByRole('button')).not.toBeInTheDocument(); expect(within(screen.getByTestId('batch-b1')).getByText(/5 pictures · undone/)).toBeInTheDocument(); });
  it('Undo asks first; "No" does nothing; "Yes" undoes it, says how many came back, and refreshes', async () => {
    await show(COV(), B); const row = within(screen.getByTestId('batch-b2')); fireEvent.click(row.getByRole('button', { name: /Undo the import/ })); fireEvent.click(row.getByRole('button', { name: 'No' })); expect(m.undo).not.toHaveBeenCalled();
    fireEvent.click(row.getByRole('button', { name: /Undo the import/ })); m.cov.mockClear(); fireEvent.click(row.getByRole('button', { name: 'Yes, undo' })); await waitFor(() => expect(m.undo).toHaveBeenCalledWith('admin-token', 'b2')); expect(await screen.findByText('Undone: 3 pictures put back.')).toBeInTheDocument(); expect(m.cov).toHaveBeenCalled();
  });
  it('says so when some pictures had been changed since and were left as they are', async () => { m.undo.mockResolvedValue({ status: 'undone', restored: 1, changedSince: 2 }); await show(COV(), B); const row = within(screen.getByTestId('batch-b2')); fireEvent.click(row.getByRole('button', { name: /Undo the import/ })); fireEvent.click(row.getByRole('button', { name: 'Yes, undo' })); expect(await screen.findByText('Undone: 1 picture put back (2 changed since, left as they are).')).toBeInTheDocument(); });
  it('no imports yet says so', async () => { await show(); expect(screen.getByText(/None yet/)).toBeInTheDocument(); });
});

describe('the switch', () => {
  it('is off at first; turning it on is saved and explained; turning it off again says the tile is back', async () => {
    await show(); const box = screen.getByLabelText(/Show a product's own photo/); expect(box.checked).toBe(false); fireEvent.click(box); await waitFor(() => expect(m.fallback).toHaveBeenCalledWith('admin-token', true)); expect(await screen.findByText(/On: a section or part with no picture of its own now shows a product's photo/)).toBeInTheDocument(); expect(box.checked).toBe(true);
    fireEvent.click(box); await waitFor(() => expect(m.fallback).toHaveBeenCalledWith('admin-token', false)); expect(await screen.findByText(/Off: the "photo coming soon" tile is shown again/)).toBeInTheDocument();
  });
  it('a failure is shown and the switch stays as it was', async () => { await show(); m.fallback.mockRejectedValue(new Error('Request failed (500)')); const box = screen.getByLabelText(/Show a product's own photo/); fireEvent.click(box); expect(await screen.findByRole('alert')).toHaveTextContent('Request failed (500)'); expect(box.checked).toBe(false); });
});
