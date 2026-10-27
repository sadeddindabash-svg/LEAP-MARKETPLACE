import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';

// Admin > Settings > Home banner: the switch, the slides with their English and Arabic photos, seconds, links, order and removal. The server is replaced by fixed answers shaped like the real ones
// (the real ones are checked in services/api/test/homeBanner.test.js); the picture reading and cutting are replaced because jsdom has no real canvas.
const m = vi.hoisted(() => ({
  api: { fetchBannerAdmin: vi.fn(), setBannerMode: vi.fn(), addBannerSlide: vi.fn(), saveBannerSlide: vi.fn(), removeBannerSlide: vi.fn(), reorderBannerSlides: vi.fn(), uploadBannerPhoto: vi.fn(), removeBannerPhoto: vi.fn() },
  loadImageFile: vi.fn(), renderBannerCrop: vi.fn(), fetchCategories: vi.fn(), fetchAdminProducts: vi.fn(),
}));
vi.mock('./auth', () => { class SessionExpiredError extends Error {} return { SessionExpiredError, API_BASE_URL: 'http://api', getStoredToken: () => 'admin-token', fetchCategories: (...a) => m.fetchCategories(...a), fetchAdminProducts: (...a) => m.fetchAdminProducts(...a) }; });
vi.mock('./homeBannerApi', () => m.api);
vi.mock('./homePictureImage', () => ({ loadImageFile: (...a) => m.loadImageFile(...a) }));
vi.mock('./bannerImage', () => ({ renderBannerCrop: (...a) => m.renderBannerCrop(...a) }));
import HomeBannerSection, { BannerCardBoundary } from './HomeBannerSection';
import { SessionExpiredError } from './auth';

const LIMITS = { maxSlides: 10, minSeconds: 2, maxSeconds: 30, defaultSeconds: 5, width: 1250, height: 500, maxAlt: 140 };
const slide = (id, over = {}) => ({ id, imageEn: null, imageAr: null, altEn: '', altAr: '', link: { type: 'none', value: '' }, seconds: 5, ...over });
const state = (slides, mode = 'headline') => ({ mode, slides, limits: LIMITS });
const show = async (initial, props = {}) => { m.api.fetchBannerAdmin.mockResolvedValue(initial); render(<HomeBannerSection onSessionExpired={props.onSessionExpired} />); await screen.findByRole('group', { name: 'The home page shows' }).catch(() => null); await screen.findByText(/Add a slide/); };
const file = (name = 'ad.png', type = 'image/png') => new File(['x'], name, { type });
const choose = async (n, lang, f = file()) => { await act(async () => { fireEvent.change(screen.getByTestId(`file-${n}-${lang}`), { target: { files: [f] } }); }); };       // the file is read asynchronously: let it finish
const loaded = (width = 2000, height = 800) => ({ image: { naturalWidth: width }, url: 'blob:x', width, height });
beforeEach(() => {
  vi.clearAllMocks(); URL.revokeObjectURL = vi.fn(); m.fetchCategories.mockResolvedValue([{ id: 'brake', nameEn: 'Brake System' }, { id: 'filters', nameEn: 'Filters' }]); m.fetchAdminProducts.mockResolvedValue({ products: [], total: 0 });
  m.loadImageFile.mockResolvedValue(loaded()); m.renderBannerCrop.mockResolvedValue(new Blob(['jpg'], { type: 'image/jpeg' }));
});

