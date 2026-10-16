import { describe, it, expect } from "vitest";
import { createRateLimiter } from "./rateLimit";

describe("the request limiter", () => {
  it("CRITICAL: allows `max` hits in the window, refuses the next, and says how long to wait", () => {
    let now = 1_000_000;
    const limiter = createRateLimiter({ windowMs: 60_000, max: 3, now: () => now });
    for (let i = 0; i < 3; i++) expect(limiter.hit("a").allowed).toBe(true);
    now += 10_000;
    const refused = limiter.hit("a");
    expect(refused.allowed).toBe(false);
    expect(refused.retryAfterSeconds).toBe(50);                                // the first hit leaves the window 50 seconds from now
  });
  it("lets the visitor in again once the window has moved on", () => {
    let now = 0;
    const limiter = createRateLimiter({ windowMs: 60_000, max: 2, now: () => now });
    limiter.hit("a"); limiter.hit("a");
    expect(limiter.hit("a").allowed).toBe(false);
    now += 60_001;
    expect(limiter.hit("a").allowed).toBe(true);
  });
  it("each visitor has their own allowance", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
    expect(limiter.hit("a").allowed).toBe(true);
    expect(limiter.hit("a").allowed).toBe(false);
    expect(limiter.hit("b").allowed).toBe(true);
  });
  it("forgets visitors who went quiet (memory does not grow for ever)", () => {
    let now = 0;
    const limiter = createRateLimiter({ windowMs: 1000, max: 5, now: () => now });
    for (let i = 0; i < 5001; i++) limiter.hit(`v${i}`);
    expect(limiter.size).toBe(5001);
    now += 5000;
    limiter.hit("someone-new");
    expect(limiter.size).toBeLessThan(10);
  });
});
