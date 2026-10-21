import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

// "Home page pictures" in the admin portal: the card, the crop step and the saving, with the server and the browser's picture/canvas functions replaced by fixed values.
const m = vi.hoisted(() => ({ fetch: vi.fn(), upload: vi.fn(), remove: vi.fn(), load: vi.fn(), render: vi.fn() }));
vi.mock('./homePicturesApi', () => ({ SLOTS: ['parts', 'brands', 'models', 'countries'], fetchHomePictures: (...a) => m.fetch(...a), uploadHomePicture: (...a) => m.upload(...a), removeHomePicture: (...a) => m.remove(...a), pictureSrc: (u) => (u ? `http://api.test${u}` : null) }));
vi.mock('./homePictureImage', () => ({ loadImageFile: (...a) => m.load(...a), renderCrop: (...a) => m.render(...a) }));
vi.mock('./auth', () => { class SessionExpiredError extends Error {} return { SessionExpiredError, getStoredToken: () => 'admin-token' }; });
import HomePicturesSection from './HomePicturesSection';
import { SessionExpiredError } from './auth';

const EMPTY = { parts: null, brands: null, models: null, countries: null };
const file = (name = 'car.jpg', type = 'image/jpeg') => new File(['x'], name, { type });
const loaded = (width = 3000, height = 2000) => ({ image: { tag: 'image' }, url: 'blob:test', width, height });
const choose = (slot, f = file()) => fireEvent.change(screen.getByTestId(`file-${slot}`), { target: { files: [f] } });
const show = async (pictures = EMPTY, props = {}) => { m.fetch.mockResolvedValue(pictures); const view = render(<HomePicturesSection onSessionExpired={props.onSessionExpired} />); await screen.findByTestId('row-parts'); return view; };
beforeEach(() => {
  vi.clearAllMocks(); m.load.mockResolvedValue(loaded()); m.render.mockResolvedValue(new Blob(['jpeg'], { type: 'image/jpeg' }));
  m.upload.mockImplementation(async (token, slot) => ({ slot, url: `/uploads/${slot}.jpg`, pictures: { ...EMPTY, [slot]: `/uploads/${slot}.jpg` } })); m.remove.mockImplementation(async (token, slot) => ({ slot, url: null, pictures: EMPTY }));
  globalThis.URL.revokeObjectURL = vi.fn();
});

