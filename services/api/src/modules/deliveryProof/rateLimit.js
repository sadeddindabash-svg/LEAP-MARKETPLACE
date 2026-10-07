/**
 * A small in-memory limiter: at most `max` hits per `key` in any `windowMs`. (A single backend process, so memory is enough; a restart simply
 * forgets the counts, which only makes it more lenient, never stricter.)
 */
function createRateLimiter({ windowMs, max, now = () => Date.now() }) {
  const hitsByKey = new Map();
  return {
    // Records one hit; says whether it is allowed, and if not how long until it would be.
    hit(key) {
      const t = now();
      const recent = (hitsByKey.get(key) || []).filter((time) => t - time < windowMs);
      if (recent.length >= max) {
        hitsByKey.set(key, recent);
        return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((recent[0] + windowMs - t) / 1000)) };
      }
      recent.push(t);
      hitsByKey.set(key, recent);
      // tidy up now and then so the map cannot grow forever
      if (hitsByKey.size > 5000) for (const [k, times] of hitsByKey) if (times.every((time) => t - time >= windowMs)) hitsByKey.delete(k);
      return { allowed: true, retryAfterSeconds: 0 };
    },
  };
}
module.exports = { createRateLimiter };
