import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Admin > Settings > Free shipping: the switch, the limit and the fee, the live preview, the checks before saving, saving and the refusals. The server is replaced by fixed answers shaped like the real ones (the real ones are checked in services/api/test/freeShipping.test.js).
const m = vi.hoisted(() => ({ api: { fetchFreeShippingAdmin: vi.fn(), saveFreeShipping: vi.fn() } }));
vi.mock('./auth', () => { class SessionExpiredError extends Error {} return { SessionExpiredError, API_BASE_URL: 'http://api', getStoredToken: () => 'admin-token' }; });
vi.mock('./freeShippingApi', () => m.api);
vi.mock('./components/ui', () => ({ Card: ({ title, children }) => <section aria-label={title}>{children}</section> }));
import FreeShippingSection, { readAmount, checkAmounts, previewText } from './FreeShippingSection';
import { SessionExpiredError } from './auth';

const LIMITS = { maxThresholdUsd: 100000, maxFeeUsd: 10000 };
const stored = (over = {}) => ({ enabled: true, thresholdUsd: 50, feeUsd: 5, limits: LIMITS, ...over });
const show = async (data = stored(), props = {}) => { m.api.fetchFreeShippingAdmin.mockResolvedValue(data); render(<FreeShippingSection onSessionExpired={props.onSessionExpired} />); await screen.findByLabelText('Free shipping from'); };
const limit = () => screen.getByLabelText('Free shipping from'); const fee = () => screen.getByLabelText('Shipping fee below the limit'); const sw = () => screen.getByRole('switch'); const saveBtn = () => screen.getByRole('button', { name: /^Sav/ });
const type = (el, v) => fireEvent.change(el, { target: { value: v } });
beforeEach(() => { vi.clearAllMocks(); });

