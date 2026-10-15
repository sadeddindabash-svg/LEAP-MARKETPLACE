import { describe, it, expect } from 'vitest';
import {
  addVehicleToGarage, decodeVin, fetchDisplayRates, fetchMyGarage, fetchPartsForCategory, fetchProductById, fetchProducts, fetchProductsPaginated, removeVehicleFromGarage, setDefaultVehicle,
} from './api';

// This stage's calls against a REAL running backend and database: the garage, VIN decoding, the parts of a category, the part filter, the display rates.
const BACKEND_URL = 'http://localhost:4000';
async function isBackendUp(): Promise<boolean> {
  try { return (await fetch(`${BACKEND_URL}/health`)).ok; } catch { return false; }
}
const backendUp = await isBackendUp();

let counter = 0;
async function newBuyer(): Promise<string> {
  const res = await fetch(`${BACKEND_URL}/auth/signup`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `stage1b-${Date.now()}-${++counter}@leap.dev`, password: 'stage1b_password_123', name: 'Stage 1b Buyer' }),
  });
  expect(res.status).toBe(201);
  return (await res.json()).token;
}
const GENERATION = 'gen_bmw_1_series_f20';        // seeded, 2015 to 2019

describe.runIf(backendUp)('stage 1b: the storefront\'s new calls against a REAL backend', () => {
  it('CRITICAL: the garage lifecycle: save, the first car becomes the default, change the default, remove, and saving twice is not a duplicate', async () => {
    const token = await newBuyer();
    expect(await fetchMyGarage(token)).toEqual([]);
    await addVehicleToGarage(token, GENERATION, 2017);
    let cars = await fetchMyGarage(token);
    expect(cars).toHaveLength(1);
    expect(cars[0]).toMatchObject({ generationId: GENERATION, year: 2017, isDefault: true });          // a first car is the default automatically
    expect(typeof cars[0].brand).toBe('string');
    expect(typeof cars[0].model).toBe('string');
    expect(cars[0]).toHaveProperty('generationPhotoUrl');
    expect(cars[0]).toHaveProperty('brandPhotoUrl');

    await addVehicleToGarage(token, GENERATION, 2017);                                                // the same car again
    expect(await fetchMyGarage(token)).toHaveLength(1);

    await addVehicleToGarage(token, GENERATION, 2018);
    cars = await fetchMyGarage(token);
    expect(cars).toHaveLength(2);
    expect(cars.filter((c) => c.isDefault)).toHaveLength(1);

    await setDefaultVehicle(token, GENERATION, 2018);
    cars = await fetchMyGarage(token);
    expect(cars.find((c) => c.isDefault)?.year).toBe(2018);
    expect(cars.filter((c) => c.isDefault)).toHaveLength(1);

    await removeVehicleFromGarage(token, GENERATION, 2017);
    cars = await fetchMyGarage(token);
    expect(cars.map((c) => c.year)).toEqual([2018]);
  }, 60000);

  it('CRITICAL: a year outside the car\'s real range is refused with the server\'s reason, and a stranger\'s token sees nothing', async () => {
    const token = await newBuyer();
    await expect(addVehicleToGarage(token, GENERATION, 1990)).rejects.toThrow(/outside this generation/);
    await expect(addVehicleToGarage(token, 'gen_that_does_not_exist', 2020)).rejects.toThrow(/not found/);
    await expect(fetchMyGarage('not-a-real-token')).rejects.toThrow();
  }, 30000);

  it('CRITICAL: one buyer never sees another buyer\'s cars', async () => {
    const a = await newBuyer();
    const b = await newBuyer();
    await addVehicleToGarage(a, GENERATION, 2016);
    expect(await fetchMyGarage(b)).toEqual([]);
    expect(await fetchMyGarage(a)).toHaveLength(1);
  }, 30000);

  it('decodeVin: an invalid VIN is refused with the server\'s message; a valid-looking one returns the documented shape', async () => {
    await expect(decodeVin('TOO-SHORT')).rejects.toThrow(/17-character VIN/);
    await expect(decodeVin('LGXC16DG2N00000O1')).rejects.toThrow(/17-character VIN/);                 // an O
    const decoded = await decodeVin('lgxc16dg2n0000001');                                              // lower case is accepted and capitalised
    expect(decoded.vin).toBe('LGXC16DG2N0000001');
    expect(typeof decoded.isValidCheckDigit).toBe('boolean');
    expect(['local', 'nhtsa', 'unrecognized']).toContain(decoded.source);
    expect(decoded.make === null || typeof decoded.make === 'string').toBe(true);
    expect(decoded.modelYear === null || typeof decoded.modelYear === 'number').toBe(true);
  }, 60000);

  it('fetchPartsForCategory returns the real parts of a category (the English name is what the product filter takes), and none for an unknown category', async () => {
    const parts = await fetchPartsForCategory('brake');
    expect(parts.length).toBeGreaterThan(0);
    expect(parts.find((p) => p.nameEn === 'Front Brake Disc')).toMatchObject({ categoryId: 'brake' });
    for (const p of parts) { expect(typeof p.id).toBe('string'); expect(typeof p.nameEn).toBe('string'); }
    expect(await fetchPartsForCategory('category_that_does_not_exist')).toEqual([]);
  });

  it('CRITICAL: the part filter returns only that part\'s products (and none for a part that does not exist)', async () => {
    const inPart = await fetchProducts({ category: 'brake', part: 'Front Brake Disc' });
    expect(inPart.length).toBeGreaterThan(0);
    expect(inPart.every((p) => p.part === 'Front Brake Disc' && p.category === 'brake')).toBe(true);
    expect(await fetchProducts({ category: 'brake', part: 'A Part That Does Not Exist' })).toEqual([]);
    const paged = await fetchProductsPaginated({ category: 'brake', part: 'Front Brake Disc', limit: 5 });
    expect(paged.items.every((p) => p.part === 'Front Brake Disc')).toBe(true);
    expect(paged.total).toBe(inPart.length);
  }, 30000);

  it('display rates: an object of positive numbers per currency (it can be empty before any rate is set)', async () => {
    const rates = await fetchDisplayRates();
    expect(typeof rates).toBe('object');
    for (const [code, rate] of Object.entries(rates)) { expect(code).toMatch(/^[A-Z]{3}$/); expect(rate).toBeGreaterThan(0); }
  });

  it('asking for Arabic returns the same products (only names and descriptions may differ), and a product carries what compare shows', async () => {
    const en = await fetchProductsPaginated({ limit: 6 });
    const ar = await fetchProductsPaginated({ limit: 6, lang: 'ar' });
    expect(ar.items.map((p) => p.id)).toEqual(en.items.map((p) => p.id));
    expect(ar.total).toBe(en.total);
    const detail = await fetchProductById(en.items[0].id, 'ar');
    expect(detail).not.toBeNull();
    expect(typeof detail?.isVerifiedSeller).toBe('boolean');
    expect(detail).toHaveProperty('shipsFromCountry');
  }, 30000);
});
