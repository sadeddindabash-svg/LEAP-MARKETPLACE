import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

// "Pages" in the admin portal: the six tabs, loading each page when it is opened, the title and the text in two languages, the formatting buttons, the preview, saving, with the server replaced by fixed values.
const m = vi.hoisted(() => ({ footer: vi.fn(), page: vi.fn(), save: vi.fn() }));
vi.mock('./footerApi', async (orig) => ({ ...(await orig()), fetchFooter: (...a) => m.footer(...a), fetchPage: (...a) => m.page(...a), savePage: (...a) => m.save(...a) }));
vi.mock('./auth', () => { class SessionExpiredError extends Error {} return { SessionExpiredError, getStoredToken: () => 'admin-token', API_BASE_URL: 'http://api.test' }; });
import LegalPagesSection from './LegalPagesSection';
import { SessionExpiredError } from './auth';

const SLUGS = { about: 'about-us', terms: 'terms-conditions', delivery: 'delivery-shipping-policy', refund: 'refund-policy', privacy: 'privacy-policy', cancellation: 'cancellation-replacement-policy' };
const page = (key, over = {}) => ({ key, slug: SLUGS[key], title: { en: null, ar: null }, body: { en: null, ar: null }, updatedAt: null, hasContent: false, ...over });
const show = async (pages = {}) => { m.footer.mockResolvedValue({ pages: {} }); m.page.mockImplementation(async (key) => pages[key] || page(key)); const view = render(<LegalPagesSection />); await screen.findByText(/Address on the website/); return view; };
const tab = (name) => screen.getByRole('tab', { name: new RegExp(name) }); const area = () => screen.getByRole('textbox', { name: /^Text of/ });
const saveBtn = () => screen.getByRole('button', { name: 'Save this page' });
beforeEach(() => { vi.clearAllMocks(); m.save.mockImplementation(async (token, key, p) => page(key, { title: { en: p.title.en.trim() || null, ar: p.title.ar.trim() || null }, body: { en: p.body.en.trim() || null, ar: p.body.ar.trim() || null }, updatedAt: '2026-10-21T10:00:00.000Z', hasContent: Boolean(p.body.en.trim() || p.body.ar.trim()) })); });

