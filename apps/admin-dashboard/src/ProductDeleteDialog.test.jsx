import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, renderHook, act } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Admin > All products > Delete: the window (check first, then delete or hide), the selection bar and the tick boxes. The server is replaced by fixed answers shaped like the real ones
// (the real ones are checked in services/api/test/productDelete.test.js).
const m = vi.hoisted(() => ({ check: vi.fn(), del: vi.fn(), moderate: vi.fn(), review: vi.fn() }));
vi.mock('./auth', () => { class SessionExpiredError extends Error {} return { SessionExpiredError, getStoredToken: () => 'admin-token', checkProductDelete: (...a) => m.check(...a), deleteProducts: (...a) => m.del(...a), bulkModerateProducts: (...a) => m.moderate(...a), sendProductsToReview: (...a) => m.review(...a) }; });
import ProductDeleteDialog, { ProductSelectionBar, SelectBox, SelectAllBox, useProductSelection, ProductViewSwitch, ProductReviewDialog, ProductPageDelete, DELETE_PHRASE } from './ProductDeleteDialog';
import { SessionExpiredError } from './auth';

const prod = (id, over = {}) => ({ id, name: `Part ${id}`, status: 'active', ...over });
const plan = (over = {}) => ({ deletable: [prod('a')], held: [], missing: [], alsoRemoved: [{ what: 'pictures', count: 2 }, { what: 'reviews', count: 1 }], needsPhrase: false, phrase: DELETE_PHRASE, ...over });
const result = (over = {}) => ({ deleted: [{ id: 'a', name: 'Part a' }], kept: [], missing: [], alsoRemoved: [], picturesRemoved: 2, ...over });
const show = async (ids = ['a'], props = {}) => { const view = render(<ProductDeleteDialog ids={ids} onClose={props.onClose || vi.fn()} onChanged={props.onChanged} onSessionExpired={props.onSessionExpired} />); await waitFor(() => expect(screen.queryByText('Checking what can be deleted…')).not.toBeInTheDocument()); return view; };
beforeEach(() => { vi.clearAllMocks(); m.check.mockResolvedValue(plan()); m.del.mockResolvedValue(result()); m.moderate.mockResolvedValue({ results: [{ productId: 'h', success: true }] }); });

