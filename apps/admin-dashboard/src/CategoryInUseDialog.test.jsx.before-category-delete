import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Categories > delete > "real products still reference it": the window that shows what is in the way and clears it out. The server is replaced by fixed answers shaped like the real ones (checked in services/api/test/categoryRemove.test.js).
const m = vi.hoisted(() => ({ info: vi.fn(), remove: vi.fn() }));
vi.mock('./auth', () => { class SessionExpiredError extends Error {} return { SessionExpiredError, getStoredToken: () => 'admin-token', fetchCategoryInUse: (...a) => m.info(...a), removeCategoryWithProducts: (...a) => m.remove(...a) }; });
import CategoryInUseDialog, { REMOVE_PHRASE } from './CategoryInUseDialog';
import { SessionExpiredError } from './auth';

const info = (over = {}) => ({ category: { id: 'c1', name: 'Brakes' }, total: 6, byState: { live: 3, hidden: 1, 'waiting for review': 1, 'supplier drafts': 1 }, parts: 2, deletable: 4, sample: [{ id: 'a', name: 'Pad A', status: 'active' }, { id: 'b', name: 'Disc B', status: 'inactive' }, { id: 'c', name: 'Hose C', status: 'draft' }, { id: 'd', name: 'Rotor D', status: 'translating' }],
  held: [{ id: 'h1', name: 'Old Pad', status: 'active', reason: 'it has been in an order: order history keeps its products' }, { id: 'h2', name: 'Quoted Pad', status: 'active', reason: 'it is used in a quote request: that history keeps its products' }], heldTotal: 2, alsoRemoved: [{ what: 'pictures', count: 3 }, { what: 'reviews', count: 1 }], phrase: REMOVE_PHRASE, ...over });
const done = (over = {}) => ({ category: { id: 'c1', name: 'Brakes' }, removedProducts: 4, removedSubCategories: 1, categoryRemoved: false, kept: { products: [{ id: 'h1', name: 'Old Pad', status: 'active', reason: 'it has been in an order: order history keeps its products' }], subCategories: [], category: '2 products have to stay, so the category stays' }, picturesRemoved: 3, ...over });
const show = async (props = {}) => { const view = render(<CategoryInUseDialog categoryId="c1" categoryName="Brakes" onClose={props.onClose || vi.fn()} onChanged={props.onChanged} onSessionExpired={props.onSessionExpired} />); await waitFor(() => expect(screen.queryByText(/Looking at what still uses/)).not.toBeInTheDocument()); return view; };
const typeIt = (v = REMOVE_PHRASE) => fireEvent.change(screen.getByLabelText('Type to confirm'), { target: { value: v } });
beforeEach(() => { vi.clearAllMocks(); m.info.mockResolvedValue(info()); m.remove.mockResolvedValue(done()); });

