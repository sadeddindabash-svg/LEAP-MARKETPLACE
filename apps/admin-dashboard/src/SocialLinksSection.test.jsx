import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

// "Footer social media" in the admin portal: the list of icons, saving, the picture (crop to 256 x 256), removing, ordering, with the server and the browser's picture functions replaced by fixed values.
const m = vi.hoisted(() => ({ fetch: vi.fn(), save: vi.fn(), upload: vi.fn(), remove: vi.fn(), load: vi.fn(), render: vi.fn() }));
vi.mock('./footerApi', async (orig) => ({ ...(await orig()), fetchFooter: (...a) => m.fetch(...a), saveSocial: (...a) => m.save(...a), uploadSocialIcon: (...a) => m.upload(...a), removeSocialIcon: (...a) => m.remove(...a) }));
vi.mock('./homePicturesApi', () => ({ pictureSrc: (u) => (u ? `http://api.test${u}` : null) }));
vi.mock('./socialIconImage', () => ({ loadImageFile: (...a) => m.load(...a), renderIcon: (...a) => m.render(...a), ICON_PX: 256, ICON_MIN_PX: 128 }));
vi.mock('./auth', () => { class SessionExpiredError extends Error {} return { SessionExpiredError, getStoredToken: () => 'admin-token', API_BASE_URL: 'http://api.test' }; });
import SocialLinksSection from './SocialLinksSection';
import { SessionExpiredError } from './auth';

const item = (id, name, url, icon = null) => ({ id, name, url, icon });
const show = async (social = [], props = {}) => { m.fetch.mockResolvedValue({ social }); const view = render(<SocialLinksSection onSessionExpired={props.onSessionExpired} />); await screen.findByText('Footer social media'); return view; };
const row = (i) => within(screen.getByTestId(`social-${i}`)); const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save' }));
beforeEach(() => {
  vi.clearAllMocks(); globalThis.URL.revokeObjectURL = vi.fn(); m.load.mockResolvedValue({ image: { tag: 'img' }, url: 'blob:x', width: 1000, height: 600 }); m.render.mockResolvedValue(new Blob(['png'], { type: 'image/png' }));
  m.save.mockImplementation(async (token, items) => ({ social: items.map((i, n) => ({ id: i.id || `id${n}`, name: i.name, url: i.url || null, icon: null })) }));
  m.upload.mockImplementation(async (token, id) => ({ id, icon: `/uploads/${id}.png`, social: [] })); m.remove.mockResolvedValue({ icon: null });
});

