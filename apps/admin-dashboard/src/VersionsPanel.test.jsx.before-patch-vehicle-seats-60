import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import VersionsPanel from './VersionsPanel';

// The Versions panel under one year (mocked server). A version has its name and engine in English, Arabic and Chinese, seats and a photo.
const GEN = { id: 'gen_2024', name: '2024', yearStart: 2024, yearEnd: 2024 };
const V1 = { id: 'ver_1', generationId: 'gen_2024', name: 'AWD Flagship', nameAr: 'دفع كلي فلاجشيب', nameZh: '全轮驱动 旗舰版', engine: '1.5T range extender (365 kW)', engineAr: '1.5 لتر', engineZh: '1.5升', seats: 5, photoUrl: '/uploads/v1.png' };
const V2 = { id: 'ver_2', generationId: 'gen_2024', name: 'RWD Standard', nameAr: 'دفع خلفي ستاندرد', nameZh: '后驱 标准型', engine: 'Electric motor (200 kW)', engineAr: 'محرك كهربائي', engineZh: '电动机', seats: 6, photoUrl: null };
const FULL = { name: 'EV Max', nameAr: 'إي في ماكس', nameZh: '纯电 旗舰', engine: 'Electric (300 kW)', engineAr: 'كهربائي', engineZh: '电动', seats: '5' };