describe('the pure checks', () => {
  it('an amount is whole dollars or has up to two decimals, and not above the most the server allows', () => {
    expect(readAmount('50', 100, 'X')).toEqual({ value: 50 }); expect(readAmount(' 50.5 ', 100, 'X')).toEqual({ value: 50.5 }); expect(readAmount('0.25', 100, 'X')).toEqual({ value: 0.25 });
    for (const bad of ['', 'abc', '-1', '5.123', '1e3', '5,5', '.5', '5.']) expect(readAmount(bad, 100, 'X').problem, bad).toMatch(/enter an amount/); expect(readAmount('101', 100, 'The limit').problem).toBe('The limit cannot be more than 100');
  });
  it('with the switch ON both amounts must be above 0; OFF they may be 0', () => {
    expect(checkAmounts(true, '50', '5').problems).toEqual({}); expect(checkAmounts(true, '0', '5').problems.limit).toMatch(/above 0/); expect(checkAmounts(true, '50', '0').problems.fee).toMatch(/above 0/);
    expect(checkAmounts(false, '0', '0').problems).toEqual({}); expect(checkAmounts(false, 'abc', '0').problems.limit).toMatch(/enter an amount/);
  });
  it('the preview shows a small basket paying the fee and the limit shipping free; off it says shipping is always free', () => {
    expect(previewText(true, 50, 5)).toBe('A basket of $25.00 pays $5.00 shipping (total $30.00). A basket of $50.00 or more ships free.'); expect(previewText(true, 99.99, 4.25)).toBe('A basket of $49.99 pays $4.25 shipping (total $54.24). A basket of $99.99 or more ships free.'); expect(previewText(false, 50, 5)).toBe('Shipping fees are off: shipping is always free.');
  });
});
describe('what it shows', () => {
  it('shows Loading, then the stored switch, limit and fee with two decimals and the live preview', async () => {
    m.api.fetchFreeShippingAdmin.mockResolvedValue(stored()); render(<FreeShippingSection />); expect(screen.getByText('Loading…')).toBeInTheDocument(); await screen.findByLabelText('Free shipping from');
    expect(sw()).toBeChecked(); expect(limit()).toHaveValue('50.00'); expect(fee()).toHaveValue('5.00'); expect(screen.getByTestId('free-shipping-preview')).toHaveTextContent('A basket of $25.00 pays $5.00 shipping (total $30.00). A basket of $50.00 or more ships free.');
    expect(screen.getByText(/Applies to new orders only/)).toBeInTheDocument(); expect(m.api.fetchFreeShippingAdmin).toHaveBeenCalledWith('admin-token');
  });
  it('switched off (the default) it says shipping is always free', async () => { await show(stored({ enabled: false, thresholdUsd: 0, feeUsd: 0 })); expect(sw()).not.toBeChecked(); expect(screen.getByTestId('free-shipping-preview')).toHaveTextContent('Shipping fees are off: shipping is always free.'); });
  it('nothing to save until something is changed', async () => { await show(); expect(saveBtn()).toBeDisabled(); type(limit(), '60'); expect(saveBtn()).toBeEnabled(); type(limit(), '50'); expect(saveBtn()).toBeDisabled(); });
  it('changing ONLY the fee, or ONLY the switch, is also a change that can be saved', async () => { await show(); type(fee(), '6'); expect(saveBtn()).toBeEnabled(); type(fee(), '5.00'); expect(saveBtn()).toBeDisabled(); fireEvent.click(sw()); expect(saveBtn()).toBeEnabled(); fireEvent.click(sw()); expect(saveBtn()).toBeDisabled(); });
  it('the preview follows what is typed', async () => { await show(); type(limit(), '80'); type(fee(), '6.5'); expect(screen.getByTestId('free-shipping-preview')).toHaveTextContent('A basket of $40.00 pays $6.50 shipping (total $46.50). A basket of $80.00 or more ships free.'); });
});
describe('the checks before saving', () => {
  it('a limit or a fee of 0 with the switch on is explained and cannot be saved; the preview asks for a fix', async () => {
    await show(); type(limit(), '0'); expect(screen.getByText(/limit above 0/)).toBeInTheDocument(); expect(saveBtn()).toBeDisabled(); expect(screen.getByTestId('free-shipping-preview')).toHaveTextContent('Fix the amounts above');
    type(limit(), '50'); type(fee(), '0'); expect(screen.getByText(/fee above 0/)).toBeInTheDocument(); expect(saveBtn()).toBeDisabled(); expect(fee()).toHaveAttribute('aria-invalid', 'true');
  });
  it('text, three decimals and too large an amount are each refused in words', async () => {
    await show(); type(limit(), 'abc'); expect(screen.getByText(/limit: enter an amount/)).toBeInTheDocument(); type(limit(), '50.123'); expect(saveBtn()).toBeDisabled(); type(limit(), '100001'); expect(screen.getByText('The free-shipping limit cannot be more than 100000')).toBeInTheDocument();
    type(limit(), '50'); type(fee(), '10001'); expect(screen.getByText('The shipping fee cannot be more than 10000')).toBeInTheDocument(); expect(saveBtn()).toBeDisabled();
  });
  it('switching OFF allows 0 and 0, and can be saved', async () => { await show(); fireEvent.click(sw()); type(limit(), '0'); type(fee(), '0'); expect(screen.queryByRole('alert')).not.toBeInTheDocument(); expect(saveBtn()).toBeEnabled(); });
});
describe('saving', () => {
  it('sends the switch and the two amounts as NUMBERS, then shows Saved and has nothing more to save', async () => {
    await show(); m.api.saveFreeShipping.mockResolvedValue(stored({ thresholdUsd: 75.5, feeUsd: 4.25 })); type(limit(), '75.5'); type(fee(), '4.25'); fireEvent.click(saveBtn());
    await screen.findByText('Saved.'); expect(m.api.saveFreeShipping).toHaveBeenCalledWith('admin-token', { enabled: true, thresholdUsd: 75.5, feeUsd: 4.25 }); expect(limit()).toHaveValue('75.50'); expect(saveBtn()).toBeDisabled();
  });
  it('switching off is saved with the amounts kept', async () => { await show(); m.api.saveFreeShipping.mockResolvedValue(stored({ enabled: false })); fireEvent.click(sw()); fireEvent.click(saveBtn()); await screen.findByText('Saved.'); expect(m.api.saveFreeShipping).toHaveBeenCalledWith('admin-token', { enabled: false, thresholdUsd: 50, feeUsd: 5 }); });
  it('cannot be pressed twice while saving, and says Saving…', async () => {
    await show(); let done; m.api.saveFreeShipping.mockReturnValue(new Promise((r) => { done = r; })); type(limit(), '60'); fireEvent.click(saveBtn()); expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled(); fireEvent.click(screen.getByRole('button', { name: 'Saving…' })); expect(m.api.saveFreeShipping).toHaveBeenCalledTimes(1); done(stored({ thresholdUsd: 60 })); await screen.findByText('Saved.');
  });
  it('a refusal from the server is shown in its words, nothing is claimed saved, and the admin can fix and try again', async () => {
    await show(); m.api.saveFreeShipping.mockRejectedValueOnce(new Error('The free-shipping limit cannot be more than 100000')); type(limit(), '60'); fireEvent.click(saveBtn()); expect(await screen.findByRole('alert')).toHaveTextContent('cannot be more than 100000'); expect(screen.queryByText('Saved.')).not.toBeInTheDocument(); expect(saveBtn()).toBeEnabled();
    m.api.saveFreeShipping.mockResolvedValueOnce(stored({ thresholdUsd: 60 })); fireEvent.click(saveBtn()); await screen.findByText('Saved.'); expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('an expired sign-in hands over to the portal (no error is shown)', async () => { const gone = vi.fn(); await show(stored(), { onSessionExpired: gone }); m.api.saveFreeShipping.mockRejectedValue(new SessionExpiredError('x')); type(limit(), '60'); fireEvent.click(saveBtn()); await waitFor(() => expect(gone).toHaveBeenCalled()); expect(screen.queryByRole('alert')).not.toBeInTheDocument(); });
  it('typing after a Saved message clears it', async () => { await show(); m.api.saveFreeShipping.mockResolvedValue(stored({ thresholdUsd: 60 })); type(limit(), '60'); fireEvent.click(saveBtn()); await screen.findByText('Saved.'); type(limit(), '61'); expect(screen.queryByText('Saved.')).not.toBeInTheDocument(); });
});
describe('when it cannot load', () => {
  it('shows the reason and Try again reads it again', async () => {
    m.api.fetchFreeShippingAdmin.mockRejectedValueOnce(new Error('Request failed (500)')); render(<FreeShippingSection />); expect(await screen.findByRole('alert')).toHaveTextContent('Request failed (500)');
    m.api.fetchFreeShippingAdmin.mockResolvedValueOnce(stored()); fireEvent.click(screen.getByRole('button', { name: 'Try again' })); await screen.findByLabelText('Free shipping from'); expect(limit()).toHaveValue('50.00');
  });
  it('an expired sign-in while loading hands over to the portal', async () => { const gone = vi.fn(); m.api.fetchFreeShippingAdmin.mockRejectedValue(new SessionExpiredError('x')); render(<FreeShippingSection onSessionExpired={gone} />); await waitFor(() => expect(gone).toHaveBeenCalled()); });
});
