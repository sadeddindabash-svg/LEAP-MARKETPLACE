import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LeapHubPortalApp from './App';

const STAFF = { id: 'hub_staff_new', email: 'new.staff@leap.dev', name: 'New Staff', role: 'hub_staff', hubId: 'hub_guangzhou' };
const SHIPMENT = { id: 42, status: 'awaiting_receipt', createdAt: '2026-07-14T00:00:00.000Z', updatedAt: '2026-07-14T00:00:00.000Z', subOrderId: 100, orderId: 'LP-200999', supplierName: 'Guangzhou AutoParts Co.', replacementFor: null };

// `mustChange`: the server says the account still has only a TEMPORARY password. `changeResult`: how PATCH /auth/me/password answers.
function mockFetch({ mustChange = true, changeResult = { status: 200, body: { ok: true } }, calls = [] } = {}) {
  return vi.fn((url, options) => {
    const u = String(url);
    const method = options?.method || 'GET';
    const ok = (body, status = 200) => Promise.resolve({ ok: status < 400, status, json: async () => body });
    if (u.includes('/auth/login')) return ok({ token: 'fake.jwt.token', user: { ...STAFF, mustChangePassword: mustChange } });
    if (u.endsWith('/auth/me/password') && method === 'PATCH') {
      calls.push({ headers: options.headers, body: JSON.parse(options.body) });
      return ok(changeResult.body, changeResult.status);
    }
    if (u.includes('/auth/me')) return ok({ ...STAFF, mustChangePassword: mustChange });
    if (u.endsWith('/hub/me/shipments')) return ok([SHIPMENT]);
    return ok({});
  });
}
async function signIn() {
  await waitFor(() => document.getElementById('hub-email'));
  fireEvent.change(document.getElementById('hub-email'), { target: { value: STAFF.email } });
  fireEvent.change(document.getElementById('hub-password'), { target: { value: 'the-temporary-password' } });
  fireEvent.click(document.querySelector('button[type="submit"]'));
}
const fill = (current, next, confirm) => {
  fireEvent.change(document.getElementById('hub-current-password'), { target: { value: current } });
  fireEvent.change(document.getElementById('hub-new-password'), { target: { value: next } });
  fireEvent.change(document.getElementById('hub-confirm-password'), { target: { value: confirm } });
};
const submit = () => fireEvent.click(document.querySelector('button[type="submit"]'));

beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('Hub portal: choosing your own password after a temporary one (mocked fetch, real component tree)', () => {
  it('CRITICAL: signing in with a TEMPORARY password shows the "set your password" screen and NOT the queue', async () => {
    globalThis.fetch = mockFetch({ mustChange: true });
    render(<LeapHubPortalApp />);
    await signIn();
    expect(await screen.findByText('设置您的新密码')).toBeInTheDocument();
    expect(screen.getByText(/临时密码，请先设置自己的密码|管理员提供的临时密码/)).toBeInTheDocument();
    // Give the queue every chance to load, then prove it did not: it was never even REQUESTED, so there is no way past this screen to the work.
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(screen.queryByText('LP-200999')).not.toBeInTheDocument();
    expect(globalThis.fetch.mock.calls.some(([url]) => String(url).endsWith('/hub/me/shipments'))).toBe(false);
  });

  it('CRITICAL: a person whose password is their own goes straight to the queue', async () => {
    globalThis.fetch = mockFetch({ mustChange: false });
    render(<LeapHubPortalApp />);
    await signIn();
    expect(await screen.findByText('LP-200999')).toBeInTheDocument();
    expect(screen.queryByText('设置您的新密码')).not.toBeInTheDocument();
  });

  it('CRITICAL: reopening the portal with a saved session still forces it (the flag comes from the server, not from the login screen)', async () => {
    localStorage.setItem('leap_hub_token', 'fake.jwt.token');
    globalThis.fetch = mockFetch({ mustChange: true });
    render(<LeapHubPortalApp />);
    expect(await screen.findByText('设置您的新密码')).toBeInTheDocument();
    expect(screen.queryByText('LP-200999')).not.toBeInTheDocument();
  });

  it('each mistake is explained and nothing is sent: too short, not matching, same as the temporary one', async () => {
    const calls = [];
    globalThis.fetch = mockFetch({ calls });
    render(<LeapHubPortalApp />);
    await signIn();
    await screen.findByText('设置您的新密码');

    fill('the-temporary-password', 'short', 'short'); submit();
    expect(await screen.findByText('新密码至少需要 8 位。')).toBeInTheDocument();
    fill('the-temporary-password', 'a-good-new-password', 'a-different-one'); submit();
    expect(await screen.findByText('两次输入的新密码不一致。')).toBeInTheDocument();
    fill('the-temporary-password', 'the-temporary-password', 'the-temporary-password'); submit();
    expect(await screen.findByText('新密码不能与临时密码相同。')).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it('CRITICAL: saving sends the current and new password with the session, and then opens the queue', async () => {
    const calls = [];
    globalThis.fetch = mockFetch({ calls });
    render(<LeapHubPortalApp />);
    await signIn();
    await screen.findByText('设置您的新密码');
    fill('the-temporary-password', 'my-own-new-password', 'my-own-new-password'); submit();
    expect(await screen.findByText('LP-200999')).toBeInTheDocument();
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toEqual({ currentPassword: 'the-temporary-password', newPassword: 'my-own-new-password' });
    expect(calls[0].headers.Authorization).toBe('Bearer fake.jwt.token');
    expect(screen.queryByText('设置您的新密码')).not.toBeInTheDocument();
  });

  it('a refusal from the server (for example the temporary password was typed wrongly) is shown, and the person stays on the screen', async () => {
    globalThis.fetch = mockFetch({ changeResult: { status: 401, body: { error: 'The current password is not right' } } });
    render(<LeapHubPortalApp />);
    await signIn();
    await screen.findByText('设置您的新密码');
    fill('wrong-temporary', 'my-own-new-password', 'my-own-new-password'); submit();
    expect(await screen.findByText('The current password is not right')).toBeInTheDocument();
    expect(screen.getByText('设置您的新密码')).toBeInTheDocument();
    expect(screen.queryByText('LP-200999')).not.toBeInTheDocument();
  });

  it('the screen can be read in English, and has a way to sign out', async () => {
    globalThis.fetch = mockFetch();
    render(<LeapHubPortalApp />);
    await signIn();
    await screen.findByText('设置您的新密码');
    fireEvent.click(screen.getByRole('button', { name: 'EN' }));
    expect(await screen.findByText('Choose your own password')).toBeInTheDocument();
    expect(screen.getByLabelText('New password (at least 8 characters)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /sign out|log out|退出登录/i }));
    await waitFor(() => expect(document.getElementById('hub-email')).toBeInTheDocument());
  });
});