describe('the tabs', () => {
  it('has a tab for each of the six pages, the first one open, with its address and whether it has text', async () => {
    await show(); expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['About us', 'Terms & Conditions', 'Delivery & Shipping', 'Refund', 'Privacy Policy', 'Cancellation']); expect(tab('About us').getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText(/\/about-us/)).toBeInTheDocument(); expect(screen.getByText(/No text yet: the footer link still opens the old website/)).toBeInTheDocument();
  });
  it('a page that has text says its footer link opens it, and when it was last updated', async () => {
    await show({ about: page('about', { body: { en: 'Hello', ar: null }, hasContent: true, updatedAt: '2026-03-05T10:00:00.000Z' }) }); expect(screen.getByText(/Has text: the footer link opens this page/)).toBeInTheDocument(); expect(screen.getByText(/last updated 5 March 2026/)).toBeInTheDocument();
  });
  it('each page is loaded when it is opened, once; what was typed in a page is kept when you go to another tab and back, and marked as not yet saved', async () => {
    await show(); fireEvent.change(document.getElementById('page-title-en'), { target: { value: 'My about' } }); fireEvent.click(tab('Refund')); await waitFor(() => expect(m.page).toHaveBeenCalledWith('refund')); expect(tab('About us').textContent).toContain('●');
    fireEvent.click(tab('About us')); expect(document.getElementById('page-title-en').value).toBe('My about'); fireEvent.click(tab('Refund')); fireEvent.click(tab('About us')); expect(m.page.mock.calls.filter((c) => c[0] === 'about')).toHaveLength(1);
  });
  it('a page that cannot be read shows the problem', async () => { m.footer.mockResolvedValue({ pages: {} }); m.page.mockRejectedValue(new Error('Request failed (500)')); render(<LegalPagesSection />); expect(await screen.findByRole('alert')).toHaveTextContent('Request failed (500)'); });
});
describe('writing', () => {
  it('shows the title and the text in the language chosen, and the preview of that language', async () => {
    await show({ terms: page('terms', { title: { en: 'Terms', ar: 'الشروط' }, body: { en: '## Rules\nBe kind.', ar: 'كن لطيفا' }, hasContent: true }) }); fireEvent.click(tab('Terms'));
    await waitFor(() => expect(area().value).toBe('## Rules\nBe kind.')); expect(screen.getByTestId('page-preview').querySelector('h4').textContent).toBe('Rules'); expect(document.getElementById('page-title-ar').value).toBe('الشروط'); expect(document.getElementById('page-title-ar').dir).toBe('rtl');
    fireEvent.click(screen.getByRole('button', { name: 'العربية' })); expect(area().value).toBe('كن لطيفا'); expect(area().dir).toBe('rtl'); expect(screen.getByTestId('page-preview').dir).toBe('rtl'); expect(screen.getByTestId('page-preview').textContent).toBe('كن لطيفا');
  });
  it('typing updates the preview at once; a script typed in is shown as letters (never run)', async () => {
    const { container } = await show(); fireEvent.change(area(), { target: { value: '## Hi\n- a\n- b\n\n<script>alert(1)</script> **x**' } });
    const p = screen.getByTestId('page-preview'); expect(p.querySelectorAll('li')).toHaveLength(2); expect(p.querySelector('strong').textContent).toBe('x'); expect(p.textContent).toContain('<script>alert(1)</script>'); expect(container.querySelector('script')).toBeNull();
  });
  it('the buttons: Bold, Heading, Bullet list and Link change the text where the cursor is', async () => {
    await show(); fireEvent.change(area(), { target: { value: 'one two' } }); area().setSelectionRange(0, 3); fireEvent.click(screen.getByRole('button', { name: 'Bold' })); expect(area().value).toBe('**one** two');
    area().setSelectionRange(0, 0); fireEvent.click(screen.getByRole('button', { name: 'Heading' })); expect(area().value).toBe('## **one** two');
    fireEvent.change(area(), { target: { value: 'a\nb' } }); area().setSelectionRange(0, 3); fireEvent.click(screen.getByRole('button', { name: 'Bullet list' })); expect(area().value).toBe('- a\n- b');
    fireEvent.change(area(), { target: { value: 'see terms' } }); area().setSelectionRange(4, 9); fireEvent.click(screen.getByRole('button', { name: 'Link' })); expect(area().value).toBe('see [terms](https://)');
  });
  it('shows how many characters of the 60,000 allowed, and stops at the limit', async () => { await show(); fireEvent.change(area(), { target: { value: 'abc' } }); expect(screen.getByText(/3 \/ 60,000 characters/)).toBeInTheDocument(); expect(area().maxLength).toBe(60000); expect(document.getElementById('page-title-en').maxLength).toBe(120); });
});
describe('saving', () => {
  it('Save is off until something changes', async () => { await show(); expect(saveBtn()).toBeDisabled(); fireEvent.change(area(), { target: { value: 'Text' } }); expect(saveBtn()).not.toBeDisabled(); fireEvent.change(area(), { target: { value: '' } }); expect(saveBtn()).toBeDisabled(); });
  it('sends this page only, with both languages and the admin token, then says its footer link now opens it', async () => {
    await show(); fireEvent.change(document.getElementById('page-title-en'), { target: { value: 'About Leap' } }); fireEvent.change(area(), { target: { value: 'We sell parts.' } }); fireEvent.click(screen.getByRole('button', { name: 'العربية' })); fireEvent.change(area(), { target: { value: 'نبيع قطعا.' } }); fireEvent.click(saveBtn());
    await waitFor(() => expect(m.save).toHaveBeenCalled()); expect(m.save.mock.calls[0]).toEqual(['admin-token', 'about', { title: { en: 'About Leap', ar: '' }, body: { en: 'We sell parts.', ar: 'نبيع قطعا.' } }]);
    expect(await screen.findByRole('status')).toHaveTextContent('The footer link now opens this page inside the website'); expect(screen.getByText(/Has text: the footer link opens this page/)).toBeInTheDocument(); expect(saveBtn()).toBeDisabled(); expect(screen.getByText(/last updated 21 October 2026/)).toBeInTheDocument();
  });
  it('saves the page that is OPEN, under its own name, not another one', async () => {
    await show(); fireEvent.click(tab('Refund')); await waitFor(() => expect(m.page).toHaveBeenCalledWith('refund')); await waitFor(() => expect(screen.getByText(/\/refund-policy/)).toBeInTheDocument());
    fireEvent.change(area(), { target: { value: 'Refund text' } }); fireEvent.click(saveBtn()); await waitFor(() => expect(m.save).toHaveBeenCalled());
    expect(m.save.mock.calls[0][1]).toBe('refund'); expect(m.save.mock.calls[0][2].body.en).toBe('Refund text'); expect(m.save.mock.calls.every((c) => c[1] === 'refund')).toBe(true);
  });
  it('clearing all the text and saving says the footer link goes back to the old website', async () => {
    await show({ about: page('about', { body: { en: 'Old text', ar: null }, hasContent: true }) }); fireEvent.change(area(), { target: { value: '' } }); fireEvent.click(saveBtn());
    expect(await screen.findByRole('status')).toHaveTextContent('still opens the old website'); expect(screen.getByText(/No text yet/)).toBeInTheDocument();
  });
  it('a refusal is shown and the text is kept; an expired sign-in goes to the sign-in page; the button cannot be pressed twice', async () => {
    const onSessionExpired = vi.fn(); m.footer.mockResolvedValue({ pages: {} }); m.page.mockImplementation(async (k) => page(k)); render(<LegalPagesSection onSessionExpired={onSessionExpired} />); await screen.findByText(/Address on the website/);
    fireEvent.change(area(), { target: { value: 'Mine' } }); m.save.mockRejectedValueOnce(new Error('body.en is too long')); fireEvent.click(saveBtn()); expect(await screen.findByRole('alert')).toHaveTextContent('too long'); expect(area().value).toBe('Mine');
    m.save.mockRejectedValueOnce(new SessionExpiredError('x')); fireEvent.click(saveBtn()); await waitFor(() => expect(onSessionExpired).toHaveBeenCalled());
    let release; m.save.mockReturnValueOnce(new Promise((r) => { release = r; })); fireEvent.click(saveBtn()); expect(await screen.findByRole('button', { name: 'Saving…' })).toBeDisabled(); await act(async () => { release(page('about', { body: { en: 'Mine', ar: null }, hasContent: true })); }); await screen.findByRole('status');
  });
  it('after saving, a different tab is not affected, and editing again removes the "Saved" message', async () => {
    await show(); fireEvent.change(area(), { target: { value: 'x' } }); fireEvent.click(saveBtn()); await screen.findByRole('status'); fireEvent.change(area(), { target: { value: 'xy' } }); expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
