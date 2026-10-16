/**
 * A small in-memory request limiter: at most `max` hits per `windowMs` for each key (a visitor). Used by the lazy-loading door (app/api/products/route.ts) so one visitor
 * (or a bot, or a bug that loops) cannot ask for pages without end. `now` can be replaced so tests do not have to wait.
 */
export interface Verdict { allowed: boolean; retryAfterSeconds: number }

export function createRateLimiter({ windowMs, max, now = Date.now }: { windowMs: number; max: number; now?: () => number }) {
  const hits = new Map<string, number[]>();
  return {
    hit(key: string): Verdict {
      const t = now();
      const recent = (hits.get(key) ?? []).filter((at) => t - at < windowMs);
      if (recent.length >= max) {
        hits.set(key, recent);
        return { allowed: false, retryAfterSeconds: Math.max(Math.ceil((recent[0] + windowMs - t) / 1000), 1) };
      }
      recent.push(t);
      hits.set(key, recent);
      if (hits.size > 5000) for (const [k, list] of hits) if (list.every((at) => t - at >= windowMs)) hits.delete(k);      // forget visitors who went quiet
      return { allowed: true, retryAfterSeconds: 0 };
    },
    get size() { return hits.size; },
  };
}