describe('the card', () => {
  it('lists the four pictures: a picture shows with Replace and Remove, an empty one shows the icon text and Choose picture', async () => {
    await show({ ...EMPTY, brands: '/uploads/brands.jpg' });
    const brands = within(screen.getByTestId('row-brands')); expect(brands.getByRole('img', { name: 'Brands picture' }).getAttribute('src')).toBe('http://api.test/uploads/brands.jpg');
    expect(brands.getByText('Picture set')).toBeInTheDocument(); expect(brands.getByText('Replace')).toBeInTheDocument(); expect(brands.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
    const parts = within(screen.getByTestId('row-parts')); expect(parts.getByText('No picture: the icon is shown')).toBeInTheDocument(); expect(parts.getByText('Choose picture')).toBeInTheDocument(); expect(parts.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
  });
  it('says what size to choose', async () => { await show(); expect(screen.getByText(/at least 400 × 400 px/)).toBeInTheDocument(); expect(screen.getByText(/saved at 600 × 600/)).toBeInTheDocument(); });
  it('a server that cannot be reached shows the problem instead of a broken card', async () => {
    m.fetch.mockRejectedValue(new Error('Request failed (500)')); render(<HomePicturesSection />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Request failed (500)'); expect(screen.queryByTestId('row-parts')).not.toBeInTheDocument();
  });
});

describe('choosing a picture', () => {
  it('a picture that is too small is refused with its real size, and no crop window opens', async () => {
    await show(); m.load.mockResolvedValue(loaded(300, 500)); choose('parts');
    expect(await screen.findByRole('alert')).toHaveTextContent('too small (300 × 500 px)'); expect(screen.getByRole('alert')).toHaveTextContent('at least 400 × 400'); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
  });
  it('exactly 400 × 400 is big enough', async () => { await show(); m.load.mockResolvedValue(loaded(400, 400)); choose('parts'); expect(await screen.findByRole('dialog')).toBeInTheDocument(); });
  it('a file that is not a supported picture shows the message from the picture reader', async () => {
    await show(); m.load.mockRejectedValue(new Error('Please choose a JPG, PNG or WebP picture.')); choose('parts', file('x.gif', 'image/gif'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Please choose a JPG, PNG or WebP picture.'); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('opens the crop window for that picture, with its original size and the size it will be saved at', async () => {
    await show(); choose('models');
    const dialog = await screen.findByRole('dialog', { name: 'Crop the picture for Models' });
    expect(within(dialog).getByText('Original 3000 × 2000 px. The result will be 600 × 600 px.')).toBeInTheDocument();
  });
  it('Cancel closes it without sending anything', async () => {
    await show(); choose('models'); fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(m.upload).not.toHaveBeenCalled(); expect(m.render).not.toHaveBeenCalled();
  });
});

describe('cropping and saving', () => {
  const rectUsed = () => m.render.mock.calls[0][1];
  it('Use this crop sends the biggest centred square of the picture as a 600 × 600 JPEG, for the right picture, with the admin token', async () => {
    await show(); choose('brands'); fireEvent.click(await screen.findByRole('button', { name: 'Use this crop' }));
    await waitFor(() => expect(m.upload).toHaveBeenCalled());
    const r = rectUsed(); expect(r.size).toBeCloseTo(2000, 3); expect(r.sx).toBeCloseTo(500, 3); expect(r.sy).toBeCloseTo(0, 3);
    expect(m.upload.mock.calls[0][0]).toBe('admin-token'); expect(m.upload.mock.calls[0][1]).toBe('brands'); expect(m.upload.mock.calls[0][2]).toBeInstanceOf(Blob);
    expect(m.render.mock.calls[0][0]).toEqual({ tag: 'image' });
  });
  it('afterwards the card shows the new picture, says it was saved (and that it takes about a minute), and the window is closed', async () => {
    await show(); choose('brands'); fireEvent.click(await screen.findByRole('button', { name: 'Use this crop' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Saved. The home page shows the new Brands picture within about a minute.');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(within(screen.getByTestId('row-brands')).getByRole('img').getAttribute('src')).toBe('http://api.test/uploads/brands.jpg');
  });
  it('zooming in crops a smaller square from the middle', async () => {
    await show(); choose('parts'); fireEvent.change(await screen.findByLabelText('Zoom'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Use this crop' })); await waitFor(() => expect(m.render).toHaveBeenCalled());
    const r = rectUsed(); expect(r.size).toBeCloseTo(1000, 3); expect(r.sx).toBeCloseTo(1000, 3); expect(r.sy).toBeCloseTo(500, 3);
  });
  it('the arrow keys move the frame over the picture (right moves it right)', async () => {
    await show(); choose('parts'); fireEvent.change(await screen.findByLabelText('Zoom'), { target: { value: '2' } });
    fireEvent.keyDown(screen.getByRole('group', { name: /Square frame/ }), { key: 'ArrowRight' });
    fireEvent.click(screen.getByRole('button', { name: 'Use this crop' })); await waitFor(() => expect(m.render).toHaveBeenCalled());
    expect(rectUsed().sx).toBeGreaterThan(1000); expect(rectUsed().sy).toBeCloseTo(500, 3);
  });
  it('dragging the picture moves what is inside the frame (dragging left shows more of the right)', async () => {
    await show(); choose('parts'); fireEvent.change(await screen.findByLabelText('Zoom'), { target: { value: '2' } });
    const frame = screen.getByRole('group', { name: /Square frame/ });
    fireEvent.pointerDown(frame, { clientX: 200, clientY: 100, pointerId: 1 }); fireEvent.pointerMove(frame, { clientX: 150, clientY: 100, pointerId: 1 }); fireEvent.pointerUp(frame, { pointerId: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Use this crop' })); await waitFor(() => expect(m.render).toHaveBeenCalled());
    expect(rectUsed().sx).toBeGreaterThan(1000);
  });
  it('the frame can never be pushed past the edge of the picture', async () => {
    await show(); choose('parts'); const frame = await screen.findByRole('group', { name: /Square frame/ });
    for (let i = 0; i < 80; i++) fireEvent.keyDown(frame, { key: 'ArrowRight' });
    fireEvent.click(screen.getByRole('button', { name: 'Use this crop' })); await waitFor(() => expect(m.render).toHaveBeenCalled());
    const r = rectUsed(); expect(r.sx + r.size).toBeLessThanOrEqual(3000 + 1e-6); expect(r.sx).toBeCloseTo(1000, 3);
  });
  it('a refusal from the server is shown inside the window, which stays open so nothing is lost', async () => {
    await show(); m.upload.mockRejectedValue(new Error('The picture must be exactly 600 x 600 px')); choose('parts'); fireEvent.click(await screen.findByRole('button', { name: 'Use this crop' }));
    expect(await within(await screen.findByRole('dialog')).findByRole('alert')).toHaveTextContent('exactly 600 x 600'); expect(screen.getByRole('button', { name: 'Use this crop' })).not.toBeDisabled();
  });
  it('an expired sign-in sends the admin to the sign-in page', async () => {
    const onSessionExpired = vi.fn(); await show(EMPTY, { onSessionExpired }); m.upload.mockRejectedValue(new SessionExpiredError('expired'));
    choose('parts'); fireEvent.click(await screen.findByRole('button', { name: 'Use this crop' })); await waitFor(() => expect(onSessionExpired).toHaveBeenCalled());
  });
  it('while it saves the buttons cannot be pressed twice', async () => {
    await show(); let release; m.upload.mockReturnValue(new Promise((r) => { release = r; })); choose('parts');
    fireEvent.click(await screen.findByRole('button', { name: 'Use this crop' })); expect(await screen.findByRole('button', { name: 'Saving…' })).toBeDisabled(); expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    release({ slot: 'parts', url: '/uploads/p.jpg', pictures: { ...EMPTY, parts: '/uploads/p.jpg' } }); await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('removing a picture', () => {
  it('asks first; Keep changes nothing', async () => {
    await show({ ...EMPTY, parts: '/uploads/parts.jpg' }); fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(screen.getByText('Remove the Parts picture?')).toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: 'Keep' }));
    expect(m.remove).not.toHaveBeenCalled(); expect(screen.getByText('Picture set')).toBeInTheDocument();
  });
  it('confirming removes it, brings the icon back and says so', async () => {
    await show({ ...EMPTY, parts: '/uploads/parts.jpg' }); fireEvent.click(screen.getByRole('button', { name: 'Remove' })); fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(m.remove).toHaveBeenCalledWith('admin-token', 'parts'));
    expect(await within(screen.getByTestId('row-parts')).findByText('No picture: the icon is shown')).toBeInTheDocument(); expect(screen.getByRole('status')).toHaveTextContent('The Parts picture was removed');
  });
  it('a failed removal keeps the picture and shows why', async () => {
    await show({ ...EMPTY, parts: '/uploads/parts.jpg' }); m.remove.mockRejectedValue(new Error('Request failed (500)'));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' })); fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Request failed (500)'); expect(screen.getByText('Remove the Parts picture?')).toBeInTheDocument();
  });
});
