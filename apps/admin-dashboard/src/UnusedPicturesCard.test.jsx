import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// "Pictures nothing uses": look first, remove only after a question, and say what happened. The server is replaced by fixed answers.
const m = vi.hoisted(() => ({ look: vi.fn(), remove: vi.fn() }));
vi.mock('./auth', () => { class SessionExpiredError extends Error {} return { SessionExpiredError, getStoredToken: () => 'admin-token', fetchUnusedPictures: (...a) => m.look(...a), removeUnusedPictures: (...a) => m.remove(...a) }; });
import UnusedPicturesCard from './UnusedPicturesCard';
import { SessionExpiredError } from './auth';

beforeEach(() => { vi.clearAllMocks(); m.look.mockResolvedValue({ count: 3, bytes: 1572864, scanned: 40, tooNew: 2 }); m.remove.mockResolvedValue({ removed: 3, bytes: 1572864, failed: 0 }); });
const lookAt = async () => { fireEvent.click(screen.getByRole('button', { name: 'Check for unused pictures' })); await screen.findByText(/unused pictures?$/, { selector: 'b' }); };

describe('looking', () => {
  it('starts by only offering to check, and removes nothing by itself', () => { render(<UnusedPicturesCard />); expect(screen.getByRole('button', { name: 'Check for unused pictures' })).toBeInTheDocument(); expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument(); expect(m.remove).not.toHaveBeenCalled(); });
  it('says how many, how big, out of how many, and that younger ones are left alone', async () => {
    render(<UnusedPicturesCard />); await lookAt(); expect(m.look).toHaveBeenCalledWith('admin-token'); expect(screen.getByText('3 unused pictures')).toBeInTheDocument(); expect(screen.getByText(/1\.5 MB\) of 40 pictures on the server/)).toBeInTheDocument(); expect(screen.getByText(/2 more are less than a day old and left alone/)).toBeInTheDocument();
  });
  it('one unused picture reads in the singular; nothing unused says so and offers no removal', async () => {
    m.look.mockResolvedValue({ count: 1, bytes: 2048, scanned: 5, tooNew: 0 }); const { unmount } = render(<UnusedPicturesCard />); await lookAt(); expect(screen.getByText('1 unused picture')).toBeInTheDocument(); expect(screen.getByText(/2 KB/)).toBeInTheDocument(); unmount();
    m.look.mockResolvedValue({ count: 0, bytes: 0, scanned: 9, tooNew: 0 }); render(<UnusedPicturesCard />); fireEvent.click(screen.getByRole('button', { name: 'Check for unused pictures' })); expect(await screen.findByText('No unused pictures. Nothing to remove.')).toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Remove them' })).not.toBeInTheDocument();
  });
  it('a failure is shown, and an expired sign-in goes to the sign-in page', async () => {
    m.look.mockRejectedValueOnce(new Error('Request failed (500)')); const onSessionExpired = vi.fn(); render(<UnusedPicturesCard onSessionExpired={onSessionExpired} />); fireEvent.click(screen.getByRole('button', { name: 'Check for unused pictures' })); expect(await screen.findByRole('alert')).toHaveTextContent('Request failed (500)');
    m.look.mockRejectedValueOnce(new SessionExpiredError('x')); fireEvent.click(screen.getByRole('button', { name: 'Check for unused pictures' })); await waitFor(() => expect(onSessionExpired).toHaveBeenCalled());
  });
});
describe('removing', () => {
  it('asks first; "No" removes nothing and goes back; "Yes" removes and reports how many and how much', async () => {
    render(<UnusedPicturesCard />); await lookAt(); fireEvent.click(screen.getByRole('button', { name: 'Remove them' })); expect(screen.getByText(/Remove 3 pictures for ever\? This cannot be undone\./)).toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: 'No' })); expect(m.remove).not.toHaveBeenCalled(); expect(screen.getByRole('button', { name: 'Remove them' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove them' })); fireEvent.click(screen.getByRole('button', { name: 'Yes, remove them' })); await waitFor(() => expect(m.remove).toHaveBeenCalledWith('admin-token')); expect(await screen.findByText('Removed 3 pictures (1.5 MB).')).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Check again' })).toBeInTheDocument();
  });
  it('says so when some could not be removed, and when nothing was removed', async () => {
    m.remove.mockResolvedValue({ removed: 2, bytes: 4096, failed: 1 }); render(<UnusedPicturesCard />); await lookAt(); fireEvent.click(screen.getByRole('button', { name: 'Remove them' })); fireEvent.click(screen.getByRole('button', { name: 'Yes, remove them' })); expect(await screen.findByText(/Removed 2 pictures \(4 KB\)\. 1 picture could not be removed\./)).toBeInTheDocument();
    m.remove.mockResolvedValue({ removed: 0, bytes: 0, failed: 0 }); fireEvent.click(screen.getByRole('button', { name: 'Check again' })); await screen.findByText('3 unused pictures'); fireEvent.click(screen.getByRole('button', { name: 'Remove them' })); fireEvent.click(screen.getByRole('button', { name: 'Yes, remove them' })); expect(await screen.findByText('Nothing was removed.')).toBeInTheDocument();
  });
  it('the button cannot be pressed twice while it removes; a failure keeps the question so it can be tried again', async () => {
    render(<UnusedPicturesCard />); await lookAt(); fireEvent.click(screen.getByRole('button', { name: 'Remove them' })); let release; m.remove.mockReturnValueOnce(new Promise((r) => { release = r; })); fireEvent.click(screen.getByRole('button', { name: 'Yes, remove them' })); expect(await screen.findByRole('button', { name: 'Removing…' })).toBeDisabled(); release({ removed: 3, bytes: 1, failed: 0 }); await screen.findByText(/^Removed 3 pictures/);
    fireEvent.click(screen.getByRole('button', { name: 'Check again' })); await screen.findByText('3 unused pictures'); fireEvent.click(screen.getByRole('button', { name: 'Remove them' })); m.remove.mockRejectedValueOnce(new Error('Request failed (500)')); fireEvent.click(screen.getByRole('button', { name: 'Yes, remove them' })); expect(await screen.findByRole('alert')).toHaveTextContent('Request failed (500)'); expect(screen.getByRole('button', { name: 'Yes, remove them' })).toBeInTheDocument();
  });
});