describe('the check', () => {
  it('shows "checking" first, asks the server about exactly these products, and then says what will be deleted and what goes with it', async () => {
    render(<ProductDeleteDialog ids={['a']} onClose={vi.fn()} />); expect(screen.getByText('Checking what can be deleted…')).toBeInTheDocument(); await screen.findByText(/1 product will be deleted:/); expect(m.check).toHaveBeenCalledWith('admin-token', ['a']);
    expect(screen.getByText(/Part a\./)).toBeInTheDocument(); expect(screen.getByText('This also removes: 2 pictures, 1 reviews.')).toBeInTheDocument(); expect(screen.getByText('This cannot be undone.')).toBeInTheDocument(); expect(m.del).not.toHaveBeenCalled();
  });
  it('the title says "this product" for one and the number for several', async () => { const { unmount } = await show(['a']); expect(screen.getByRole('dialog', { name: 'Delete this product' })).toBeInTheDocument(); unmount(); m.check.mockResolvedValue(plan({ deletable: [prod('a'), prod('b')] })); await show(['a', 'b']); expect(screen.getByRole('dialog', { name: 'Delete 2 products' })).toBeInTheDocument(); });
  it('a long list shows the first eight names and "and N more"', async () => { m.check.mockResolvedValue(plan({ deletable: Array.from({ length: 11 }, (_, i) => prod(`p${i}`)), alsoRemoved: [] })); await show(Array.from({ length: 11 }, (_, i) => `p${i}`)); expect(screen.getByText(/Part p7 and 3 more\./)).toBeInTheDocument(); expect(screen.queryByText(/Part p8/)).not.toBeInTheDocument(); });
  it('nothing found says so; products not found are mentioned', async () => { m.check.mockResolvedValue(plan({ deletable: [], missing: ['x'], alsoRemoved: [] })); await show(['x']); expect(screen.getByText('1 product was not found (already deleted?).')).toBeInTheDocument(); expect(screen.queryByRole('button', { name: /^Delete \d/ })).not.toBeInTheDocument(); });
  it('a failed check is shown, and an expired sign-in goes to the sign-in page', async () => {
    m.check.mockRejectedValue(new Error('Request failed (500)')); const { unmount } = await show(); expect(screen.getByRole('alert')).toHaveTextContent('Request failed (500)'); unmount();
    const onSessionExpired = vi.fn(); m.check.mockRejectedValue(new SessionExpiredError('x')); await show(['a'], { onSessionExpired }); expect(onSessionExpired).toHaveBeenCalled();
  });
});
describe('deleting one product', () => {
  it('needs only one click (no sentence), sends confirm true, and says what happened', async () => {
    const onChanged = vi.fn(); await show(['a'], { onChanged }); expect(screen.queryByLabelText('Type to confirm')).not.toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: 'Delete 1 product' }));
    await waitFor(() => expect(m.del).toHaveBeenCalledWith('admin-token', ['a'], true)); expect(await screen.findByText('1 product was deleted. 2 pictures removed from the server.')).toBeInTheDocument(); expect(onChanged).toHaveBeenCalledWith('deleted');
  });
  it('the button cannot be pressed twice while it deletes', async () => { await show(); let release; m.del.mockReturnValueOnce(new Promise((r) => { release = r; })); fireEvent.click(screen.getByRole('button', { name: 'Delete 1 product' })); expect(await screen.findByRole('button', { name: 'Deleting…' })).toBeDisabled(); await act(async () => { release(result()); }); await screen.findByText(/was deleted/); });
  it('a refusal is shown and the window stays open so it can be tried again; an expired sign-in goes to the sign-in page', async () => {
    await show(); m.del.mockRejectedValueOnce(new Error('Request failed (500)')); fireEvent.click(screen.getByRole('button', { name: 'Delete 1 product' })); expect(await screen.findByRole('alert')).toHaveTextContent('Request failed (500)'); expect(screen.getByRole('button', { name: 'Delete 1 product' })).not.toBeDisabled();
    const onSessionExpired = vi.fn(); const second = render(<ProductDeleteDialog ids={['a']} onClose={vi.fn()} onSessionExpired={onSessionExpired} />); await waitFor(() => expect(screen.getAllByRole('button', { name: 'Delete 1 product' })).toHaveLength(2)); m.del.mockRejectedValueOnce(new SessionExpiredError('x')); fireEvent.click(within(second.container).getByRole('button', { name: 'Delete 1 product' })); await waitFor(() => expect(onSessionExpired).toHaveBeenCalled());
  });
  it('Cancel closes without deleting', async () => { const onClose = vi.fn(); await show(['a'], { onClose }); fireEvent.click(screen.getByRole('button', { name: 'Cancel' })); expect(onClose).toHaveBeenCalled(); expect(m.del).not.toHaveBeenCalled(); });
});
describe('deleting several', () => {
  beforeEach(() => { m.check.mockResolvedValue(plan({ deletable: [prod('a'), prod('b'), prod('c')] })); m.del.mockResolvedValue(result({ deleted: [{ id: 'a', name: 'Part a' }, { id: 'b', name: 'Part b' }, { id: 'c', name: 'Part c' }] })); });
  it('asks for the sentence; the button stays off for anything but exactly DELETE PRODUCTS; the sentence is sent', async () => {
    await show(['a', 'b', 'c']); const button = screen.getByRole('button', { name: 'Delete 3 products' }); expect(button).toBeDisabled();
    for (const v of ['delete products', 'DELETE PRODUCT', 'DELETE', 'REPLACE CATALOG', 'DELETE PRODUCTS ']) { fireEvent.change(screen.getByLabelText('Type to confirm'), { target: { value: v } }); expect(button).toBeDisabled(); }
    fireEvent.change(screen.getByLabelText('Type to confirm'), { target: { value: DELETE_PHRASE } }); expect(button).not.toBeDisabled(); fireEvent.click(button); await waitFor(() => expect(m.del).toHaveBeenCalledWith('admin-token', ['a', 'b', 'c'], DELETE_PHRASE)); expect(await screen.findByText('3 products were deleted. 2 pictures removed from the server.')).toBeInTheDocument();
  });
  it('the sentence the window asks for is the one the server asks for', () => { const server = readFileSync(join(__dirname, '../../../services/api/src/modules/catalog/productDelete.js'), 'utf8'); expect(/const PHRASE = '([^']+)'/.exec(server)[1]).toBe(DELETE_PHRASE); });
  it('only the products that CAN be deleted are sent, and ones that cannot are left out even when several were chosen', async () => {
    m.check.mockResolvedValue(plan({ deletable: [prod('a'), prod('b')], held: [prod('h', { reason: 'it has been in an order: order history keeps its products' })] })); await show(['a', 'b', 'h']); fireEvent.change(screen.getByLabelText('Type to confirm'), { target: { value: DELETE_PHRASE } }); fireEvent.click(screen.getByRole('button', { name: 'Delete 2 products' })); await waitFor(() => expect(m.del).toHaveBeenCalledWith('admin-token', ['a', 'b'], DELETE_PHRASE));
  });
});
describe('products that cannot be deleted', () => {
  const held = [prod('h1', { reason: 'it has been in an order: order history keeps its products' }), prod('h2', { reason: 'it is used in a quote request: that history keeps its products', status: 'inactive' }), prod('h3', { reason: 'it is used in the table zz: that history keeps its products' })];
  it('are listed with their reason, and offered to be hidden instead (not the ones already hidden)', async () => {
    m.check.mockResolvedValue(plan({ deletable: [], held })); const onChanged = vi.fn(); await show(['h1', 'h2', 'h3'], { onChanged }); expect(screen.getByText('3 products cannot be deleted:')).toBeInTheDocument(); expect(screen.getByText(/it is used in a quote request/)).toBeInTheDocument(); expect(screen.getByText(/\(already hidden\)/)).toBeInTheDocument(); expect(screen.queryByRole('button', { name: /^Delete \d/ })).not.toBeInTheDocument();
    m.moderate.mockResolvedValue({ results: [{ productId: 'h1', success: true }, { productId: 'h3', success: true }] }); fireEvent.click(screen.getByRole('button', { name: 'Hide them instead' })); await waitFor(() => expect(m.moderate).toHaveBeenCalledWith('admin-token', [{ productId: 'h1', action: 'reject' }, { productId: 'h3', action: 'reject' }]));
    expect(await screen.findByText('2 products are now hidden from shoppers.')).toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Hide them instead' })).not.toBeInTheDocument(); expect(onChanged).toHaveBeenCalledWith('hidden');
  });
  it('one product says "Hide it instead"; when all are already hidden there is nothing to offer; a failed hide is shown', async () => {
    m.check.mockResolvedValue(plan({ deletable: [], held: [held[0]] })); const { unmount } = await show(['h1']); m.moderate.mockRejectedValueOnce(new Error('Request failed (403)')); fireEvent.click(screen.getByRole('button', { name: 'Hide it instead' })); expect(await screen.findByRole('alert')).toHaveTextContent('Request failed (403)'); unmount();
    m.check.mockResolvedValue(plan({ deletable: [], held: [held[1]] })); await show(['h2']); expect(screen.queryByRole('button', { name: /Hide/ })).not.toBeInTheDocument();
  });
  it('after deleting, the ones that stayed are listed with the reason', async () => {
    m.check.mockResolvedValue(plan({ deletable: [prod('a')], held: [held[0]] })); m.del.mockResolvedValue(result({ kept: [{ id: 'h1', name: 'Part h1', reason: held[0].reason }] })); await show(['a', 'h1']);
    fireEvent.click(screen.getByRole('button', { name: 'Delete 1 product' })); await screen.findByText('1 product stays:'); expect(screen.getByText(/order history keeps its products/)).toBeInTheDocument();
  });
  it('asking about products that all stay changes nothing and does not call it a deletion', async () => { m.check.mockResolvedValue(plan({ deletable: [], held: [held[0]] })); await show(['h1']); expect(m.del).not.toHaveBeenCalled(); });
});
describe('the selection bar and the tick boxes', () => {
  it('the bar shows nothing for no selection; otherwise the count, Delete… and Clear selection', () => {
    const { container, rerender } = render(<ProductSelectionBar count={0} onDelete={vi.fn()} onClear={vi.fn()} />); expect(container).toBeEmptyDOMElement(); const onDelete = vi.fn(); const onClear = vi.fn(); rerender(<ProductSelectionBar count={3} onDelete={onDelete} onClear={onClear} />);
    expect(screen.getByText('3 selected')).toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: /Delete…/ })); fireEvent.click(screen.getByRole('button', { name: 'Clear selection' })); expect(onDelete).toHaveBeenCalledTimes(1); expect(onClear).toHaveBeenCalledTimes(1);
  });
  it('the selection hook ticks and unticks, ticks all of a page and unticks all of a page, keeps other pages, and clears', () => {
    const { result } = renderHook(() => useProductSelection()); act(() => result.current.toggle('a')); act(() => result.current.toggle('b')); expect([...result.current.picked]).toEqual(['a', 'b']); act(() => result.current.toggle('a')); expect([...result.current.picked]).toEqual(['b']);
    act(() => result.current.toggleAll(['b', 'c', 'd'])); expect([...result.current.picked].sort()).toEqual(['b', 'c', 'd']); act(() => result.current.toggleAll(['b', 'c', 'd'])); expect([...result.current.picked]).toEqual([]);
    act(() => result.current.toggle('other-page')); act(() => result.current.toggleAll(['x', 'y'])); act(() => result.current.toggleAll(['x', 'y'])); expect([...result.current.picked]).toEqual(['other-page']); act(() => result.current.clear()); expect(result.current.picked.size).toBe(0);
  });
  it('a row tick never opens the product (the click stops there), and the header tick follows the page', () => {
    const open = vi.fn(); const picked = new Set(['a']); const toggle = vi.fn(); const toggleAll = vi.fn();
    render(<div onClick={open}><SelectBox id="a" name="Pads" picked={picked} onToggle={toggle} /><SelectBox id="b" name="Discs" picked={picked} onToggle={toggle} /><SelectAllBox ids={['a', 'b']} picked={picked} onToggleAll={toggleAll} /><SelectAllBox ids={[]} picked={picked} onToggleAll={toggleAll} /></div>);
    expect(screen.getByLabelText('Select Pads').checked).toBe(true); expect(screen.getByLabelText('Select Discs').checked).toBe(false); fireEvent.click(screen.getByLabelText('Select Discs')); expect(toggle).toHaveBeenCalledWith('b'); expect(open).not.toHaveBeenCalled();
    const [all, empty] = screen.getAllByLabelText('Select all products on this page'); expect(all.checked).toBe(false); expect(empty).toBeDisabled(); expect(empty.checked).toBe(false); fireEvent.click(all); expect(toggleAll).toHaveBeenCalledWith(['a', 'b']);
  });
});

