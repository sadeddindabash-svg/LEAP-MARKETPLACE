// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { login } from './auth';

const BACKEND_URL = 'http://localhost:4000';
async function isBackendUp() {
  try { return (await fetch(`${BACKEND_URL}/health`)).ok; } catch { return false; }
}
const backendUp = await isBackendUp();
const json = { 'Content-Type': 'application/json' };
const ADDRESS = { recipientName: 'John Smith', phone: '555-0100', country: 'USA', city: 'Springfield', streetAddress: '123 Test St' };

// "Orders per day" must show EVERY one of the last 7 days: before, only days that had orders came back, so two busy days became a straight line between two
// points and the quiet days were missing.
function expectSevenConsecutiveDays(days) {
  expect(days).toHaveLength(7);
  for (const d of days) { expect(Number.isInteger(d.count)).toBe(true); expect(d.count).toBeGreaterThanOrEqual(0); expect(Number.isNaN(new Date(d.day).getTime())).toBe(false); }
  for (let i = 1; i < days.length; i += 1) {
    const hours = (new Date(days[i].day) - new Date(days[i - 1].day)) / 3600000;
    expect(hours).toBeGreaterThanOrEqual(23);   // one day apart (23 or 25 hours when the clocks change)
    expect(hours).toBeLessThanOrEqual(25);
  }
  const hoursSinceLast = (Date.now() - new Date(days[6].day)) / 3600000;
  expect(hoursSinceLast).toBeGreaterThanOrEqual(0);
  expect(hoursSinceLast).toBeLessThan(25);       // the last one is TODAY
}

describe.runIf(backendUp)('"Orders per day" shows all of the last 7 days (real backend)', () => {
  it('CRITICAL: the admin overview returns exactly 7 consecutive days ending today, zeros included, and a new order shows up in today', async () => {
    const admin = await login('admin@leap.dev', 'admin_dev_password_123');
    const read = async () => (await fetch(`${BACKEND_URL}/overview`, { headers: { Authorization: `Bearer ${admin.token}` } }).then((r) => r.json())).ordersByDay;
    const before = await read();
    expectSevenConsecutiveDays(before);
    const order = await fetch(`${BACKEND_URL}/order`, { method: 'POST', headers: json, body: JSON.stringify({ items: [{ productId: 'p1', quantity: 1 }], guestEmail: `days.${Date.now()}@example.com`, address: ADDRESS }) }).then((r) => r.json());
    expect(order.id).toBeTruthy();
    const after = await read();
    expectSevenConsecutiveDays(after);
    expect(after[6].count).toBe(before[6].count + 1);                 // today's bar grew by exactly the one order
    expect(after.slice(0, 6).map((d) => d.count)).toEqual(before.slice(0, 6).map((d) => d.count)); // and no other day changed
  }, 60000);

  it('the supplier dashboard does the same for that supplier', async () => {
    const supplier = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const overview = await fetch(`${BACKEND_URL}/supplier/me/overview`, { headers: { Authorization: `Bearer ${supplier.token}` } }).then((r) => r.json());
    expectSevenConsecutiveDays(overview.ordersByDay);
  }, 60000);
});
