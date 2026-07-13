import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginPage from './LoginPage';
import LeapAdminApp from './App';

const ADMIN_USER = { id: 'admin_dev_seed', email: 'admin@leap.dev', name: 'Dev Admin', role: 'admin' };
const BUYER_USER = { id: 'u_123', email: 'buyer@example.com', name: 'A Buyer', role: 'buyer' };

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('LoginPage', () => {
  it('calls onLoginSuccess with token and user on successful admin login', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'fake.jwt.token', user: ADMIN_USER }),
    });
    const onLoginSuccess = vi.fn();
    render(<LoginPage onLoginSuccess={onLoginSuccess} />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'admin@leap.dev' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'admin_dev_password_123' } });
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => expect(onLoginSuccess).toHaveBeenCalledWith('fake.jwt.token', ADMIN_USER));
  });

  it('rejects a successful login for a non-admin role, without calling onLoginSuccess', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'fake.jwt.token', user: BUYER_USER }),
    });
    const onLoginSuccess = vi.fn();
    render(<LoginPage onLoginSuccess={onLoginSuccess} />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'buyer@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'whatever123' } });
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => expect(screen.getByText(/doesn't have admin access/i)).toBeInTheDocument());
    expect(onLoginSuccess).not.toHaveBeenCalled();
  });

  it('shows the API error message on failed login (e.g. wrong password)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Invalid email or password' }),
    });
    render(<LoginPage onLoginSuccess={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'admin@leap.dev' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrongpassword' } });
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument());
  });
});

describe('LeapAdminApp auth gate', () => {
  it('shows the login page when no session is saved', async () => {
    render(<LeapAdminApp />);
    await waitFor(() => expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument());
  });

  it('shows the real dashboard when a valid saved token exists', async () => {
    localStorage.setItem('leap_admin_token', 'saved.valid.token');
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ADMIN_USER,
    });
    render(<LeapAdminApp />);
    // 'Overview' appears twice (nav item + page title), so assert on the
    // logout button instead — it only exists once the dashboard is shown.
    await waitFor(() => expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument());
    expect(screen.getByText(ADMIN_USER.email)).toBeInTheDocument();
  });

  it('clears an invalid/expired saved token and falls back to the login page', async () => {
    localStorage.setItem('leap_admin_token', 'expired.token');
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'expired' }) });
    render(<LeapAdminApp />);
    await waitFor(() => expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument());
    expect(localStorage.getItem('leap_admin_token')).toBeNull();
  });

  it('logs out correctly: clears token and returns to login page', async () => {
    localStorage.setItem('leap_admin_token', 'saved.valid.token');
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ADMIN_USER });
    render(<LeapAdminApp />);
    await waitFor(() => expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /log out/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /^log in$/i })).toBeInTheDocument());
    expect(localStorage.getItem('leap_admin_token')).toBeNull();
  });
});
