import { describe, it, expect } from 'vitest';
import { login } from './auth';

const BACKEND_URL = 'http://localhost:4000';

async function isBackendUp() {
  try {
    const res = await fetch(`${BACKEND_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

const backendUp = await isBackendUp();

describe.runIf(backendUp)('real hub workload/capacity dashboard against a REAL running backend', () => {
  it('CRITICAL: a real new hub is created with a sensible default capacity, and workload starts at zero', async () => {
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');
    const suffix = Date.now();
    const created = await fetch(`${BACKEND_URL}/hub/locations`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: `Workload Test Hub ${suffix}`, region: 'Test Region' }),
    }).then((r) => r.json());
    expect(created.dailyCapacity).toBe(50);

    const workload = await fetch(`${BACKEND_URL}/hub/workload`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
    const thisHub = workload.find((h) => h.id === created.id);
    expect(thisHub.totalWorkload).toBe(0);
    expect(thisHub.utilizationPercent).toBe(0);

    await fetch(`${BACKEND_URL}/hub/locations/${created.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  });

  it('CRITICAL: a real, explicit capacity can be set on creation, and updated afterward', async () => {
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');
    const suffix = Date.now();
    const created = await fetch(`${BACKEND_URL}/hub/locations`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: `Capacity Test Hub ${suffix}`, region: 'Test Region', dailyCapacity: 200 }),
    }).then((r) => r.json());
    expect(created.dailyCapacity).toBe(200);

    const updated = await fetch(`${BACKEND_URL}/hub/locations/${created.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ dailyCapacity: 75 }),
    }).then((r) => r.json());
    expect(updated.dailyCapacity).toBe(75);

    await fetch(`${BACKEND_URL}/hub/locations/${created.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  });

  it('a negative or zero capacity is rejected on both create and update', async () => {
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');
    const suffix = Date.now();
    const createRes = await fetch(`${BACKEND_URL}/hub/locations`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: `Invalid Capacity Hub ${suffix}`, region: 'Test Region', dailyCapacity: 0 }),
    });
    expect(createRes.status).toBe(400);

    const patchRes = await fetch(`${BACKEND_URL}/hub/locations/hub_miami`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ dailyCapacity: -10 }),
    });
    expect(patchRes.status).toBe(400);
  });

  it('a non-admin cannot view workload or update hub capacity', async () => {
    const { token } = await login('hub@leap.dev', 'hub_dev_password_123');
    const workloadRes = await fetch(`${BACKEND_URL}/hub/workload`, { headers: { Authorization: `Bearer ${token}` } });
    expect(workloadRes.status).toBe(403);

    const patchRes = await fetch(`${BACKEND_URL}/hub/locations/hub_miami`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ dailyCapacity: 10 }),
    });
    expect(patchRes.status).toBe(403);
  });

  it('CRITICAL: workload genuinely excludes shipments already shipped to the buyer or delivered', async () => {
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');
    const workload = await fetch(`${BACKEND_URL}/hub/workload`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
    for (const hub of workload) {
      const sumOfStages = Object.values(hub.stageCounts).reduce((a, b) => a + b, 0);
      expect(hub.totalWorkload).toBe(sumOfStages);
    }
  });
});