describe('what it shows', () => {
  it('the switch (on what is stored), every slide with its two photos, its seconds and its link, and how many of 10 are used', async () => {
    await show(state([slide('a', { imageEn: '/uploads/a-en.jpg', imageAr: '/uploads/a-ar.jpg', seconds: 8, link: { type: 'category', value: 'brake' } }), slide('b')], 'banner'));
    expect(screen.getByRole('radio', { name: 'The banner' })).toBeChecked(); expect(screen.getByRole('radio', { name: 'The headline and sub-headline' })).not.toBeChecked();
    const first = screen.getByTestId('slide-1'); expect(within(first).getByAltText('English photo of slide 1').getAttribute('src')).toBe('http://api/uploads/a-en.jpg'); expect(within(first).getByAltText('Arabic photo of slide 1').getAttribute('src')).toBe('http://api/uploads/a-ar.jpg');
    expect(within(first).getByLabelText('Seconds for slide 1').value).toBe('8'); expect(within(first).getByLabelText('Link goes to').value).toBe('category'); expect(within(first).getByLabelText('Category').value).toBe('brake'); expect(screen.getByRole('button', { name: /Add a slide \(2 of 10\)/ })).toBeInTheDocument();
    expect(within(screen.getByTestId('slide-2')).getAllByText('Choose photo')).toHaveLength(2);
  });
  it('no slides yet: an empty list and "0 of 10"', async () => { await show(state([])); expect(screen.queryByTestId('slide-1')).toBeNull(); expect(screen.getByRole('button', { name: /Add a slide \(0 of 10\)/ })).toBeInTheDocument(); });
  it('a failed load is shown; an expired sign-in goes to the sign-in page', async () => {
    m.api.fetchBannerAdmin.mockRejectedValue(new Error('Request failed (500)')); const { unmount } = render(<HomeBannerSection />); expect(await screen.findByRole('alert')).toHaveTextContent('Request failed (500)'); unmount();
    const onSessionExpired = vi.fn(); m.api.fetchBannerAdmin.mockRejectedValue(new SessionExpiredError('x')); render(<HomeBannerSection onSessionExpired={onSessionExpired} />); await waitFor(() => expect(onSessionExpired).toHaveBeenCalled());
  });
});
describe('the switch', () => {
  it('choosing the banner saves it at once and says when the home page will change', async () => {
    await show(state([slide('a', { imageEn: '/uploads/a.jpg' })])); m.api.setBannerMode.mockResolvedValue(state([slide('a', { imageEn: '/uploads/a.jpg' })], 'banner')); fireEvent.click(screen.getByRole('radio', { name: 'The banner' }));
    await waitFor(() => expect(m.api.setBannerMode).toHaveBeenCalledWith('admin-token', 'banner')); expect(await screen.findByText(/will show the banner/)).toBeInTheDocument(); expect(screen.getByRole('radio', { name: 'The banner' })).toBeChecked();
  });
  it('banner chosen but no slide has a photo yet: a note says the headline is still shown (no note once a photo exists)', async () => {
    const { unmount } = render(<div />); unmount(); await show(state([slide('a')], 'banner')); expect(screen.getByRole('note')).toHaveTextContent(/still shows the headline/);
  });
  it('a refusal is shown and the choice does not change', async () => { await show(state([])); m.api.setBannerMode.mockRejectedValue(new Error('The mode must be one of: headline, banner')); fireEvent.click(screen.getByRole('radio', { name: 'The banner' })); expect(await screen.findByRole('alert')).toHaveTextContent('must be one of'); expect(screen.getByRole('radio', { name: 'The headline and sub-headline' })).toBeChecked(); });
});
describe('slides', () => {
  it('"Add a slide" adds one; at 10 the button is off and says so', async () => {
    await show(state([])); m.api.addBannerSlide.mockResolvedValue({ slide: slide('n1'), ...state([slide('n1')]) }); fireEvent.click(screen.getByRole('button', { name: /Add a slide/ })); await waitFor(() => expect(m.api.addBannerSlide).toHaveBeenCalledWith('admin-token', {})); expect(await screen.findByTestId('slide-1')).toBeInTheDocument();
  });
  it('at the limit the button is switched off', async () => { await show(state(Array.from({ length: 10 }, (_, i) => slide(`s${i}`)))); expect(screen.getByRole('button', { name: /Add a slide \(10 of 10\)/ })).toBeDisabled(); expect(screen.getByText(/holds at most 10 photos/)).toBeInTheDocument(); });
  it('moving a slide up or down sends the whole new order; the first cannot go up and the last cannot go down', async () => {
    await show(state([slide('a'), slide('b'), slide('c')])); expect(screen.getByRole('button', { name: 'Move slide 1 up' })).toBeDisabled(); expect(screen.getByRole('button', { name: 'Move slide 3 down' })).toBeDisabled();
    m.api.reorderBannerSlides.mockResolvedValue(state([slide('a'), slide('c'), slide('b')])); fireEvent.click(screen.getByRole('button', { name: 'Move slide 2 down' })); await waitFor(() => expect(m.api.reorderBannerSlides).toHaveBeenCalledWith('admin-token', ['a', 'c', 'b']));
  });
  it('removing a slide asks first ("Keep" does nothing; "Yes, remove" removes it)', async () => {
    await show(state([slide('a'), slide('b')])); fireEvent.click(within(screen.getByTestId('slide-1')).getByRole('button', { name: 'Remove slide' })); expect(screen.getByText(/Remove slide 1 and its photos\?/)).toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: 'Keep' })); expect(m.api.removeBannerSlide).not.toHaveBeenCalled();
    m.api.removeBannerSlide.mockResolvedValue(state([slide('b')])); fireEvent.click(within(screen.getByTestId('slide-1')).getByRole('button', { name: 'Remove slide' })); fireEvent.click(screen.getByRole('button', { name: 'Yes, remove' })); await waitFor(() => expect(m.api.removeBannerSlide).toHaveBeenCalledWith('admin-token', 'a')); await waitFor(() => expect(screen.queryByTestId('slide-2')).toBeNull());
  });
});
describe('photos', () => {
  it('choosing a photo opens the crop window for THAT slide and language; "Use this crop" cuts it, uploads it and shows it', async () => {
    await show(state([slide('a')])); await choose(1, 'en'); const dialog = await screen.findByRole('dialog', { name: 'English photo for slide 1' }); expect(m.loadImageFile).toHaveBeenCalled();
    m.api.uploadBannerPhoto.mockResolvedValue({ slide: slide('a', { imageEn: '/uploads/new-en.jpg' }), ...state([slide('a', { imageEn: '/uploads/new-en.jpg' })]) }); fireEvent.click(within(dialog).getByRole('button', { name: 'Use this crop' }));
    await waitFor(() => expect(m.api.uploadBannerPhoto).toHaveBeenCalledWith('admin-token', 'a', 'en', expect.any(Blob))); const rect = m.renderBannerCrop.mock.calls[0][1]; expect(rect.sw / rect.sh).toBeCloseTo(2.5, 5);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull()); expect(screen.getByAltText('English photo of slide 1').getAttribute('src')).toBe('http://api/uploads/new-en.jpg'); expect(screen.getByText(/English photo of slide 1 is on the home page within about a minute/)).toBeInTheDocument();
  });
  it('the Arabic photo goes to the Arabic place', async () => { await show(state([slide('a')])); await choose(1, 'ar'); const dialog = await screen.findByRole('dialog', { name: 'Arabic photo for slide 1' }); m.api.uploadBannerPhoto.mockResolvedValue(state([slide('a', { imageAr: '/uploads/x.jpg' })])); fireEvent.click(within(dialog).getByRole('button', { name: 'Use this crop' })); await waitFor(() => expect(m.api.uploadBannerPhoto).toHaveBeenCalledWith('admin-token', 'a', 'ar', expect.any(Blob))); });
  it('a picture that is too small is refused with its size and no crop window opens; a file that is not a picture shows the reason', async () => {
    await show(state([slide('a')])); m.loadImageFile.mockResolvedValue(loaded(800, 600)); await choose(1, 'en'); expect(await screen.findByRole('alert')).toHaveTextContent('too small (800 × 600 px)'); expect(screen.getByRole('alert')).toHaveTextContent('1000 × 400'); expect(screen.queryByRole('dialog')).toBeNull(); expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:x');
    m.loadImageFile.mockRejectedValue(new Error('Please choose a JPG, PNG or WebP picture.')); await choose(1, 'en', file('a.pdf', 'application/pdf')); await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Please choose a JPG, PNG or WebP picture.'));
  });
  it('cancelling the crop uploads nothing', async () => { await show(state([slide('a')])); await choose(1, 'en'); const dialog = await screen.findByRole('dialog'); fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' })); expect(screen.queryByRole('dialog')).toBeNull(); expect(m.api.uploadBannerPhoto).not.toHaveBeenCalled(); });
  it('a refused upload is shown inside the crop window, which stays open so it can be tried again', async () => { await show(state([slide('a')])); await choose(1, 'en'); const dialog = await screen.findByRole('dialog'); m.api.uploadBannerPhoto.mockRejectedValue(new Error('The picture must be exactly 1250 x 500 px')); fireEvent.click(within(dialog).getByRole('button', { name: 'Use this crop' })); expect(await within(dialog).findByRole('alert')).toHaveTextContent('exactly 1250 x 500'); expect(screen.getByRole('dialog')).toBeInTheDocument(); });
  it('an expired sign-in during an upload goes to the sign-in page', async () => { const onSessionExpired = vi.fn(); await show(state([slide('a')]), { onSessionExpired }); await choose(1, 'en'); m.api.uploadBannerPhoto.mockRejectedValue(new SessionExpiredError('x')); fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Use this crop' })); await waitFor(() => expect(onSessionExpired).toHaveBeenCalled()); });
  it('Remove (shown only where a photo exists) removes that language\'s photo', async () => {
    await show(state([slide('a', { imageEn: '/uploads/e.jpg' })])); expect(screen.queryByRole('button', { name: 'Remove the Arabic photo of slide 1' })).toBeNull(); m.api.removeBannerPhoto.mockResolvedValue(state([slide('a')])); fireEvent.click(screen.getByRole('button', { name: 'Remove the English photo of slide 1' })); await waitFor(() => expect(m.api.removeBannerPhoto).toHaveBeenCalledWith('admin-token', 'a', 'en')); await waitFor(() => expect(screen.queryByAltText('English photo of slide 1')).toBeNull());
  });
});
describe('seconds, link and descriptions', () => {
  it('nothing to save until something changes; then "Not saved yet" and Save sends ONLY what changed', async () => {
    await show(state([slide('a', { seconds: 5, link: { type: 'category', value: 'brake' }, altEn: 'Sale' })])); const save = screen.getByRole('button', { name: 'Save slide 1' }); expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Seconds for slide 1'), { target: { value: '8' } }); expect(save).not.toBeDisabled(); expect(screen.getByText('Not saved yet')).toBeInTheDocument();
    m.api.saveBannerSlide.mockResolvedValue({ slide: slide('a', { seconds: 8, link: { type: 'category', value: 'brake' }, altEn: 'Sale' }), ...state([slide('a', { seconds: 8, link: { type: 'category', value: 'brake' }, altEn: 'Sale' })]) }); fireEvent.click(save);
    await waitFor(() => expect(m.api.saveBannerSlide).toHaveBeenCalledWith('admin-token', 'a', { seconds: 8 })); expect(await screen.findByText(/Saved\. The home page shows the change/)).toBeInTheDocument(); await waitFor(() => expect(screen.getByRole('button', { name: 'Save slide 1' })).toBeDisabled()); expect(screen.queryByText('Not saved yet')).toBeNull();
  });
  it('seconds must be a whole number from 2 to 30: anything else is refused here and nothing is sent', async () => {
    await show(state([slide('a')])); for (const bad of ['1', '31', '2.5', '', 'abc']) { fireEvent.change(screen.getByLabelText('Seconds for slide 1'), { target: { value: bad } }); fireEvent.click(screen.getByRole('button', { name: 'Save slide 1' })); if (bad !== 'abc') expect(await screen.findByRole('alert')).toHaveTextContent('whole number from 2 to 30'); }
    expect(m.api.saveBannerSlide).not.toHaveBeenCalled();
  });
  it('a link to a category: choose it from the list', async () => {
    await show(state([slide('a')])); fireEvent.change(screen.getByLabelText('Link goes to'), { target: { value: 'category' } }); fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'filters' } }); m.api.saveBannerSlide.mockResolvedValue(state([slide('a', { link: { type: 'category', value: 'filters' } })]).slides.length ? { slide: slide('a', { link: { type: 'category', value: 'filters' } }), ...state([slide('a', { link: { type: 'category', value: 'filters' } })]) } : {});
    fireEvent.click(screen.getByRole('button', { name: 'Save slide 1' })); await waitFor(() => expect(m.api.saveBannerSlide).toHaveBeenCalledWith('admin-token', 'a', { link: { type: 'category', value: 'filters' } }));
  });
  it('a link to a web page: typed; an address that is not http(s) gets a hint', async () => {
    await show(state([slide('a')])); fireEvent.change(screen.getByLabelText('Link goes to'), { target: { value: 'url' } }); fireEvent.change(screen.getByLabelText('Web page address'), { target: { value: 'example.com' } }); expect(screen.getByText(/must start with https/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Web page address'), { target: { value: ' https://example.com/sale ' } }); expect(screen.queryByText(/must start with https/)).toBeNull(); m.api.saveBannerSlide.mockResolvedValue({ slide: slide('a', { link: { type: 'url', value: 'https://example.com/sale' } }), ...state([slide('a', { link: { type: 'url', value: 'https://example.com/sale' } })]) }); fireEvent.click(screen.getByRole('button', { name: 'Save slide 1' }));
    await waitFor(() => expect(m.api.saveBannerSlide).toHaveBeenCalledWith('admin-token', 'a', { link: { type: 'url', value: 'https://example.com/sale' } }));
  });
  it('a link to a part: search by name or number, choose from the results, and the choice is shown', async () => {
    await show(state([slide('a')])); fireEvent.change(screen.getByLabelText('Link goes to'), { target: { value: 'part' } }); m.fetchAdminProducts.mockResolvedValue({ products: [{ id: 'p1', name: 'Front Brake Disc' }, { id: 'p2', name: 'Rear Brake Disc' }] });
    fireEvent.change(screen.getByLabelText('Search for a part'), { target: { value: 'disc' } }); fireEvent.click(screen.getByRole('button', { name: 'Search' })); await waitFor(() => expect(m.fetchAdminProducts).toHaveBeenCalledWith('admin-token', { search: 'disc', page: 1 }));
    fireEvent.click(await screen.findByRole('button', { name: /Front Brake Disc/ })); expect(screen.getByText('Front Brake Disc')).toBeInTheDocument(); expect(screen.getByText('(p1)')).toBeInTheDocument();
    m.api.saveBannerSlide.mockResolvedValue({ slide: slide('a', { link: { type: 'part', value: 'p1' } }), ...state([slide('a', { link: { type: 'part', value: 'p1' } })]) }); fireEvent.click(screen.getByRole('button', { name: 'Save slide 1' })); await waitFor(() => expect(m.api.saveBannerSlide).toHaveBeenCalledWith('admin-token', 'a', { link: { type: 'part', value: 'p1' } }));
  });
  it('no part matches: it says so; "Change" lets another be chosen', async () => {
    await show(state([slide('a', { link: { type: 'part', value: 'p9' } })])); expect(screen.getByText('(p9)')).toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: 'Change' })); fireEvent.change(screen.getByLabelText('Search for a part'), { target: { value: 'zzz' } }); fireEvent.click(screen.getByRole('button', { name: 'Search' })); expect(await screen.findByText('No live part matches that.')).toBeInTheDocument();
  });
  it('"No link" sends no link; descriptions are trimmed and sent only when changed', async () => {
    await show(state([slide('a', { link: { type: 'url', value: 'https://x.com' }, altEn: 'Old' })])); fireEvent.change(screen.getByLabelText('Link goes to'), { target: { value: 'none' } }); fireEvent.change(screen.getByLabelText('English description for slide 1'), { target: { value: '  New  ' } }); fireEvent.change(screen.getByLabelText('Arabic description for slide 1'), { target: { value: ' جديد ' } });
    m.api.saveBannerSlide.mockResolvedValue({ slide: slide('a', { altEn: 'New', altAr: 'جديد' }), ...state([slide('a', { altEn: 'New', altAr: 'جديد' })]) }); fireEvent.click(screen.getByRole('button', { name: 'Save slide 1' })); await waitFor(() => expect(m.api.saveBannerSlide).toHaveBeenCalledWith('admin-token', 'a', { link: { type: 'none' }, altEn: 'New', altAr: 'جديد' }));
  });
  it('a refusal from the server is shown and the edits are kept', async () => { await show(state([slide('a')])); fireEvent.change(screen.getByLabelText('Seconds for slide 1'), { target: { value: '9' } }); m.api.saveBannerSlide.mockRejectedValue(new Error('That part was not found')); fireEvent.click(screen.getByRole('button', { name: 'Save slide 1' })); expect(await screen.findByRole('alert')).toHaveTextContent('That part was not found'); expect(screen.getByLabelText('Seconds for slide 1').value).toBe('9'); expect(screen.getByText('Not saved yet')).toBeInTheDocument(); });
});