describe('the list', () => {
  it('shows each icon with its name, link and picture (or "Leap logo" when it has none), and says what the limit is', async () => {
    await show([item('a', 'Facebook', 'https://fb.com/leap', '/uploads/a.png'), item('b', 'Instagram', null)]);
    expect(row(0).getByRole('img', { name: 'Facebook picture' }).getAttribute('src')).toBe('http://api.test/uploads/a.png'); expect(row(1).getByText('Leap logo')).toBeInTheDocument();
    expect(row(0).getByLabelText('Name of icon 1').value).toBe('Facebook'); expect(row(1).getByLabelText('Link of Instagram').value).toBe(''); expect(screen.getByText(/up to 8/)).toBeInTheDocument();
  });
  it('an empty list just offers to add one', async () => { await show(); expect(screen.queryByTestId('social-0')).not.toBeInTheDocument(); expect(screen.getByRole('button', { name: '+ Add social media' })).toBeInTheDocument(); });
  it('a server that cannot be reached shows the problem', async () => { m.fetch.mockRejectedValue(new Error('Request failed (500)')); render(<SocialLinksSection />); expect(await screen.findByRole('alert')).toHaveTextContent('Request failed (500)'); });
});
describe('adding, ordering and removing', () => {
  it('Add makes a new row; a new icon cannot have a picture until it is saved; at 8 the button stops', async () => {
    await show(); const add = screen.getByRole('button', { name: '+ Add social media' }); fireEvent.click(add); expect(screen.getByText('Save first, then add a picture')).toBeInTheDocument(); expect(row(0).queryByTestId('file-0')).not.toBeInTheDocument();
    for (let i = 0; i < 7; i++) fireEvent.click(add); expect(screen.getAllByTestId(/^social-/)).toHaveLength(8); expect(add).toBeDisabled(); expect(screen.getByText('That is the most there can be.')).toBeInTheDocument();
  });
  it('the arrows move an icon up or down (the first cannot go up, the last cannot go down), and Remove takes it out of the list', async () => {
    await show([item('a', 'A', 'https://a.com'), item('b', 'B', 'https://b.com'), item('c', 'C', 'https://c.com')]);
    expect(screen.getByLabelText('Move A up')).toBeDisabled(); expect(screen.getByLabelText('Move C down')).toBeDisabled(); fireEvent.click(screen.getByLabelText('Move C up'));
    expect(screen.getAllByLabelText(/^Name of icon/).map((e) => e.value)).toEqual(['A', 'C', 'B']); fireEvent.click(screen.getByLabelText('Remove A')); expect(screen.getAllByLabelText(/^Name of icon/).map((e) => e.value)).toEqual(['C', 'B']);
  });
});
describe('saving', () => {
  it('Save is off until something changes, and also while an icon has no name', async () => {
    await show([item('a', 'A', 'https://a.com')]); expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled(); fireEvent.change(row(0).getByLabelText('Link of A'), { target: { value: 'https://new.com' } }); expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled();
    fireEvent.change(row(0).getByLabelText('Name of icon 1'), { target: { value: '  ' } }); expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled(); expect(screen.getByText(/Every icon needs a name/)).toBeInTheDocument();
  });
  it('sends the list in its order, trimmed, with each saved icon\'s id, and then a new icon can have a picture', async () => {
    await show([item('a', 'A', 'https://a.com')]); fireEvent.click(screen.getByRole('button', { name: '+ Add social media' }));
    fireEvent.change(row(1).getByLabelText('Name of icon 2'), { target: { value: '  TikTok ' } }); fireEvent.change(row(1).getByLabelText('Link of TikTok'), { target: { value: ' https://tiktok.com/leap ' } }); save();
    await waitFor(() => expect(m.save).toHaveBeenCalled()); expect(m.save.mock.calls[0][0]).toBe('admin-token'); expect(m.save.mock.calls[0][1]).toEqual([{ id: 'a', name: 'A', url: 'https://a.com' }, { id: undefined, name: 'TikTok', url: 'https://tiktok.com/leap' }]);
    expect(await screen.findByRole('status')).toHaveTextContent('Saved.'); expect(await screen.findByTestId('file-1')).toBeInTheDocument(); expect(screen.queryByText('Save first, then add a picture')).not.toBeInTheDocument();
  });
  it('a refusal is shown and the typing is kept; an expired sign-in goes to the sign-in page', async () => {
    const onSessionExpired = vi.fn(); await show([item('a', 'A', 'https://a.com')], { onSessionExpired }); fireEvent.change(row(0).getByLabelText('Link of A'), { target: { value: 'facebook' } }); m.save.mockRejectedValueOnce(new Error('items[0].url must be a web address'));
    save(); expect(await screen.findByRole('alert')).toHaveTextContent('must be a web address'); expect(row(0).getByLabelText('Link of A').value).toBe('facebook'); m.save.mockRejectedValueOnce(new SessionExpiredError('x')); save(); await waitFor(() => expect(onSessionExpired).toHaveBeenCalled());
  });
});
describe('the picture', () => {
  const choose = (i, name = 'logo.png') => fireEvent.change(screen.getByTestId(`file-${i}`), { target: { files: [new File(['x'], name, { type: 'image/png' })] } });
  it('a picture smaller than 128 x 128 is refused with its size, and a file that is not a picture shows its message', async () => {
    await show([item('a', 'A', 'https://a.com')]); m.load.mockResolvedValue({ image: {}, url: 'blob:s', width: 100, height: 300 }); choose(0);
    expect(await screen.findByRole('alert')).toHaveTextContent('too small (100 × 300 px)'); expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); m.load.mockRejectedValue(new Error('Please choose a JPG, PNG or WebP picture.')); choose(0); await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Please choose a JPG, PNG or WebP picture.'));
  });
  it('opens the crop window for that icon, saying the result is 256 x 256; Cancel sends nothing', async () => {
    await show([item('a', 'Facebook', 'https://a.com')]); choose(0); const dialog = await screen.findByRole('dialog', { name: 'Crop the picture for Facebook' });
    expect(within(dialog).getByText('Original 1000 × 600 px. The icon will be 256 × 256 px.')).toBeInTheDocument(); fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' })); expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(m.upload).not.toHaveBeenCalled();
  });
  it('Use this crop cuts the biggest centred square, sends it for THAT icon with the admin token, and shows the new picture', async () => {
    await show([item('a', 'A', 'https://a.com'), item('b', 'B', 'https://b.com')]); choose(1); fireEvent.click(await screen.findByRole('button', { name: 'Use this crop' })); await waitFor(() => expect(m.upload).toHaveBeenCalled());
    const rect = m.render.mock.calls[0][1]; expect(rect.size).toBeCloseTo(600, 3); expect(rect.sx).toBeCloseTo(200, 3); expect(rect.sy).toBeCloseTo(0, 3); expect(m.upload.mock.calls[0].slice(0, 2)).toEqual(['admin-token', 'b']);
    expect(await screen.findByRole('status')).toHaveTextContent('The website shows the new B picture'); expect(row(1).getByRole('img', { name: 'B picture' }).getAttribute('src')).toBe('http://api.test/uploads/b.png'); expect(row(0).getByText('Leap logo')).toBeInTheDocument(); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('a refusal from the server stays inside the window (nothing is lost)', async () => { await show([item('a', 'A', 'https://a.com')]); m.upload.mockRejectedValue(new Error('The picture must be exactly 256 x 256 px')); choose(0); fireEvent.click(await screen.findByRole('button', { name: 'Use this crop' })); expect(await within(await screen.findByRole('dialog')).findByRole('alert')).toHaveTextContent('exactly 256 x 256'); });
  it('uploading a picture does not throw away what was typed but not yet saved in other rows', async () => {
    await show([item('a', 'A', 'https://a.com'), item('b', 'B', 'https://b.com')]); fireEvent.change(row(1).getByLabelText('Name of icon 2'), { target: { value: 'B typed' } }); choose(0); fireEvent.click(await screen.findByRole('button', { name: 'Use this crop' })); await screen.findByRole('status');
    expect(row(1).getByLabelText('Name of icon 2').value).toBe('B typed');
  });
  it('Remove picture asks first, then shows the Leap logo again; Keep changes nothing', async () => {
    await show([item('a', 'A', 'https://a.com', '/uploads/a.png')]); fireEvent.click(row(0).getByRole('button', { name: 'Remove the picture of A' })); fireEvent.click(screen.getByRole('button', { name: 'Keep' })); expect(m.remove).not.toHaveBeenCalled();
    fireEvent.click(row(0).getByRole('button', { name: 'Remove the picture of A' })); fireEvent.click(screen.getByRole('button', { name: 'Remove' })); await waitFor(() => expect(m.remove).toHaveBeenCalledWith('admin-token', 'a')); expect(await row(0).findByText('Leap logo')).toBeInTheDocument();
  });
});
