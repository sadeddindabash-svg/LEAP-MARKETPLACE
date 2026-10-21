import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// "Footer text" in the admin portal: the tagline, the copyright line, the column titles and the six links' wording and visibility, with the server replaced by fixed values.
const m = vi.hoisted(() => ({ fetch: vi.fn(), save: vi.fn() }));
vi.mock('./footerApi', async (orig) => ({ ...(await orig()), fetchFooter: (...a) => m.fetch(...a), saveFooterText: (...a) => m.save(...a) }));
vi.mock('./auth', () => { class SessionExpiredError extends Error {} return { SessionExpiredError, getStoredToken: () => 'admin-token', API_BASE_URL: 'http://api.test' }; });
import FooterTextSection from './FooterTextSection';
import { SessionExpiredError } from './auth';

const KEYS = ['about', 'terms', 'delivery', 'refund', 'privacy', 'cancellation']; const NONE = { en: null, ar: null };
const text = (over = {}) => ({ tagline: NONE, copyright: NONE, titles: { shop: NONE, account: NONE, help: NONE, useful: NONE }, links: Object.fromEntries(KEYS.map((k) => [k, { ...NONE, shown: true }])), ...over });
const show = async (t = text(), props = {}) => { m.fetch.mockResolvedValue({ text: t }); const view = render(<FooterTextSection onSessionExpired={props.onSessionExpired} />); await screen.findByText('Tagline'); return view; };
const box = (id) => document.getElementById(id); const type = (id, v) => fireEvent.change(box(id), { target: { value: v } });
beforeEach(() => { vi.clearAllMocks(); m.save.mockImplementation(async (token, t) => ({ text: { ...t, tagline: { en: t.tagline.en || null, ar: t.tagline.ar || null }, copyright: { en: t.copyright.en || null, ar: t.copyright.ar || null }, titles: Object.fromEntries(Object.entries(t.titles).map(([k, v]) => [k, { en: v.en || null, ar: v.ar || null }])), links: Object.fromEntries(Object.entries(t.links).map(([k, v]) => [k, { en: v.en || null, ar: v.ar || null, shown: v.shown }])) } })); });

describe('the card', () => {
  it('shows what is set now, and the website\'s own wording as hints for what is empty', async () => {
    await show(text({ tagline: { en: 'Genuine parts', ar: 'قطع أصلية' }, links: { ...text().links, about: { en: 'Who we are', ar: null, shown: false } } }));
    expect(box('ft-tagline-en').value).toBe('Genuine parts'); expect(box('ft-tagline-ar').value).toBe('قطع أصلية'); expect(box('ft-copyright-en').placeholder).toBe('Copyright © Leap Auto Parts {year}'); expect(box('ft-title-shop-en').placeholder).toBe('Shop');
    expect(box('ft-link-about-en').value).toBe('Who we are'); expect(screen.getByLabelText('Show About us').checked).toBe(false); expect(screen.getByLabelText('Show Terms & Conditions').checked).toBe(true); expect(box('ft-link-terms-en').placeholder).toBe('Terms & Conditions');
  });
  it('explains where the year goes in the copyright line, and has a field for each of the six links in both languages', async () => {
    await show(); expect(screen.getByText('{year}')).toBeInTheDocument(); for (const k of KEYS) { expect(box(`ft-link-${k}-en`)).toBeTruthy(); expect(box(`ft-link-${k}-ar`).dir).toBe('rtl'); }
  });
  it('every text has the limit the shop enforces', async () => { await show(); expect([box('ft-tagline-en').maxLength, box('ft-copyright-ar').maxLength, box('ft-title-help-en').maxLength, box('ft-link-refund-ar').maxLength]).toEqual([160, 160, 40, 40]); });
  it('a server that cannot be reached shows the problem', async () => { m.fetch.mockRejectedValue(new Error('Request failed (500)')); render(<FooterTextSection />); expect(await screen.findByRole('alert')).toHaveTextContent('Request failed (500)'); });
});
describe('saving', () => {
  it('Save is off until something changes; hiding a link counts as a change', async () => {
    await show(); expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled(); fireEvent.click(screen.getByLabelText('Show Refund')); expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled(); fireEvent.click(screen.getByLabelText('Show Refund')); expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
  it('sends everything, trimmed, with the admin token, then says it was saved', async () => {
    await show(); type('ft-tagline-en', '  Genuine parts  '); type('ft-copyright-en', '© Leap {year}'); type('ft-title-help-ar', 'مساعدة'); type('ft-link-privacy-en', 'Privacy'); fireEvent.click(screen.getByLabelText('Show Cancellation')); fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(m.save).toHaveBeenCalled()); const [token, sent] = m.save.mock.calls[0];
    expect(token).toBe('admin-token'); expect(sent.tagline).toEqual({ en: 'Genuine parts', ar: '' }); expect(sent.copyright.en).toBe('© Leap {year}'); expect(sent.titles.help.ar).toBe('مساعدة'); expect(sent.links.privacy.en).toBe('Privacy'); expect(sent.links.cancellation.shown).toBe(false); expect(sent.links.about.shown).toBe(true);
    expect(await screen.findByRole('status')).toHaveTextContent('Saved. The website shows the change within about a minute.'); expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
  it('a refusal is shown and what was typed is kept', async () => { await show(); m.save.mockRejectedValue(new Error('tagline.en is too long')); type('ft-tagline-en', 'Mine'); fireEvent.click(screen.getByRole('button', { name: 'Save' })); expect(await screen.findByRole('alert')).toHaveTextContent('too long'); expect(box('ft-tagline-en').value).toBe('Mine'); });
  it('an expired sign-in sends the admin to the sign-in page', async () => { const onSessionExpired = vi.fn(); await show(text(), { onSessionExpired }); m.save.mockRejectedValue(new SessionExpiredError('x')); type('ft-tagline-en', 'x'); fireEvent.click(screen.getByRole('button', { name: 'Save' })); await waitFor(() => expect(onSessionExpired).toHaveBeenCalled()); });
  it('the button cannot be pressed twice while it saves; editing afterwards removes the "Saved" message', async () => {
    await show(); let release; m.save.mockReturnValue(new Promise((r) => { release = r; })); type('ft-tagline-en', 'x'); fireEvent.click(screen.getByRole('button', { name: 'Save' })); expect(await screen.findByRole('button', { name: 'Saving…' })).toBeDisabled();
    release({ text: text({ tagline: { en: 'x', ar: null } }) }); await screen.findByRole('status'); type('ft-tagline-en', 'xy'); expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
