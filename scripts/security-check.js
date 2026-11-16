#!/usr/bin/env node
/**
 * LEAP security check: reads your code and settings (it changes nothing, sends nothing anywhere) and writes security-report.md
 * in the project folder. Run:   node scripts\security-check.js
 *
 * What it checks:
 *   1. Every API route: who can call it. public (anyone) / signed-in / role (admin, supplier, hub staff) / optional sign-in.
 *      Flags: changes (POST/PUT/PATCH/DELETE) anyone can make, /admin routes without the admin role, and routes with an :id
 *      that never look at who is asking (another buyer's order by changing the number).
 *   2. The API's .env: JWT_SECRET strong, test switches off, encryption key set, database password not a default.
 *      Secret values are never printed, only their length.
 *   3. Server settings in the code: CORS, trust proxy, security headers, limits on repeated tries, the /health page.
 *   4. Secrets written in the code (keys, private keys, passwords), and .env kept out of git.
 *   5. Secrets put where the browser can read them (NEXT_PUBLIC_ / VITE_ variables).
 *   6. The packages' known-vulnerability count is not checked here: run `npm audit` in each app folder.
 *
 * It reads the code as text, so it can miss a check written inside a handler; every flag says "check by hand", not "broken".
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const API = path.join(ROOT, 'services', 'api');
const SRC = path.join(API, 'src');
const read = (f) => { try { return fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n'); } catch { return null; } };
const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/');
const findings = [];      // { level: 'HIGH' | 'MEDIUM' | 'LOW' | 'OK', area, text }
const add = (level, area, text) => findings.push({ level, area, text });

// ------------------------------------------------------------------ 1. routes
const ROLE_GUARDS = /\b(requireRole|requirePageAccess|requirePageAccessIfAdmin|requireAdmin|requireLeapSupplier|requireSupplier|requireHubStaff|requireOwner|requireVerifiedPurchase|requireNewUser)\b/;
const AUTH_GUARDS = /\brequireAuth\b/;
const OPTIONAL_GUARDS = /\boptionalAuth\b/;
const OFF_GUARDS = /\brequire(PaymentsOnline|FeatureOn)\b/;      // switched off unless a setting turns it on
const SIGNED = /\b(verifyWebhook|verifySignature|webhookSignature|signature|hmac|timingSafeEqual)\b/i;

function guardOf(text) {
  if (OFF_GUARDS.test(text)) return 'off';
  if (ROLE_GUARDS.test(text)) return 'role';
  if (AUTH_GUARDS.test(text)) return 'auth';
  if (OPTIONAL_GUARDS.test(text)) return 'optional';
  return 'public';
}
const RANK = { public: 0, optional: 1, auth: 2, role: 3, off: 4 };
const stronger = (a, b) => (RANK[a] >= RANK[b] ? a : b);

// the text of a call starting at `start` (index of the opening parenthesis), up to its matching closing parenthesis
function callText(src, start) {
  let depth = 0, i = start, q = null;
  for (; i < src.length; i++) {
    const c = src[i];
    if (q) { if (c === '\\') { i++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '/' && src[i + 1] === '/') { const e = src.indexOf('\n', i); i = e < 0 ? src.length : e; continue; }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? src.length : e + 1; continue; }
    if (c === '(') depth++;
    else if (c === ')') { depth--; if (depth === 0) return src.slice(start + 1, i); }
  }
  return src.slice(start + 1);
}

function resolveModule(fromFile, spec) {
  const base = path.resolve(path.dirname(fromFile), spec);
  for (const f of [base, base + '.js', path.join(base, 'index.js'), path.join(base, 'routes.js')]) if (fs.existsSync(f) && fs.statSync(f).isFile()) return f;
  return null;
}

/** The routes of one file: { routerVar: [{ method, path, guard, idCheck }] } plus the routers mounted inside it. */
const fileCache = new Map();
function parseRouterFile(file) {
  if (fileCache.has(file)) return fileCache.get(file);
  const src = read(file) || '';
  const out = { routers: {}, defaultRouter: null, mounts: [] };
  fileCache.set(file, out);
  const routerVars = [...src.matchAll(/(?:const|let|var)\s+(\w+)\s*=\s*(?:express\.)?Router\(/g)].map((m) => m[1]);
  // guard arrays: const admin = [requireAuth, requireRole('admin'), ...]
  const arrays = {};
  for (const m of src.matchAll(/(?:const|let)\s+(\w+)\s*=\s*\[([^\]]*)\]/g)) arrays[m[1]] = m[2];
  const expand = (text) => text.replace(/\.\.\.(\w+)/g, (all, name) => arrays[name] || all).replace(/\b(\w+)\b/g, (all, name) => (arrays[name] && /require|optionalAuth/.test(arrays[name]) ? arrays[name] : all));
  for (const r of routerVars) out.routers[r] = { base: 'public', routes: [] };
  // router.use(guards...) applies to the routes after it; router.use('/sub', require('./x')) mounts another file
  const events = [];
  for (const r of routerVars) {
    const re = new RegExp(`\\b${r}\\.(use|get|post|put|patch|delete|all)\\s*\\(`, 'g');
    let m;
    while ((m = re.exec(src))) events.push({ r, kind: m[1], at: m.index, open: m.index + m[0].length - 1 });
  }
  events.sort((a, b) => a.at - b.at);
  for (const e of events) {
    const args = callText(src, e.open);
    const R = out.routers[e.r];
    const pathM = args.match(/^\s*(['"`])(.*?)\1/);
    if (e.kind === 'use') {
      const req = args.match(/require\(\s*['"]([^'"]+)['"]\s*\)/);
      if (pathM && req) { const f = resolveModule(file, req[1]); if (f) out.mounts.push({ r: e.r, path: pathM[2], file: f, guard: guardOf(expand(args)) }); continue; }
      if (!pathM) R.base = stronger(R.base, guardOf(expand(args)));
      continue;
    }
    if (!pathM) continue;
    // the guards are the arguments before the handler: everything up to the first "(req" / "async (" / "function"
    const rest = args.slice(pathM[0].length);
    const h = rest.search(/(async\s*)?\(\s*req\b|async\s+function|function\s*\(/);
    const guardsText = expand(h >= 0 ? rest.slice(0, h) : rest);
    const body = h >= 0 ? rest.slice(h) : '';
    const guard = stronger(R.base, guardOf(guardsText));
    const hasId = /:\w+/.test(pathM[2]);
    // does the handler look at who is asking? (req.user / owner / buyer_id = $ / supplier_id = $ ...)
    const looksAtUser = /req\.user\b|buyer_id\s*=\s*\$|supplier_id\s*=\s*\$|user_id\s*=\s*\$|owner|guestEmail|guest_email|token/i.test(body);
    const line = src.slice(0, e.at).split('\n').length;
    R.routes.push({ method: e.kind.toUpperCase(), path: pathM[2], guard, hasId, looksAtUser, signed: SIGNED.test(body), file, line });
  }
  const exp = src.match(/module\.exports\s*=\s*([^;\n]+)/);
  if (exp) { const v = exp[1].match(/\b(\w+)\)?\s*$/) || exp[1].match(/\b(\w+)\b/); const name = routerVars.find((r) => new RegExp(`\\b${r}\\b`).test(exp[1])); out.defaultRouter = name || (v && v[1]); }
  if (!out.defaultRouter || !out.routers[out.defaultRouter]) out.defaultRouter = routerVars[0] || null;
  return out;
}

const allRoutes = [];
function collect(file, routerVar, prefix, inherited) {
  const parsed = parseRouterFile(file);
  const R = parsed.routers[routerVar];
  if (!R) return;
  for (const rt of R.routes) allRoutes.push({ ...rt, full: (prefix + (rt.path === '/' ? '' : rt.path)) || '/', guard: stronger(inherited, rt.guard) });
  for (const m of parsed.mounts.filter((x) => x.r === routerVar)) {
    const sub = parseRouterFile(m.file);
    if (sub.defaultRouter) collect(m.file, sub.defaultRouter, prefix + m.path, stronger(stronger(inherited, R.base), m.guard));
  }
}

const indexFile = path.join(SRC, 'index.js');
const indexSrc = read(indexFile);
if (!indexSrc) {
  add('HIGH', 'Routes', `Could not read ${rel(indexFile)}: run this from the project folder (D:\\LEAP-MARKETPLACE).`);
} else {
  // const fooRoutes = require('./modules/foo/routes');   const { router: x } = require(...);   const obj = require(...)
  const vars = {};
  for (const m of indexSrc.matchAll(/const\s+(\w+)\s*=\s*require\(\s*['"]([^'"]+)['"]\s*\)/g)) vars[m[1]] = { file: resolveModule(indexFile, m[2]) };
  for (const m of indexSrc.matchAll(/const\s*\{([^}]+)\}\s*=\s*require\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    const f = resolveModule(indexFile, m[2]);
    for (const part of m[1].split(',')) { const [a, b] = part.split(':').map((x) => x.trim()); if (a) vars[b || a] = { file: f, prop: a }; }
  }
  for (const m of indexSrc.matchAll(/app\.use\(\s*(['"`])([^'"`]+)\1\s*,/g)) {
    const args = callText(indexSrc, indexSrc.indexOf('(', m.index));
    const rest = args.slice(args.indexOf(',') + 1);
    let file = null, prop = null;
    const req = rest.match(/require\(\s*['"]([^'"]+)['"]\s*\)(?:\.(\w+))?/);
    if (req) { file = resolveModule(indexFile, req[1]); prop = req[2] || null; }
    else {
      const ref = rest.match(/(\w+)(?:\.(\w+))?\s*\)?\s*$/m) || rest.match(/(\w+)(?:\.(\w+))?/);
      const name = (rest.match(/([A-Za-z_]\w*)(?:\.(\w+))?/) || [])[1];
      const propM = rest.match(/[A-Za-z_]\w*\.(\w+)/);
      const v = vars[name];
      if (v && v.file) { file = v.file; prop = (propM && propM[1]) || v.prop || null; }
      if (!file && /express\.static/.test(rest)) { add('LOW', 'Routes', `${m[2]} serves files from disk to anyone (uploads): make sure only images go there and no folder listing.`); continue; }
      void ref;
    }
    if (!file) continue;
    const parsed = parseRouterFile(file);
    const rv = prop && parsed.routers[prop] ? prop : parsed.defaultRouter;
    collect(file, rv, m[2], guardOf(rest.replace(/require\([^)]*\)/g, '')));
  }
}

// ------------------------------------------------------------------ route findings
const changes = (r) => ['POST', 'PUT', 'PATCH', 'DELETE', 'ALL'].includes(r.method);
const publicChanges = allRoutes.filter((r) => r.guard === 'public' && changes(r));
const adminNoRole = allRoutes.filter((r) => /^\/admin|\/admin\b/.test(r.full) && r.guard !== 'role');
const idNoUser = allRoutes.filter((r) => r.hasId && (r.guard === 'auth' || r.guard === 'optional') && !r.looksAtUser);
const publicGets = allRoutes.filter((r) => r.guard === 'public' && !changes(r));
const KNOWN_PUBLIC_CHANGES = /^\/auth\/(login|register|signup|refresh|forgot|reset|verify|2fa|two-factor|google|apple|otp)|^\/webhooks|^\/payment\/(webhook|callback|return)|^\/reset-password|^\/proof|^\/cart\b|^\/order$|^\/support|^\/bug-reports|^\/notifications\/push|^\/catalog\/.*\/(view|views|click)|^\/recently-viewed|^\/quotations\/?$|^\/contact/;
// the API's own limits on repeated tries (services/api/src/middleware/rateLimit.js), if there
let LIMIT_RULES = [];
try { const f = path.join(SRC, 'middleware', 'rateLimit.js'); if (fs.existsSync(f) && /rateLimit/.test(indexSrc || '')) LIMIT_RULES = require(f).RULES || []; } catch { LIMIT_RULES = []; }
const limitOf = (r) => LIMIT_RULES.find(([m, re]) => m === r.method && re.test(r.full.replace(/:\w+/g, 'x')));
for (const r of publicChanges) {
  const lim = limitOf(r);
  if (lim) { add('LOW', 'Routes', `${r.method} ${r.full} can be called by anyone, no sign-in; limited to ${lim[2]} tries per ${Math.round(lim[3] / 60000)} min per IP${r.signed ? '; it checks a signature' : ''} (${rel(r.file)}:${r.line})`); continue; }
  const expected = KNOWN_PUBLIC_CHANGES.test(r.full);
  add(expected ? 'LOW' : 'HIGH', 'Routes', `${r.method} ${r.full} can be called by anyone, no sign-in${expected ? ' (expected for this kind of route, but check it limits repeated tries)' : ''}${r.signed ? '; it checks a signature' : ''} (${rel(r.file)}:${r.line})`);
}
for (const r of adminNoRole) add('HIGH', 'Routes', `${r.method} ${r.full} is an admin route without the admin role check (${r.guard}) (${rel(r.file)}:${r.line})`);
for (const r of idNoUser) add('MEDIUM', 'Routes', `${r.method} ${r.full} takes an id but the handler never looks at who is asking: can one buyer open another's by changing the id? (${rel(r.file)}:${r.line})`);

// ------------------------------------------------------------------ 2. .env
function parseEnv(file) {
  const t = read(file); if (t === null) return null;
  const o = {};
  for (const line of t.split('\n')) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) o[m[1]] = m[2].replace(/^['"]|['"]$/g, ''); }
  return o;
}
const env = parseEnv(path.join(API, '.env'));
if (!env) add('MEDIUM', 'Settings', 'services/api/.env not found: the checks of the real values were skipped (run this on the server too).');
else {
  const prod = /prod/i.test(env.NODE_ENV || '');
  const jwt = env.JWT_SECRET || '';
  if (!jwt) add(prod ? 'HIGH' : 'MEDIUM', 'Settings', 'JWT_SECRET is not set: the API uses its built-in development secret, so anyone could make a login for any account. Set a long random one.');
  else if (jwt.length < 32 || /secret|change|dev|test|password|leap|1234/i.test(jwt)) add('HIGH', 'Settings', `JWT_SECRET looks weak (${jwt.length} characters${/secret|change|dev|test|password|leap|1234/i.test(jwt) ? ', contains a common word' : ''}). Use 64+ random characters: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`);
  else add('OK', 'Settings', `JWT_SECRET is set and long (${jwt.length} characters).`);
  if (!env.CREDENTIALS_ENCRYPTION_KEY) add(prod ? 'HIGH' : 'MEDIUM', 'Settings', 'CREDENTIALS_ENCRYPTION_KEY is not set: payment provider keys saved in the admin are encrypted with the development key.');
  for (const k of Object.keys(env).filter((x) => /^ALLOW_TEST/.test(x))) {
    if (/^(1|true|yes|on)$/i.test(env[k])) add(prod ? 'HIGH' : 'MEDIUM', 'Settings', `${k} is ON${prod ? ' on a production server' : ''}: test shortcuts must never be on the real server.`);
  }
  if (!prod) add('LOW', 'Settings', `NODE_ENV is "${env.NODE_ENV || 'not set'}": on the real server it must be "production" (the API then refuses weak secrets).`);
  const db = env.DATABASE_URL || '';
  const pw = (db.match(/^\w+:\/\/[^:]+:([^@]*)@/) || [])[1];
  if (pw !== undefined && (pw.length < 12 || /^(postgres|password|admin|root|1234|leap)/i.test(pw))) add('MEDIUM', 'Settings', `The database password in DATABASE_URL is weak (${pw.length} characters). Fine on your PC; on the server use a long random one.`);
  if (/localhost|127\.0\.0\.1/.test(db)) add('OK', 'Settings', 'The database is on the same machine (not open to the internet from this setting).');
  if (/sk_live_/.test(env.STRIPE_SECRET_KEY || '')) add('LOW', 'Settings', 'A LIVE Stripe key is in this .env: make sure this file is only on the server and never shared or committed.');
}

// ------------------------------------------------------------------ 3. server settings in the code
if (indexSrc) {
  const corsCall = indexSrc.match(/app\.use\(\s*cors\(([^)]*)\)\s*\)/);
  if (/CORS_ORIGINS/.test(indexSrc)) {
    if (env && (env.CORS_ORIGINS || '').trim()) add('OK', 'Server', `CORS: only the websites in CORS_ORIGINS (${env.CORS_ORIGINS.split(',').filter(Boolean).length}) may call the API.`);
    else add('LOW', 'Server', 'CORS_ORIGINS is empty in .env, so any website may call the API: fine on your PC; on the real server list your own websites.');
  } else if (corsCall && !/origin\s*:/.test(corsCall[1])) add('MEDIUM', 'Server', 'CORS accepts calls from ANY website (cors() without "origin"). On the real server allow only your own domains (storefront, admin, portals).');
  else if (corsCall) add('OK', 'Server', 'CORS has an origin list.');
  if (/app\.set\(\s*['"]trust proxy['"]\s*,\s*true\s*\)/.test(indexSrc)) add('MEDIUM', 'Server', "'trust proxy' is true: right behind a real proxy/load balancer; without one anyone can fake their IP (weakens country detection and any limit per IP). Set it to the number of proxies (e.g. 1).");
  const pkg = read(path.join(API, 'package.json')) || '';
  if (/TRUST_PROXY/.test(indexSrc)) add(env && env.TRUST_PROXY ? 'OK' : 'OK', 'Server', `'trust proxy' comes from TRUST_PROXY (${env && env.TRUST_PROXY ? env.TRUST_PROXY : 'off'}): on the real server set it to the number of proxies in front of the API.`);
  if (/X-Content-Type-Options/.test(indexSrc)) add('OK', 'Server', 'Security headers are set on every API answer.');
  else if (!/"helmet"/.test(pkg) && !/helmet\(/.test(indexSrc)) add('MEDIUM', 'Server', 'No security headers (helmet is not used): add helmet to the API, and the same headers on the websites (frame, content type, referrer).');
  if (/rateLimit/.test(indexSrc)) add(env && env.RATE_LIMITS === 'off' ? 'HIGH' : 'OK', 'Server', env && env.RATE_LIMITS === 'off' ? 'RATE_LIMITS=off: the limits on repeated tries are switched off.' : 'Limits on repeated tries are on (sign-in, codes, password reset, guest lookup, promo codes, orders).');
  if (/PAYMENTS_ONLINE/.test(read(path.join(SRC, 'modules', 'payment', 'routes.js')) || '')) add('OK', 'Server', `Online payment routes are ${env && env.PAYMENTS_ONLINE === 'on' ? 'ON (PAYMENTS_ONLINE=on): make sure the amount comes from the order' : 'off until PAYMENTS_ONLINE=on'}.`);
  if (!/rate-?limit|rateLimit|slowDown/i.test(pkg + indexSrc)) {
    const any = allRoutes.some((r) => /limit|attempt|throttle/i.test(read(r.file) || ''));
    add(any ? 'LOW' : 'HIGH', 'Server', `No general limit on repeated requests (no express-rate-limit).${any ? ' Some modules count attempts themselves;' : ''} Sign-in, password reset, guest order lookup and promo codes must limit tries, or a script can guess thousands of times.`);
  }
  if (/app\.get\(\s*['"]\/health['"]/.test(indexSrc) && /env:\s*env\.nodeEnv|pendingMigrations/.test(indexSrc) && !/nodeEnv === 'production' \?/.test(indexSrc)) add('LOW', 'Server', '/health is public and shows the environment and pending migrations: keep it short on the real server (status only).');
  if (/express\.json\(\s*\{(?![^}]*limit)/.test(indexSrc) || /express\.json\(\s*\)/.test(indexSrc)) add('LOW', 'Server', 'express.json() has no size limit set (default 100 kb, fine); keep upload routes limited by size too.');
}

// ------------------------------------------------------------------ 4. secrets in the code, .env out of git
const SKIP = /(^|[\\/])(node_modules|\.git|\.next|build|dist|\.dart_tool|ios[\\/]Pods|android[\\/]\.gradle|coverage|backups|uploads)([\\/]|$)/;
const TEXT = /\.(js|jsx|ts|tsx|mjs|cjs|json|dart|yaml|yml|env|ps1|sh|sql|md|txt|xml|plist|gradle|properties)$/i;
const PATTERNS = [
  [/AKIA[0-9A-Z]{16}/, 'an AWS access key'],
  [/-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/, 'a private key'],
  [/sk_live_[0-9a-zA-Z]{10,}/, 'a LIVE Stripe secret key'],
  [/rk_live_[0-9a-zA-Z]{10,}/, 'a LIVE Stripe restricted key'],
  [/AIza[0-9A-Za-z_-]{35}/, 'a Google API key (fine in apps if restricted to your app; check it is restricted)'],
  [/"private_key"\s*:\s*"-----BEGIN/, 'a Firebase/Google service account key'],
  [/xox[baprs]-[0-9A-Za-z-]{10,}/, 'a Slack token'],
  [/ghp_[0-9A-Za-z]{30,}/, 'a GitHub token'],
  [/(password|passwd|secret|api_?key)\s*[:=]\s*['"][^'"\s]{8,}['"]/i, 'a password or secret written in the code'],
];
let scanned = 0;
const secretHits = [];
function walk(dir, depth = 0) {
  if (depth > 12) return;
  let list; try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const d of list) {
    const f = path.join(dir, d.name);
    if (SKIP.test(f) || /\.before-/.test(d.name)) continue;
    if (d.isDirectory()) walk(f, depth + 1);
    else if (TEXT.test(d.name) || d.name.startsWith('.env')) {
      if (/^\.env(\.local|\.production)?$/.test(d.name)) continue;     // the real .env files: checked above, never scanned for printing
      if (/security-check\.js$|\.test\.|\/test\/|\\test\\|example|sample|fixture|mock/i.test(f)) continue;
      let st; try { st = fs.statSync(f); } catch { continue; }
      if (st.size > 2_000_000) continue;
      const t = read(f); if (!t) continue;
      scanned++;
      for (const [re, what] of PATTERNS) {
        const m = t.match(re);
        if (m && !/process\.env|placeholder|change-me|your_|xxx|example|dev-only|<|\$\{/i.test(m[0])) {
          const val = (m[0].match(/['"]([^'"]*)['"]\s*$/) || [])[1] || '';
          if (/^(password|passwords|new password|secret|api ?key|كلمة المرور|密码)$/i.test(val)) continue;      // a label on a screen, not a secret
          secretHits.push({ f, what: /_dev_|dev_password|test_password|_test_/i.test(val) ? 'a development account password' : what, line: t.slice(0, m.index).split('\n').length }); break;
        }
      }
    }
  }
}
walk(ROOT);
for (const h of secretHits.slice(0, 60)) {
  if (h.what === 'a development account password') add('LOW', 'Secrets', `${rel(h.f)}:${h.line} has a development account password: make sure that account does not exist on the real server (or has another password).`);
  else add(/LIVE|private key|AWS|service account|GitHub|Slack/.test(h.what) ? 'HIGH' : 'MEDIUM', 'Secrets', `${rel(h.f)}:${h.line} looks like ${h.what}. If it is real, move it to .env and replace it (treat the old one as leaked).`);
}
if (secretHits.length > 60) add('MEDIUM', 'Secrets', `${secretHits.length - 60} more possible secrets not listed.`);
const gi = read(path.join(ROOT, '.gitignore')) || '';
if (fs.existsSync(path.join(ROOT, '.git'))) {
  if (!/(^|\n)\s*\.env\b|(^|\n)\s*\*\.env|(^|\n)\s*\*\*\/\.env/.test(gi)) add('HIGH', 'Secrets', '.env is not in .gitignore: your secrets could be committed to git.');
  else add('OK', 'Secrets', '.env is in .gitignore.');
}

// ------------------------------------------------------------------ 5. secrets the browser can read
for (const app of ['web-storefront', 'admin-dashboard', 'supplier-portal', 'hub-portal']) {
  for (const n of ['.env', '.env.local', '.env.production']) {
    const e = parseEnv(path.join(ROOT, 'apps', app, n));
    if (!e) continue;
    for (const k of Object.keys(e)) if (/^(NEXT_PUBLIC_|VITE_|REACT_APP_)/.test(k) && /SECRET|PRIVATE|PASSWORD|SK_|TOKEN/.test(k)) add('HIGH', 'Websites', `apps/${app}/${n}: ${k} goes into the browser for anyone to read. Secrets must stay on the API.`);
  }
}

// ------------------------------------------------------------------ the report
const order = { HIGH: 0, MEDIUM: 1, LOW: 2, OK: 3 };
findings.sort((a, b) => order[a.level] - order[b.level] || a.area.localeCompare(b.area));
const count = (l) => findings.filter((f) => f.level === l).length;
const byGuard = (g) => allRoutes.filter((r) => r.guard === g).length;
const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
let md = `# LEAP security check\n\n${now} · read ${scanned} files · ${allRoutes.length} API routes\n\n`;
md += `| | Count |\n|---|---|\n| 🔴 High (fix before going live) | ${count('HIGH')} |\n| 🟠 Medium (check) | ${count('MEDIUM')} |\n| 🟡 Low (good to fix) | ${count('LOW')} |\n| 🟢 OK | ${count('OK')} |\n\n`;
md += `**Who can call the API routes:** role (admin / supplier / hub) ${byGuard('role')} · signed-in ${byGuard('auth')} · optional sign-in ${byGuard('optional')} · anyone ${byGuard('public')} · switched off ${byGuard('off')}\n\n`;
md += `This reads the code as text: a check written inside a handler may not be seen. Every line is "check by hand", not "broken".\n\n`;
for (const lvl of ['HIGH', 'MEDIUM', 'LOW', 'OK']) {
  const list = findings.filter((f) => f.level === lvl);
  if (!list.length) continue;
  md += `## ${{ HIGH: '🔴 High', MEDIUM: '🟠 Medium', LOW: '🟡 Low', OK: '🟢 OK' }[lvl]}\n\n`;
  for (const f of list) md += `- **${f.area}:** ${f.text}\n`;
  md += '\n';
}
md += `## Routes anyone can read (GET, no sign-in): ${publicGets.length}\n\nCheck none of these returns private data (emails, phones, addresses, prices paid, other people's orders).\n\n`;
for (const r of publicGets.sort((a, b) => a.full.localeCompare(b.full))) md += `- ${r.method} ${r.full} (${rel(r.file)}:${r.line})\n`;
md += `\n## Every route\n\n| Method | Route | Who | File |\n|---|---|---|---|\n`;
for (const r of [...allRoutes].sort((a, b) => a.full.localeCompare(b.full) || a.method.localeCompare(b.method))) md += `| ${r.method} | ${r.full} | ${r.guard} | ${rel(r.file)}:${r.line} |\n`;
md += `\n## Also run\n\n- \`npm audit\` in services\\api and each apps\\* web folder (fix high and critical)\n- \`flutter pub outdated\` in the apps\n- OWASP ZAP "Automated Scan" on the storefront and http://localhost:4000\n- Before launch: a penetration test by an outside company\n`;
const outFile = path.join(ROOT, 'security-report.md');
fs.writeFileSync(outFile, md);

console.log(`\nLEAP security check: ${allRoutes.length} API routes, ${scanned} files read`);
console.log(`  High ${count('HIGH')}   Medium ${count('MEDIUM')}   Low ${count('LOW')}   OK ${count('OK')}`);
for (const f of findings.filter((x) => x.level === 'HIGH').slice(0, 15)) console.log(`  HIGH  ${f.area}: ${f.text}`);
console.log(`\nThe full report: ${outFile}\n(nothing was changed and nothing was sent anywhere)`);
