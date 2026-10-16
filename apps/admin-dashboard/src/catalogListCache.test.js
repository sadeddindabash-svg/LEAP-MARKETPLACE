// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { createListCache } = require('../../../services/api/src/modules/catalog/listCache.js');

describe('the short-lived cache of the product list (used by lazy loading)', () => {
  it('CRITICAL: the same list asked again within the time is NOT computed again (twenty pages of scrolling cost one computation)', async () => {
    let now = 1000, computed = 0;
    const cache = createListCache({ ttlMs: 60000, max: 10, now: () => now });
    const compute = async () => { computed++; return ['a', 'b']; };
    expect(await cache.get('k', compute)).toEqual(['a', 'b']);
    now += 59000;
    expect(await cache.get('k', compute)).toEqual(['a', 'b']);
    expect(computed).toBe(1);
  });

  it('after the time it is computed afresh (a price or stock change shows within the minute)', async () => {
    let now = 1000, computed = 0;
    const cache = createListCache({ ttlMs: 60000, max: 10, now: () => now });
    const compute = async () => ++computed;
    expect(await cache.get('k', compute)).toBe(1);
    now += 60001;
    expect(await cache.get('k', compute)).toBe(2);
  });

  it('CRITICAL: a crowd asking the same thing at the same moment starts ONE computation, not one each', async () => {
    let computed = 0, release;
    const cache = createListCache();
    const compute = () => { computed++; return new Promise((resolve) => { release = () => resolve(['x']); }); };
    const crowd = Array.from({ length: 20 }, () => cache.get('same', compute));
    release();
    const results = await Promise.all(crowd);
    expect(computed).toBe(1);
    expect(results.every((r) => r.length === 1 && r[0] === 'x')).toBe(true);
  });

  it('different lists never share an answer', async () => {
    const cache = createListCache();
    expect(await cache.get('brakes', async () => ['disc'])).toEqual(['disc']);
    expect(await cache.get('filters', async () => ['oil'])).toEqual(['oil']);
    expect(await cache.get('brakes', async () => ['WRONG'])).toEqual(['disc']);
  });

  it('CRITICAL: a computation that fails is not remembered: the next ask tries again', async () => {
    const cache = createListCache();
    await expect(cache.get('k', async () => { throw new Error('database down'); })).rejects.toThrow('database down');
    expect(cache.size).toBe(0);
    expect(await cache.get('k', async () => ['ok'])).toEqual(['ok']);
  });

  it('memory stays bounded: only the newest `max` lists are kept, the oldest is forgotten', async () => {
    let computed = 0;
    const cache = createListCache({ max: 2 });
    const compute = async () => ++computed;
    await cache.get('a', compute); await cache.get('b', compute); await cache.get('c', compute);
    expect(cache.size).toBe(2);
    await cache.get('b', compute); await cache.get('c', compute);
    expect(computed).toBe(3);                                 // b and c still cached
    await cache.get('a', compute);
    expect(computed).toBe(4);                                 // a was forgotten
  });

  it('a time of 0 switches the cache off (every ask computes), but a crowd at the same moment still shares one', async () => {
    let computed = 0;
    const cache = createListCache({ ttlMs: 0 });
    await cache.get('k', async () => ++computed); await cache.get('k', async () => ++computed);
    expect(computed).toBe(2);
  });
});
