import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

// "Home page text" in the admin portal: the card, its three blocks, the font and size choices, Reset to default and Save, with the server replaced by fixed values.
const m = vi.hoisted(() => ({ fetch: vi.fn(), save: vi.fn() }));
vi.mock('./homeTextApi', () => ({ fetchHomeText: (...a) => m.fetch(...a), saveHomeText: (...a) => m.save(...a) }));
vi.mock('./auth', () => { class SessionExpiredError extends Error {} return { SessionExpiredError, getStoredToken: () => 'admin-token' }; });
import HomeTextSection from './HomeTextSection';
import { SessionExpiredError } from './auth';

const FONTS = ['default', 'inter', 'poppins', 'montserrat', 'cairo', 'tajawal']; const SIZES = ['small', 'medium', 'large', 'xlarge'];
const DEFAULTS = { topBar: { en: null, ar: null }, headline: { en: null, ar: null, font: 'default', size: 'large' }, subheadline: { en: null, ar: null, font: 'default', size: 'medium' } };
const serve = (text = DEFAULTS) => m.fetch.mockResolvedValue({ text, fonts: FONTS, sizes: SIZES });
const show = async (text, props = {}) => { serve(text); const view = render(<HomeTextSection onSessionExpired={props.onSessionExpired} />); await screen.findByText('Top bar message'); return view; };
const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const box = (name, lang) => document.getElementById(`home-text-${name}-${lang}`);
const type2 = (name, lang, value) => fireEvent.change(box(name, lang), { target: { value } });
beforeEach(() => { vi.clearAllMocks(); m.save.mockImplementation(async (token, text) => ({ text: { topBar: { en: text.topBar.en || null, ar: text.topBar.ar || null }, headline: { ...text.headline, en: text.headline.en || null, ar: text.headline.ar || null }, subheadline: { ...text.subheadline, en: text.subheadline.en || null, ar: text.subheadline.ar || null } } })); });

describe('the card', () => {
  it('shows the three blocks, with the current texts, fonts and sizes', async () => {
    await show({ topBar: { en: 'Free shipping', ar: 'شحن مجاني' }, headline: { en: 'Parts', ar: 'قطع', font: 'poppins', size: 'xlarge' }, subheadline: { en: 'Verified', ar: 'موثوق', font: 'cairo', size: 'small' } });
    expect(screen.getByText('Top bar message')).toBeInTheDocument(); expect(screen.getByText('Headline')).toBeInTheDocument(); expect(screen.getByText('Sub-headline')).toBeInTheDocument();
    expect(box('topBar', 'en').value).toBe('Free shipping'); expect(box('topBar', 'ar').value).toBe('شحن مجاني'); expect(box('headline', 'en').value).toBe('Parts');
    expect(screen.getByLabelText('Headline font').value).toBe('poppins'); expect(screen.getByLabelText('Headline size').value).toBe('xlarge'); expect(screen.getByLabelText('Sub-headline font').value).toBe('cairo'); expect(screen.getByLabelText('Sub-headline size').value).toBe('small');
  });
  it('empty fields show the website\'s own wording as a hint (so the admin sees what is used), and the top bar has no font or size', async () => {
    await show();
    expect(box('topBar', 'en').placeholder).toBe('Largest ready-to-ship warehouse for Chinese auto parts'); expect(box('headline', 'en').placeholder).toBe('Find the right part for your car');
    expect(box('subheadline', 'en').placeholder).toBe('Real parts from verified suppliers, matched to your vehicle.'); expect(screen.queryByLabelText('Top bar message font')).not.toBeInTheDocument();
  });
  it('offers the fonts and sizes the shop accepts, marking the default size of each', async () => {
    await show(); const fonts = [...screen.getByLabelText('Headline font').options].map((o) => o.value); expect(fonts).toEqual(FONTS);
    expect([...screen.getByLabelText('Headline size').options].map((o) => o.textContent)).toEqual(['Small', 'Medium', 'Large (website default)', 'Extra large']);
    expect([...screen.getByLabelText('Sub-headline size').options].map((o) => o.textContent)).toEqual(['Small', 'Medium (website default)', 'Large', 'Extra large']);
  });
  it('the Arabic fields read right to left, and every text has the same limit the shop enforces', async () => {
    await show(); expect(box('headline', 'ar').dir).toBe('rtl'); expect(box('headline', 'en').dir).toBe('ltr');
    expect([box('topBar', 'en').maxLength, box('headline', 'en').maxLength, box('subheadline', 'en').maxLength]).toEqual([160, 120, 240]);
  });
  it('a server that cannot be reached shows the problem instead of a broken card', async () => {
    m.fetch.mockRejectedValue(new Error('Request failed (500)')); render(<HomeTextSection />); expect(await screen.findByRole('alert')).toHaveTextContent('Request failed (500)');
  });
});

