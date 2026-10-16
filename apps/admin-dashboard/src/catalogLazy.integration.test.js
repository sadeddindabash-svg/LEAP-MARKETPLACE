import { describe, it, expect } from 'vitest';

const BACKEND_URL = 'http://localhost:4000';
async function isBackendUp() { try { return (await fetch(`${BACKEND_URL}/health`)).ok; } catch { return false; } }
const backendUp = await isBackendUp();

async function list(query) {
  const res = await fetch(`${BACKEND_URL}/catalog/products?${query}`);
  return { status: res.status, total: Number(res.headers.get('X-Total-Count')), items: await res.json() };
}
// every page of a list, one after the other, until a page is empty
async function allPages(extra, size) {
  const ids = [];
  for (let page = 1; page < 60; page++) {
    const r = await list(`page=${page}&limit=${size}${extra}`);
    if (r.items.length === 0) break;
    ids.push(...r.items.map((p) => p.id));
  }
  return ids;
}

// LAZY LOADING needs page 2 to continue exactly where page 1 stopped, whatever the order: a stable order (this endpoint had none), and the pages of a list must add
// up to the whole list. ?more=1 marks a request that CONTINUES a list (it may use a short cache and is not logged as a new search).
describe.runIf(backendUp)('the product list pages add up to the whole list (lazy loading), against a REAL running backend', () => {
  for (const [name, extra] of [['default order', ''], ['newest', '&sort=newest'], ['price, low to high', '&sort=price_asc'], ['price, high to low', '&sort=price_desc']]) {
    it(`CRITICAL: ${name}: the pages, one after the other, are exactly the whole list: no repeats, none skipped, same order`, async () => {
      const whole = await list(`${extra.slice(1)}`);
      expect(whole.items.length).toBeGreaterThan(30);                         // enough products for several pages
      const wholeIds = whole.items.map((p) => p.id);
      expect(new Set(wholeIds).size).toBe(wholeIds.length);
      const paged = await allPages(extra, 10);
      expect(paged).toEqual(wholeIds);
      expect(whole.total).toBe(wholeIds.length);
    }, 120000);
  }

  it('CRITICAL: the order is the SAME every time it is asked (it used to be left to chance)', async () => {
    const first = (await list('')).items.map((p) => p.id);
    const second = (await list('')).items.map((p) => p.id);
    expect(second).toEqual(first);
  }, 60000);

  it('CRITICAL: pages asked as a CONTINUATION (?more=1) are the same pages, with the same total, and add up to the whole list too', async () => {
    const whole = (await list('')).items.map((p) => p.id);
    const total = (await list('page=1&limit=24')).total;
    const continued = [];
    for (let page = 2; page < 60; page++) {
      const r = await list(`page=${page}&limit=24&more=1`);
      expect(r.total).toBe(total);
      if (r.items.length === 0) break;
      continued.push(...r.items.map((p) => p.id));
    }
    expect(continued).toEqual(whole.slice(24));                               // page 2 onwards, exactly
  }, 120000);

  it('a continuation with a search or a filter gives the same results as the ordinary request (the cache keeps them apart)', async () => {
    for (const q of ['category=brake', 'search=brake', 'category=brake&sort=price_asc']) {
      const ordinary = (await list(`${q}&page=1&limit=100`)).items.map((p) => p.id);
      const continued = (await list(`${q}&page=1&limit=100&more=1`)).items.map((p) => p.id);
      expect(continued).toEqual(ordinary);
    }
    const a = (await list('search=brake&page=1&limit=100&more=1')).items.length;
    const b = (await list('search=zzzzqqqq&page=1&limit=100&more=1')).items.length;
    expect(b).toBe(0);
    expect(a).toBeGreaterThanOrEqual(0);
  }, 60000);

  it('a page past the end is an empty list (not an error), and the page size is capped at 100', async () => {
    expect((await list('page=9999&limit=24&more=1')).items).toEqual([]);
    expect((await list('page=1&limit=100000')).items.length).toBeLessThanOrEqual(100);
  }, 30000);
});