describe('hidden products can be found again', () => {
  it('the window tells the truth about where a hidden product goes (it is not found "by approving" in a list that does not show it)', async () => {
    m.check.mockResolvedValue(plan({ deletable: [], held: [prod('h', { reason: 'it has been in an order: order history keeps its products' })] })); await show(['h']); expect(screen.getByText(/Hidden products/)).toBeInTheDocument(); expect(screen.getByText(/send it back to review from there/)).toBeInTheDocument(); expect(screen.getByText(/“Hidden products”/)).toBeInTheDocument(); expect(document.body.textContent).not.toMatch(/\\u201c/); expect(screen.queryByText(/by approving it/)).not.toBeInTheDocument();
  });
  it('the switch shows which list is open, and only reacts to the OTHER one', () => {
    const onChange = vi.fn(); render(<ProductViewSwitch view="live" onChange={onChange} />); expect(screen.getByRole('button', { name: 'Live products' })).toHaveAttribute('aria-pressed', 'true'); expect(screen.getByRole('button', { name: 'Hidden products' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Live products' })); expect(onChange).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('button', { name: 'Hidden products' })); expect(onChange).toHaveBeenCalledWith('hidden');
  });
  it('the selection bar offers "Send back to review" only when it is given that action (the Hidden list)', () => {
    const { rerender } = render(<ProductSelectionBar count={2} onDelete={vi.fn()} onClear={vi.fn()} />); expect(screen.queryByRole('button', { name: 'Send back to review' })).not.toBeInTheDocument(); const onReview = vi.fn(); rerender(<ProductSelectionBar count={2} onDelete={vi.fn()} onClear={vi.fn()} onReview={onReview} />); fireEvent.click(screen.getByRole('button', { name: 'Send back to review' })); expect(onReview).toHaveBeenCalledTimes(1);
  });
});
describe('sending hidden products back to review', () => {
  beforeEach(() => { m.review.mockResolvedValue({ sent: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], skipped: [] }); });
  it('explains that they wait in Moderation and are NOT shown to shoppers until approved; Cancel does nothing', () => {
    const onClose = vi.fn(); render(<ProductReviewDialog ids={['a', 'b']} onClose={onClose} />); expect(document.body.textContent).toMatch(/2 hidden products go back to the Moderation queue, where you check them and approve them again\./); expect(document.body.textContent).not.toMatch(/\$/); expect(screen.getByText(/not/, { selector: 'b' })).toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: 'Cancel' })); expect(onClose).toHaveBeenCalled(); expect(m.review).not.toHaveBeenCalled();
  });
  it('sends the ids, says how many now wait in Moderation, and tells the list to refresh', async () => {
    const onChanged = vi.fn(); render(<ProductReviewDialog ids={['a', 'b']} onClose={vi.fn()} onChanged={onChanged} />); fireEvent.click(screen.getByRole('button', { name: 'Send back to review' })); await waitFor(() => expect(m.review).toHaveBeenCalledWith('admin-token', ['a', 'b'])); expect(await screen.findByText('2 products are now waiting in Moderation.')).toBeInTheDocument(); expect(onChanged).toHaveBeenCalledWith('reviewed');
  });
  it('one product reads in the singular; products that were not hidden are mentioned; nothing sent is said plainly and does not refresh', async () => {
    m.review.mockResolvedValue({ sent: [{ id: 'a', name: 'A' }], skipped: ['b'] }); const { unmount } = render(<ProductReviewDialog ids={['a', 'b']} onClose={vi.fn()} />); fireEvent.click(screen.getByRole('button', { name: 'Send back to review' })); expect(await screen.findByText('1 product is now waiting in Moderation.')).toBeInTheDocument(); expect(screen.getByText('1 product was left as they are (not hidden, or not found).')).toBeInTheDocument(); unmount();
    m.review.mockResolvedValue({ sent: [], skipped: ['x'] }); const onChanged = vi.fn(); render(<ProductReviewDialog ids={['x']} onClose={vi.fn()} onChanged={onChanged} />); fireEvent.click(screen.getByRole('button', { name: 'Send back to review' })); expect(await screen.findByText('Nothing was sent.')).toBeInTheDocument(); expect(onChanged).not.toHaveBeenCalled();
  });
  it('a failure is shown and it can be tried again; an expired sign-in goes to the sign-in page; it cannot be pressed twice', async () => {
    render(<ProductReviewDialog ids={['a']} onClose={vi.fn()} />); m.review.mockRejectedValueOnce(new Error('Request failed (500)')); fireEvent.click(screen.getByRole('button', { name: 'Send back to review' })); expect(await screen.findByRole('alert')).toHaveTextContent('Request failed (500)'); expect(screen.getByRole('button', { name: 'Send back to review' })).not.toBeDisabled();
    let release; m.review.mockReturnValueOnce(new Promise((r) => { release = r; })); fireEvent.click(screen.getByRole('button', { name: 'Send back to review' })); expect(await screen.findByRole('button', { name: 'Sending…' })).toBeDisabled(); await act(async () => { release({ sent: [{ id: 'a', name: 'A' }], skipped: [] }); }); await screen.findByText(/now waiting/);
    const onSessionExpired = vi.fn(); m.review.mockRejectedValueOnce(new SessionExpiredError('x')); render(<ProductReviewDialog ids={['a']} onClose={vi.fn()} onSessionExpired={onSessionExpired} />); fireEvent.click(screen.getAllByRole('button', { name: 'Send back to review' }).pop()); await waitFor(() => expect(onSessionExpired).toHaveBeenCalled());
  });
});

