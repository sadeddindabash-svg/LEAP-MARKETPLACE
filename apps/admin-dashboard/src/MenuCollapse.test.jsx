import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LeapAdminApp from './App';

// The side menu: collapsible to icons only (the name shows on hover and is the button's name), the chosen item marked, the choice remembered.
const OWNER_USER = { id: 'admin_dev_seed', email: 'admin@leap.dev', name: 'Dev Admin', role: 'admin', isOwner: true, allowedPages: 'all' };
const mockFetch = () => vi.fn((url) => {
  const u = String(url);
  if (u.includes('/auth/login')) return Promise.resolve({ ok: true, json: async () => ({ token: 'fake.jwt.token', user: OWNER_USER }) });
  if (u.includes('/auth/me')) return Promise.resolve({ ok: true, json: async () => OWNER_USER });
  return Promise.resolve({ ok: true, json: async () => ([]) });
});
async function signIn() {
  globalThis.fetch = mockFetch(); render(<LeapAdminApp />);
  fireEvent.click(await screen.findByRole('button', { name: /log in/i })); await waitFor(() => screen.getByLabelText(/email/i));
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'admin@leap.dev' } }); fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'admin_dev_password_123' } });
  fireEvent.click(screen.getByRole('button', { name: /log in/i })); await waitFor(() => expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument());
}
beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('the side menu', () => {
  it('collapses to icons only and expands again; the pages keep their names; the choice is remembered', async () => {
    await signIn();
    const menu = screen.getByRole('navigation', { name: 'Main menu' });
    expect(menu).toHaveStyle({ width: '240px' }); expect(screen.getByText('Orders')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Collapse the menu' }));
    expect(menu).toHaveStyle({ width: '76px' }); expect(localStorage.getItem('leap_admin_menu_collapsed')).toBe('1');
    expect(screen.getByRole('button', { name: 'Orders' })).toBeInTheDocument();                    // the icon button is still called "Orders"
    fireEvent.click(screen.getByRole('button', { name: 'Orders' }));
    expect(screen.getByRole('button', { name: 'Orders' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Expand the menu' }));
    expect(menu).toHaveStyle({ width: '240px' }); expect(localStorage.getItem('leap_admin_menu_collapsed')).toBe('0');
  });
  it('opens collapsed when it was left collapsed', async () => {
    localStorage.setItem('leap_admin_menu_collapsed', '1'); await signIn();
    expect(screen.getByRole('navigation', { name: 'Main menu' })).toHaveStyle({ width: '76px' }); expect(screen.getByRole('button', { name: 'Expand the menu' })).toBeInTheDocument();
  });
});
