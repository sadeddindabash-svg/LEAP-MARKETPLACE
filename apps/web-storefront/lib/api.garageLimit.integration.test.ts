import { describe, it, expect, afterEach } from 'vitest';
import { addVehicleToGarage, fetchMyGarage } from './api';
import { MAX_GARAGE_VEHICLES } from './garage';
import { t } from './i18n';
import { setErrorLanguage } from './serverMessages';

// The 5-car limit against a REAL running backend: the website's number and message are the SERVER's, and the Arabic is what the buyer reads on the Arabic site.
const BACKEND_URL = 'http://localhost:4000';
async function isBackendUp(): Promise<boolean> { try { return (await fetch(`${BACKEND_URL}/health`)).ok; } catch { return false; } }
const backendUp = await isBackendUp();
afterEach(() => setErrorLanguage('en'));

let counter = 0;
async function newBuyerToken() {
  const res = await fetch(`${BACKEND_URL}/auth/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `garage-limit-${Date.now()}-${++counter}@leap.dev`, password: 'garage_limit_pw_123' }) });
  return (await res.json()).token as string;
}
const YEARS = [2015, 2016, 2017, 2018, 2019];

describe.runIf(backendUp)('garage limit: the website agrees with the REAL server', () => {
  it('CRITICAL: the website\'s limit is the number the server enforces: that many cars save, the next is refused', async () => {
    const token = await newBuyerToken();
    expect(MAX_GARAGE_VEHICLES).toBeLessThanOrEqual(YEARS.length);                                          // this test has enough real years to fill the garage
    for (const year of YEARS.slice(0, MAX_GARAGE_VEHICLES)) await addVehicleToGarage(token, 'gen_bmw_1_series_f20', year);
    expect(await fetchMyGarage(token)).toHaveLength(MAX_GARAGE_VEHICLES);
    await expect(addVehicleToGarage(token, 'gen_toyota_camry_xv70', 2019)).rejects.toThrow();
    expect(await fetchMyGarage(token)).toHaveLength(MAX_GARAGE_VEHICLES);                                   // nothing slipped in
  }, 60000);

  it('CRITICAL: the server\'s refusal reads exactly as the website\'s own text, in English, and in Arabic on the Arabic site', async () => {
    const token = await newBuyerToken();
    for (const year of YEARS.slice(0, MAX_GARAGE_VEHICLES)) await addVehicleToGarage(token, 'gen_bmw_1_series_f20', year);
    const english = await addVehicleToGarage(token, 'gen_toyota_camry_xv70', 2019).catch((e) => (e as Error).message);
    expect(english).toBe(t('en', 'garage_limit_note'));
    setErrorLanguage('ar');
    const arabic = await addVehicleToGarage(token, 'gen_toyota_camry_xv70', 2019).catch((e) => (e as Error).message);
    expect(arabic).toBe(t('ar', 'garage_limit_note'));
    expect(arabic).toMatch(/[\u0600-\u06FF]/);
    expect(english).toContain(String(MAX_GARAGE_VEHICLES));                                                  // the words say the number the code uses
  }, 60000);
});