describe('the Delete button on a product\'s own page', () => {
  it('opens the window for exactly that product; after a deletion, closing it goes back to the list', async () => {
    const onBack = vi.fn(); render(<ProductPageDelete productId="a" onBack={onBack} />); expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: 'Delete this product' })); await screen.findByText(/1 product will be deleted/); expect(m.check).toHaveBeenCalledWith('admin-token', ['a']);
    fireEvent.click(screen.getByRole('button', { name: 'Delete 1 product' })); await screen.findByText(/was deleted/); expect(onBack).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('button', { name: 'Close', exact: true })); expect(onBack).toHaveBeenCalledTimes(1); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('closing without deleting (Cancel, or the product could not be deleted) stays on the product page', async () => {
    const onBack = vi.fn(); render(<ProductPageDelete productId="a" onBack={onBack} />); fireEvent.click(screen.getByRole('button', { name: 'Delete this product' })); await screen.findByText(/1 product will be deleted/); fireEvent.click(screen.getByRole('button', { name: 'Cancel' })); expect(onBack).not.toHaveBeenCalled(); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    m.check.mockResolvedValue(plan({ deletable: [], held: [prod('a', { reason: 'it has been in an order: order history keeps its products' })] })); fireEvent.click(screen.getByRole('button', { name: 'Delete this product' })); await screen.findByText(/cannot be deleted/); fireEvent.click(screen.getByRole('button', { name: 'Close', exact: true })); expect(onBack).not.toHaveBeenCalled();
  });
  it('hiding a product from its page does not take you away from it', async () => {
    m.check.mockResolvedValue(plan({ deletable: [], held: [prod('a', { reason: 'x' })] })); m.moderate.mockResolvedValue({ results: [{ productId: 'a', success: true }] }); const onBack = vi.fn(); render(<ProductPageDelete productId="a" onBack={onBack} />); fireEvent.click(screen.getByRole('button', { name: 'Delete this product' })); await screen.findByText(/cannot be deleted/); fireEvent.click(screen.getByRole('button', { name: 'Hide it instead' })); await screen.findByText(/now hidden/); fireEvent.click(screen.getByRole('button', { name: 'Close', exact: true })); expect(onBack).not.toHaveBeenCalled();
  });
});