describe('the preview', () => {
  it('shows what is typed (or the website\'s wording) at the chosen size and font', async () => {
    await show(); expect(screen.getByTestId('preview-headline').textContent).toBe('Find the right part for your car');
    type2('headline', 'en', 'Parts for every car'); type('Headline size', 'xlarge'); type('Headline font', 'poppins');
    const p = screen.getByTestId('preview-headline'); expect(p.textContent).toBe('Parts for every car'); expect(p.style.fontSize).toBe('44px'); expect(p.style.fontFamily).toContain('Poppins');
  });
  it('the default font adds no font of its own', async () => { await show(); expect(screen.getByTestId('preview-subheadline').style.fontFamily).toBe(''); });
});

describe('saving', () => {
  it('Save is off until something changes', async () => {
    await show(); expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled(); type2('topBar', 'en', 'Hello'); expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled();
    type2('topBar', 'en', ''); expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
  it('sends all three blocks, trimmed, with the admin token, then says it was saved and goes quiet', async () => {
    await show(); type2('topBar', 'en', '  Free shipping  '); type2('headline', 'ar', 'قطع'); type('Headline font', 'poppins'); type('Sub-headline size', 'large'); fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(m.save).toHaveBeenCalled());
    expect(m.save.mock.calls[0][0]).toBe('admin-token');
    expect(m.save.mock.calls[0][1]).toEqual({ topBar: { en: 'Free shipping', ar: '' }, headline: { en: '', ar: 'قطع', font: 'poppins', size: 'large' }, subheadline: { en: '', ar: '', font: 'default', size: 'large' } });
    expect(await screen.findByRole('status')).toHaveTextContent('Saved. The website shows the change within about a minute.'); expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
  it('a refusal from the server is shown and what was typed is kept', async () => {
    await show(); m.save.mockRejectedValue(new Error('headline.font must be one of: default, inter')); type2('headline', 'en', 'Mine'); fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('headline.font must be one of'); expect(box('headline', 'en').value).toBe('Mine'); expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled();
  });
  it('an expired sign-in sends the admin to the sign-in page', async () => {
    const onSessionExpired = vi.fn(); await show(undefined, { onSessionExpired }); m.save.mockRejectedValue(new SessionExpiredError('expired')); type2('topBar', 'en', 'x'); fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSessionExpired).toHaveBeenCalled());
  });
  it('while it saves the button cannot be pressed twice', async () => {
    await show(); let release; m.save.mockReturnValue(new Promise((r) => { release = r; })); type2('topBar', 'en', 'x'); fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('button', { name: 'Saving…' })).toBeDisabled(); release({ text: DEFAULTS }); await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument());
  });
  it('editing again after saving takes the "Saved" message away', async () => {
    await show(); type2('topBar', 'en', 'x'); fireEvent.click(screen.getByRole('button', { name: 'Save' })); await screen.findByRole('status'); type2('topBar', 'en', 'xy'); expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('Reset to default', () => {
  const custom = { topBar: { en: 'Top', ar: 'أعلى' }, headline: { en: 'Head', ar: 'رأس', font: 'poppins', size: 'xlarge' }, subheadline: { en: 'Sub', ar: 'فرعي', font: 'cairo', size: 'small' } };
  it('clears that block: its texts, its font and its size go back to the website\'s defaults, and Save becomes available', async () => {
    await show(custom); fireEvent.click(screen.getByRole('button', { name: 'Reset Headline to default' }));
    expect(box('headline', 'en').value).toBe(''); expect(box('headline', 'ar').value).toBe(''); expect(screen.getByLabelText('Headline font').value).toBe('default'); expect(screen.getByLabelText('Headline size').value).toBe('large'); expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled();
  });
  it('touches only its own block (the sub-headline resets to ITS default size, medium)', async () => {
    await show(custom); fireEvent.click(screen.getByRole('button', { name: 'Reset Sub-headline to default' }));
    expect(screen.getByLabelText('Sub-headline size').value).toBe('medium'); expect(box('subheadline', 'en').value).toBe(''); expect(box('headline', 'en').value).toBe('Head'); expect(box('topBar', 'en').value).toBe('Top'); expect(screen.getByLabelText('Headline font').value).toBe('poppins');
  });
  it('nothing reaches the website until Save: reset then save sends the empty block', async () => {
    await show(custom); fireEvent.click(screen.getByRole('button', { name: 'Reset Top bar message to default' })); expect(m.save).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(m.save).toHaveBeenCalled()); expect(m.save.mock.calls[0][1].topBar).toEqual({ en: '', ar: '' }); expect(m.save.mock.calls[0][1].headline.en).toBe('Head');
  });
});
