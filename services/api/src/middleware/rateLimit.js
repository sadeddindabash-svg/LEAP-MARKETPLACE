/**
 * Limits on repeated tries (no extra package): a script cannot guess passwords, codes, emails or promo codes thousands of times.
 * Counted per IP address (and per route) in the API's memory, so a restart clears them; with several API servers each counts its own.
 * Answer when over the limit: 429 { error, code: 'rate_limited' } with Retry-After (seconds).
 * Off when RATE_LIMITS=off in .env, and while the tests run (node --test / NODE_ENV=test).
 */
const MIN = 60 * 1000;
// [method, path pattern, tries, window, name]
const RULES = [
  ['POST', /^\/auth\/login(\/2fa)?\/?$/, 10, 15 * MIN, 'sign-in'],
  ['POST', /^\/auth\/signup\/?$/, 10, 60 * MIN, 'sign-up'],
  ['POST', /^\/auth\/(forgot-password|reset-password)\/?$/, 5, 15 * MIN, 'password reset'],
  ['POST', /^\/auth\/2fa\/(confirm|disable)\/?$/, 10, 15 * MIN, 'two-step code'],
  ['POST', /^\/user\/guest-claim\/?$/, 10, 60 * MIN, 'guest claim'],
  ['POST', /^\/quotations\/public\/[^/]+\/shares\/[^/]+\/?$/, 20, 60 * MIN, 'quotation share'],
  ['POST', /^\/proof\/[^/]+(\/attempt)?\/?$/, 20, 15 * MIN, 'delivery code'],
  ['POST', /^\/order\/?$/, 30, 60 * MIN, 'orders'],
  ['PATCH', /^\/cart\/[^/]+\/promo-code\/?$/, 20, 15 * MIN, 'promo code'],
  ['POST', /^\/(support|bug-reports)(\/.*)?$/, 20, 60 * MIN, 'messages'],
  ['POST', /^\/payment\//, 20, 15 * MIN, 'payment'],
];
// a guest looking up an order with its email (GET /order/:id?guestEmail=...)
const GUEST_LOOKUP = { tries: 30, window: 15 * MIN, name: 'order lookup' };

const hits = new Map();      // key -> [timestamps]
const off = () => process.env.RATE_LIMITS === 'off' || process.env.NODE_ENV === 'test' || Boolean(process.env.NODE_TEST_CONTEXT);

function tooMany(key, tries, windowMs, now) {
  const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (list.length >= tries) { hits.set(key, list); return Math.ceil((windowMs - (now - list[0])) / 1000); }
  list.push(now);
  hits.set(key, list);
  return 0;
}

function publicLimits(req, res, next) {
  if (off()) return next();
  const p = req.path;
  let rule = RULES.find(([m, re]) => req.method === m && re.test(p));
  let tries, windowMs, name;
  if (rule) [, , tries, windowMs, name] = rule;
  else if (req.method === 'GET' && /^\/order\/[^/]+\/?$/.test(p) && req.query && req.query.guestEmail) ({ tries, window: windowMs, name } = GUEST_LOOKUP);
  else return next();
  const wait = tooMany(`${name}|${req.ip}`, tries, windowMs, Date.now());
  if (!wait) return next();
  res.set('Retry-After', String(wait));
  return res.status(429).json({ error: 'Too many tries. Please wait a few minutes and try again.', errorAr: 'محاولات كثيرة. يرجى الانتظار بضع دقائق ثم المحاولة مرة أخرى.', code: 'rate_limited', retryAfterSeconds: wait });
}

// old counts are dropped every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [k, list] of hits) { const keep = list.filter((t) => now - t < 60 * MIN); if (keep.length) hits.set(k, keep); else hits.delete(k); }
}, 10 * MIN).unref();

module.exports = { publicLimits, RULES };
