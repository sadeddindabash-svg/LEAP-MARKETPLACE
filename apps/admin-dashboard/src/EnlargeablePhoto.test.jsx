import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { EnlargeablePhoto } from './components/ui';

const SRC = 'http://localhost:4000/uploads/evidence.jpg';

describe('EnlargeablePhoto — click an evidence photo to see it full size', () => {
  const open = () => fireEvent.click(screen.getByTitle('Click to enlarge'));
  const viewer = () => screen.queryByRole('dialog', { name: 'Photo' });

  it('shows a small clickable thumbnail first, and nothing enlarged yet', () => {
    render(<EnlargeablePhoto src={SRC} style={{ width: 48, height: 48 }} />);
    const thumb = screen.getByTitle('Click to enlarge');
    expect(thumb.getAttribute('src')).toBe(SRC);
    expect(thumb.style.cursor).toBe('zoom-in');
    expect(viewer()).toBeNull();
  });

  it('CRITICAL: clicking it opens the full-size view of the same photo, with a link to the original file', () => {
    render(<EnlargeablePhoto src={SRC} />);
    open();
    const dialog = viewer();
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole('img').getAttribute('src')).toBe(SRC);
    const link = within(dialog).getByRole('link', { name: 'Open original' });
    expect(link.getAttribute('href')).toBe(SRC);
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it('closes with the × button, with Escape, and by clicking outside the picture', () => {
    render(<EnlargeablePhoto src={SRC} />);

    open();
    fireEvent.click(within(viewer()).getByRole('button', { name: 'Close' }));
    expect(viewer()).toBeNull();

    open();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(viewer()).toBeNull();

    open();
    fireEvent.click(viewer()); // the dark backdrop
    expect(viewer()).toBeNull();
  });

  it('clicking the enlarged picture itself does NOT close it (so you can zoom, select, or right-click it)', () => {
    render(<EnlargeablePhoto src={SRC} />);
    open();
    fireEvent.click(within(viewer()).getByRole('img'));
    expect(viewer()).toBeInTheDocument();
  });

  it('works from the keyboard: Enter and Space open it', () => {
    render(<EnlargeablePhoto src={SRC} />);
    fireEvent.keyDown(screen.getByTitle('Click to enlarge'), { key: 'Enter' });
    expect(viewer()).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.keyDown(screen.getByTitle('Click to enlarge'), { key: ' ' });
    expect(viewer()).toBeInTheDocument();
  });

  it('several photos on one page each open their own picture', () => {
    render(<><EnlargeablePhoto src="http://x/a.jpg" /><EnlargeablePhoto src="http://x/b.jpg" /></>);
    fireEvent.click(screen.getAllByTitle('Click to enlarge')[1]);
    expect(within(viewer()).getByRole('img').getAttribute('src')).toBe('http://x/b.jpg');
  });
});