describe('what is in the way', () => {
  it('says how many products use the category and in which state (including what no product list shows), and why those still count', async () => {
    await show(); expect(m.info).toHaveBeenCalledWith('admin-token', 'c1'); expect(screen.getByText('6 products').tagName).toBe('B'); expect(document.body.textContent).toContain('3 live, 1 hidden, 1 waiting for review, 1 supplier drafts.'); expect(screen.getByText(/do not appear in the product list, but they still count/)).toBeInTheDocument();
  });
  it('lists which products can be deleted and what goes with them, and which cannot, with the reasons', async () => {
    await show(); expect(screen.getByText('4 products can be deleted:')).toBeInTheDocument(); expect(document.body.textContent).toContain('Pad A, Disc B, Hose C, Rotor D.'); expect(screen.getByText('This also removes: 3 pictures, 1 reviews.')).toBeInTheDocument();
    expect(screen.getByText('2 products cannot be deleted')).toBeInTheDocument(); expect(screen.getByText(/it is used in a quote request/)).toBeInTheDocument(); expect(screen.getByText(/this category cannot be deleted completely while they exist/)).toBeInTheDocument();
  });
  it('a category with no products but sub-categories says so; with nothing at all that can go, there is nothing to press', async () => {
    m.info.mockResolvedValue(info({ total: 0, byState: { live: 0, hidden: 0, 'waiting for review': 0, 'supplier drafts': 0 }, deletable: 0, held: [], heldTotal: 0, sample: [], alsoRemoved: [] })); const { unmount } = await show(); expect(screen.getByText(/No product uses this category, but it still has 2 sub-categories\./)).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Delete the category' })).toBeDisabled(); unmount();
    m.info.mockResolvedValue(info({ deletable: 0, parts: 0, sample: [], alsoRemoved: [] })); await show(); expect(screen.getByText('There is nothing here that can be deleted.')).toBeInTheDocument(); expect(screen.queryByLabelText('Type to confirm')).not.toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });
  it('a failed look is shown; an expired sign-in goes to the sign-in page', async () => {
    m.info.mockRejectedValue(new Error('Request failed (500)')); const { unmount } = await show(); expect(screen.getByRole('alert')).toHaveTextContent('Request failed (500)'); unmount(); const onSessionExpired = vi.fn(); m.info.mockRejectedValue(new SessionExpiredError('x')); await show({ onSessionExpired }); expect(onSessionExpired).toHaveBeenCalled();
  });
  it('one product reads in the singular ("uses", "its history keeps it", "while it exists")', async () => {
    m.info.mockResolvedValue(info({ total: 1, byState: { live: 1, hidden: 0, 'waiting for review': 0, 'supplier drafts': 0 }, deletable: 0, parts: 0, sample: [], alsoRemoved: [], held: [{ id: 'h1', name: 'Old Pad', status: 'active', reason: 'it has been in an order: order history keeps its products' }], heldTotal: 1 })); await show();
    expect(document.body.textContent).toContain('1 product still uses this category: 1 live.'); expect(document.body.textContent).toContain('1 product cannot be deleted (its history keeps it):'); expect(document.body.textContent).toContain('while it exists.');
  });
  it('no raw code leaks into the text (no \\u escapes, no stray dollar signs)', async () => { await show(); expect(document.body.textContent).not.toMatch(/\\u[0-9a-f]{4}|\$/i); });
});
describe('clearing it out', () => {
  it('needs the exact sentence (anything else keeps the button off); the label says what will happen', async () => {
    await show(); const button = screen.getByRole('button', { name: 'Delete the 4 products that can go' }); expect(button).toBeDisabled();
    for (const v of ['delete category', 'DELETE CATEGORIES', 'DELETE PRODUCTS', 'DELETE CATEGORY ']) { typeIt(v); expect(button).toBeDisabled(); } typeIt(); expect(button).not.toBeDisabled();
  });
  it('when nothing has to stay the label says the category goes too', async () => { m.info.mockResolvedValue(info({ held: [], heldTotal: 0, total: 4, byState: { live: 2, hidden: 1, 'waiting for review': 1, 'supplier drafts': 0 } })); await show(); expect(screen.getByRole('button', { name: 'Delete 4 products and the category' })).toBeInTheDocument(); });
  it('the sentence it asks for is the one the server asks for', () => { const server = readFileSync(join(__dirname, '../../../services/api/src/modules/catalog/categoryRemove.js'), 'utf8'); expect(/const PHRASE = '([^']+)'/.exec(server)[1]).toBe(REMOVE_PHRASE); });
  it('sends the category and the sentence, then says what was deleted and why the category stays, and refreshes the page behind', async () => {
    const onChanged = vi.fn(); await show({ onChanged }); typeIt(); fireEvent.click(screen.getByRole('button', { name: 'Delete the 4 products that can go' })); await waitFor(() => expect(m.remove).toHaveBeenCalledWith('admin-token', 'c1', REMOVE_PHRASE));
    expect(await screen.findByText(/4 products were deleted, 1 sub-category\. 3 pictures removed from the server\. The category stays\./)).toBeInTheDocument(); expect(screen.getByText(/2 products have to stay, so the category stays/)).toBeInTheDocument(); expect(screen.getByText(/Old Pad/)).toBeInTheDocument(); expect(onChanged).toHaveBeenCalledTimes(1);
  });
  it('when everything went, the category was deleted too', async () => {
    m.remove.mockResolvedValue(done({ removedProducts: 6, removedSubCategories: 2, categoryRemoved: true, kept: { products: [], subCategories: [], category: null }, picturesRemoved: 0 })); await show(); typeIt(); fireEvent.click(screen.getByRole('button', { name: 'Delete the 4 products that can go' })); expect(await screen.findByText(/6 products were deleted, 2 sub-categories\. The category was deleted\./)).toBeInTheDocument(); expect(screen.queryByText(/The category stays:/)).not.toBeInTheDocument();
  });
  it('when nothing was removed the page behind is not refreshed', async () => { m.remove.mockResolvedValue(done({ removedProducts: 0, removedSubCategories: 0 })); const onChanged = vi.fn(); await show({ onChanged }); typeIt(); fireEvent.click(screen.getByRole('button', { name: 'Delete the 4 products that can go' })); await screen.findByText(/0 products were deleted\./); expect(onChanged).not.toHaveBeenCalled(); });
  it('the button cannot be pressed twice; a refusal is shown and can be tried again; an expired sign-in goes to the sign-in page', async () => {
    await show(); typeIt(); let release; m.remove.mockReturnValueOnce(new Promise((r) => { release = r; })); fireEvent.click(screen.getByRole('button', { name: 'Delete the 4 products that can go' })); expect(await screen.findByRole('button', { name: 'Deleting…' })).toBeDisabled(); await act(async () => { release(done()); }); await screen.findByText(/were deleted/);
    const second = await show(); m.remove.mockRejectedValueOnce(new Error('Request failed (500)')); const buttons = screen.getAllByLabelText('Type to confirm'); fireEvent.change(buttons[buttons.length - 1], { target: { value: REMOVE_PHRASE } }); const go = screen.getAllByRole('button', { name: 'Delete the 4 products that can go' }); fireEvent.click(go[go.length - 1]); expect((await screen.findAllByRole('alert'))[0]).toHaveTextContent('Request failed (500)'); second.unmount();
    const onSessionExpired = vi.fn(); await show({ onSessionExpired }); m.remove.mockRejectedValueOnce(new SessionExpiredError('x')); typeIt(); const last = screen.getAllByRole('button', { name: 'Delete the 4 products that can go' }); fireEvent.click(last[last.length - 1]); await waitFor(() => expect(onSessionExpired).toHaveBeenCalled());
  });
  it('Cancel closes without deleting', async () => { const onClose = vi.fn(); await show({ onClose }); fireEvent.click(screen.getByRole('button', { name: 'Cancel' })); expect(onClose).toHaveBeenCalled(); expect(m.remove).not.toHaveBeenCalled(); });
});