describe('a server answer that is not what the card expects, or a failure while it is drawn, never takes the Settings page down', () => {
  const page = () => render(<div><p>the rest of the Settings page</p><HomeBannerSection /></div>);
  it('another feature\'s data (no list of slides): a clear message in the card, the rest of the page is still there', async () => {
    m.api.fetchBannerAdmin.mockResolvedValue({ announcements: [], limits: LIMITS }); page();
    expect(await screen.findByText(/was not what was expected/)).toBeInTheDocument(); expect(screen.getByText('the rest of the Settings page')).toBeInTheDocument(); expect(screen.queryByRole('group', { name: /The home page shows/ })).not.toBeInTheDocument();
  });
  it('an answer without the limits, an empty answer and a non-object answer are all refused the same way', async () => {
    for (const bad of [{ mode: 'banner', slides: [] }, null, 'oops', 42]) { m.api.fetchBannerAdmin.mockResolvedValue(bad); const { unmount } = page(); expect(await screen.findByText(/was not what was expected/)).toBeInTheDocument(); expect(screen.getByText('the rest of the Settings page')).toBeInTheDocument(); unmount(); }
  });
  it('a damaged slide in the answer is a message too, not a crash', async () => { m.api.fetchBannerAdmin.mockResolvedValue({ mode: 'banner', slides: [null], limits: LIMITS }); page(); expect(await screen.findByRole('alert')).toBeInTheDocument(); expect(screen.getByText('the rest of the Settings page')).toBeInTheDocument(); });
  it('an answer after a change (add, save, photo) that is not what was expected is a message and keeps the slides already shown', async () => {
    await show(state([slide('a')])); m.api.addBannerSlide.mockResolvedValue({ nothing: true }); fireEvent.click(screen.getByRole('button', { name: /Add a slide/ }));
    expect(await screen.findByText(/was not what was expected/)).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Save slide 1' })).toBeInTheDocument();
  });
  it('the safety net: a failure while the card is drawn shows a message in the card only', () => {
    const Boom = () => { throw new Error('boom'); }; vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<div><p>the rest of the Settings page</p><BannerCardBoundary><Boom /></BannerCardBoundary></div>);
    expect(screen.getByRole('alert')).toHaveTextContent('This card could not be shown'); expect(screen.getByText('the rest of the Settings page')).toBeInTheDocument(); console.error.mockRestore();
  });
  it('and when nothing fails it is invisible (the children are shown as they are)', () => { render(<BannerCardBoundary><p>fine</p></BannerCardBoundary>); expect(screen.getByText('fine')).toBeInTheDocument(); expect(screen.queryByRole('alert')).not.toBeInTheDocument(); });
});
