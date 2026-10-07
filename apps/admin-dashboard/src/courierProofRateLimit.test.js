// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { createRateLimiter } = require('../../../services/api/src/modules/deliveryProof/rateLimit.js');

describe('the courier link\'s rate limiter', () => {
  it('CRITICAL: allows `max` hits in a window, refuses the next, and says how long to wait', () => {
    let now = 1_000_000;
    const limiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 3, now: () => now });
    expect(limiter.hit('a').allowed).toBe(true);
    now += 1000; expect(limiter.hit('a').allowed).toBe(true);
    now += 1000; expect(limiter.hit('a').allowed).toBe(true);
    now += 1000;
    const blocked = limiter.hit('a');
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(597); // the first hit leaves the window 10 minutes after it, i.e. 597 s from now
  });

  it('forgives once the window has passed: the oldest hits drop out one by one', () => {
    let now = 0;
    const limiter = createRateLimiter({ windowMs: 60_000, max: 2, now: () => now });
    limiter.hit('k'); now += 10_000; limiter.hit('k');
    expect(limiter.hit('k').allowed).toBe(false);
    now += 51_000; // the first hit (at 0) is now 61 s old: gone; the second (at 10 s) is still inside
    expect(limiter.hit('k').allowed).toBe(true);
    expect(limiter.hit('k').allowed).toBe(false);
  });

  it('keys are independent: one noisy link or address never blocks another', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
    expect(limiter.hit('link-a').allowed).toBe(true);
    expect(limiter.hit('link-a').allowed).toBe(false);
    expect(limiter.hit('link-b').allowed).toBe(true);
  });

  it('a blocked attempt does not extend the block (only allowed hits count)', () => {
    let now = 0;
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1, now: () => now });
    limiter.hit('x');
    for (let i = 0; i < 20; i += 1) { now += 1000; expect(limiter.hit('x').allowed).toBe(false); }
    now = 61_000; // 61 s after the one allowed hit
    expect(limiter.hit('x').allowed).toBe(true);
  });
});
