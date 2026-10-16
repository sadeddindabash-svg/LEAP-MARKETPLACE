/**
 * A short-lived cache for the buyer product LIST, used only for the requests that CONTINUE a list a buyer is already scrolling through (?more=1).
 *
 * Why: this endpoint builds the whole matching list (every product with its images, fitment, price, delivery estimate...) and only then cuts out the requested page,
 * so every page request used to repeat all of that work. With lazy loading a buyer asks for page after page; this makes the first of those requests do the work and the
 * next ones (from this buyer and from anyone else asking the same thing) just cut their page out of the result, for a minute.
 *  - the same key asked at the same moment shares ONE computation (a crowd does not start many);
 *  - a computation that fails is not remembered;
 *  - at most `max` lists are kept (the oldest goes first), so memory stays bounded;
 *  - results must be treated as READ ONLY by whoever gets them (the handler only slices).
 */
function createListCache({ ttlMs = 60 * 1000, max = 100, now = Date.now } = {}) {
  const entries = new Map(); // key -> { promise } while computing, { at, value } once ready

  function prune() {
    while (entries.size > max) {
      const oldest = entries.keys().next().value;
      entries.delete(oldest);
    }
  }

  async function get(key, compute) {
    const hit = entries.get(key);
    if (hit) {
      if (hit.promise) return hit.promise;
      if (now() - hit.at < ttlMs) return hit.value;
      entries.delete(key);
    }
    const promise = compute().then(
      (value) => { entries.set(key, { at: now(), value }); prune(); return value; },
      (err) => { entries.delete(key); throw err; }
    );
    entries.set(key, { promise });
    return promise;
  }

  return { get, clear: () => entries.clear(), get size() { return entries.size; } };
}

module.exports = { createListCache };