let versions, calls, uploadFails, postStatus;
function mockFetch() {
  versions = [{ ...V1 }, { ...V2 }]; calls = []; uploadFails = null; postStatus = 201;
  globalThis.fetch = vi.fn((url, options) => {
    const u = String(url).replace(/^https?:\/\/[^/]+/, ''); const method = options?.method || 'GET';
    const isUpload = u.endsWith('/fitment/catalog-image');
    calls.push({ method, url: u, body: !isUpload && options?.body ? JSON.parse(options.body) : null, auth: options?.headers?.Authorization });
    const ok = (b, status = 200) => Promise.resolve({ ok: true, status, json: async () => b });
    const fail = (status, error) => Promise.resolve({ ok: false, status, json: async () => ({ error }) });
    if (isUpload) return uploadFails ? fail(400, uploadFails) : ok({ url: '/uploads/uploaded.png', width: 400, height: 400, storage: 'local' }, 201);
    if (method === 'GET' && u.endsWith('/generations/gen_2024/versions')) return ok(versions);
    if (method === 'POST' && u.endsWith('/generations/gen_2024/versions')) {
      if (postStatus !== 201) return postStatus === 401 ? fail(401, 'expired') : fail(postStatus, 'This version with this engine already exists for this year');
      const v = { id: 'ver_new', generationId: 'gen_2024', ...JSON.parse(options.body) }; versions = [...versions, v]; return ok(v, 201);
    }
    if (method === 'PATCH' && u.endsWith('/photo')) { const id = u.split('/')[3]; versions = versions.map((v) => (v.id === id ? { ...v, photoUrl: JSON.parse(options.body).photoUrl } : v)); return ok(versions.find((v) => v.id === id)); }
    if (method === 'PATCH' && u.match(/\/fitment\/versions\/[^/]+$/)) { const id = u.split('/')[3]; versions = versions.map((v) => (v.id === id ? { ...v, ...JSON.parse(options.body) } : v)); return ok(versions.find((v) => v.id === id)); }
    if (method === 'DELETE') { const id = u.split('/')[3]; versions = versions.filter((v) => v.id !== id); return Promise.resolve({ ok: true, status: 204, json: async () => null }); }
    return ok({});
  });
}
const writes = () => calls.filter((c) => c.method !== 'GET');
const photoFile = () => new File(['x'], 'photo.png', { type: 'image/png' });
async function openPanel(props = {}) {
  render(<VersionsPanel generation={GEN} onSessionExpired={vi.fn()} {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Versions of 2024' }));
  await screen.findByText('AWD Flagship');
}
function fillForm(values, scope = screen) {
  const set = (label, value) => fireEvent.change(scope.getAllByLabelText(label).at(-1), { target: { value } });
  set('Version (English)', values.name); set('Version (Arabic)', values.nameAr); set('Version (Chinese)', values.nameZh);
  set('Engine (English)', values.engine); set('Engine (Arabic)', values.engineAr); set('Engine (Chinese)', values.engineZh); set('Seats', values.seats);
}
const newPhotoInput = () => screen.getByText(/choose photo \(required, at least 400 px\)|photo selected/i).closest('label').querySelector('input');
const addButton = () => screen.getByRole('button', { name: /add version/i });

beforeEach(() => { localStorage.clear(); localStorage.setItem('leap_admin_token', 'fake.jwt.token'); mockFetch(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('the Versions panel under a year', () => {
  it('CRITICAL: it asks the server for nothing until opened, then lists the versions with their three-language names, engine, seats, and marks the one with no photo', async () => {
    render(<VersionsPanel generation={GEN} onSessionExpired={vi.fn()} />);
    expect(calls).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Versions of 2024' }));
    await screen.findByText('AWD Flagship');
    expect(screen.getByText(/^Versions \(2\)/)).toBeInTheDocument();
    expect(screen.getByText('دفع كلي فلاجشيب')).toBeInTheDocument();
    expect(screen.getByText('全轮驱动 旗舰版')).toBeInTheDocument();
    expect(screen.getByText(/1\.5T range extender \(365 kW\) · 5 seats/)).toBeInTheDocument();
    expect(screen.getByText('Has photo')).toBeInTheDocument();
    expect(screen.getByText('No photo yet')).toBeInTheDocument();
    expect(screen.getByText('1 without photo')).toBeInTheDocument();
    expect(screen.getByLabelText('Add photo for RWD Standard')).toBeInTheDocument();
    expect(screen.getByLabelText('Replace photo for AWD Flagship')).toBeInTheDocument();
  });

  it('CRITICAL: every field is required, each missing one is explained, and nothing is sent: the six texts in three languages, the seats and the photo', async () => {
    await openPanel();
    fireEvent.click(addButton());
    expect(await screen.findByText('Version name in English is required.')).toBeInTheDocument();
    const steps = [['name', 'Version name in English'], ['nameAr', 'Version name in Arabic'], ['nameZh', 'Version name in Chinese'], ['engine', 'Engine in English'], ['engineAr', 'Engine in Arabic'], ['engineZh', 'Engine in Chinese']];
    const partial = { name: '', nameAr: '', nameZh: '', engine: '', engineAr: '', engineZh: '', seats: '' };
    for (const [key, label] of steps) {
      expect(screen.getByText(`${label} is required.`)).toBeInTheDocument();
      partial[key] = FULL[key]; fillForm(partial); fireEvent.click(addButton());
    }
    expect(await screen.findByText('Seats must be a whole number from 1 to 12.')).toBeInTheDocument();
    for (const bad of ['0', '13', 'five', '5.5']) { fillForm({ ...FULL, seats: bad }); fireEvent.click(addButton()); expect(screen.getByText('Seats must be a whole number from 1 to 12.')).toBeInTheDocument(); }
    fillForm(FULL); fireEvent.click(addButton());
    expect(await screen.findByText('A photo is required.')).toBeInTheDocument();
    expect(writes()).toEqual([]);
  });

  it('CRITICAL: a complete version uploads its photo FIRST (through the 400 px door) and is then created with the photo, seats as a number, and appears in the list', async () => {
    await openPanel();
    fillForm(FULL);
    fireEvent.change(newPhotoInput(), { target: { files: [photoFile()] } });
    fireEvent.click(addButton());
    await screen.findByText('EV Max');
    const upload = calls.findIndex((c) => c.url.endsWith('/fitment/catalog-image'));
    const create = calls.findIndex((c) => c.method === 'POST' && c.url.endsWith('/versions'));
    expect(upload).toBeGreaterThan(-1); expect(create).toBeGreaterThan(upload);
    expect(calls[create].body).toEqual({ ...FULL, seats: 5, photoUrl: '/uploads/uploaded.png' });
    expect(calls[create].auth).toBe('Bearer fake.jwt.token');
    expect(calls.some((c) => c.url.includes('/uploads/product-image'))).toBe(false);          // never the 800 px door
  });

  it('CRITICAL: a photo the server refuses (too small) is explained and NO version is created', async () => {
    await openPanel();
    uploadFails = 'Image resolution too low (300x300). Shortest side must be at least 400px.';
    fillForm(FULL);
    fireEvent.change(newPhotoInput(), { target: { files: [photoFile()] } });
    fireEvent.click(addButton());
    expect(await screen.findByText(/Shortest side must be at least 400px/)).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/versions'))).toBe(false);
  });

  it('a version that already exists for this year is refused by the server and the message is shown', async () => {
    await openPanel();
    postStatus = 409;
    fillForm(FULL);
    fireEvent.change(newPhotoInput(), { target: { files: [photoFile()] } });
    fireEvent.click(addButton());
    expect(await screen.findByText('This version with this engine already exists for this year')).toBeInTheDocument();
  });

  it('an expired session while adding sends the admin back to sign in', async () => {
    const onSessionExpired = vi.fn();
    await openPanel({ onSessionExpired });
    postStatus = 401;
    fillForm(FULL);
    fireEvent.change(newPhotoInput(), { target: { files: [photoFile()] } });
    fireEvent.click(addButton());
    await waitFor(() => expect(onSessionExpired).toHaveBeenCalled());
  });

  it('CRITICAL: "Add photo" on a version that has none uploads through the 400 px door and sets it; the marker goes away', async () => {
    await openPanel();
    fireEvent.change(screen.getByLabelText('Add photo for RWD Standard'), { target: { files: [photoFile()] } });
    await waitFor(() => expect(screen.queryByText('No photo yet')).not.toBeInTheDocument());
    const patch = calls.find((c) => c.method === 'PATCH' && c.url.endsWith('/ver_2/photo'));
    expect(patch.body).toEqual({ photoUrl: '/uploads/uploaded.png' });
    expect(screen.queryByText('1 without photo')).not.toBeInTheDocument();
  });

  it('editing opens the form filled in; saving sends the changed fields (no photo upload unless a new one is chosen)', async () => {
    await openPanel();
    fireEvent.click(screen.getByLabelText('Edit AWD Flagship'));
    expect(screen.getAllByLabelText('Version (English)')[0]).toHaveValue('AWD Flagship');
    expect(screen.getAllByLabelText('Engine (Chinese)')[0]).toHaveValue('1.5升');
    expect(screen.getAllByLabelText('Seats')[0]).toHaveValue('5');
    fireEvent.change(screen.getAllByLabelText('Seats')[0], { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(screen.getByText(/· 7 seats/)).toBeInTheDocument());
    const patch = calls.find((c) => c.method === 'PATCH' && c.url.endsWith('/ver_1'));
    expect(patch.body).toMatchObject({ name: 'AWD Flagship', nameZh: '全轮驱动 旗舰版', seats: 7 });
    expect(calls.some((c) => c.url.endsWith('/fitment/catalog-image'))).toBe(false);
  });

  it('deleting asks first: No keeps it, Yes removes it', async () => {
    await openPanel();
    fireEvent.click(screen.getByLabelText('Delete RWD Standard'));
    fireEvent.click(screen.getByRole('button', { name: 'No' }));
    expect(writes()).toEqual([]);
    fireEvent.click(screen.getByLabelText('Delete RWD Standard'));
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    await waitFor(() => expect(screen.queryByText('RWD Standard')).not.toBeInTheDocument());
    expect(writes().map((c) => `${c.method} ${c.url}`)).toEqual(['DELETE /fitment/versions/ver_2']);
  });

  it('CRITICAL: closing and reopening the panel loads the list again (an import or another admin may have changed it)', async () => {
    await openPanel();
    expect(screen.queryByText('Brand New Version')).not.toBeInTheDocument();
    versions = [...versions, { ...V1, id: 'ver_3', name: 'Brand New Version', engine: 'Other engine' }];
    fireEvent.click(screen.getByRole('button', { name: 'Versions of 2024' }));        // close
    fireEvent.click(screen.getByRole('button', { name: 'Versions of 2024' }));        // open again
    expect(await screen.findByText('Brand New Version')).toBeInTheDocument();
    expect(calls.filter((c) => c.method === 'GET' && c.url.endsWith('/versions')).length).toBe(2);
  });

  it('a year with no versions says so and offers the form', async () => {
    mockFetch(); versions = [];
    render(<VersionsPanel generation={GEN} onSessionExpired={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Versions of 2024' }));
    expect(await screen.findByText('No versions yet.')).toBeInTheDocument();
    expect(addButton()).toBeInTheDocument();
    expect(within(screen.getByText('Add a version to 2024').parentElement).getAllByLabelText('Seats').length).toBe(1);
  });
});
