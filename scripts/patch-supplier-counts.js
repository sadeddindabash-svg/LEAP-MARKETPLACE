#!/usr/bin/env node
/**
 * Supplier portal: numbers beside Orders, Returns and Messages in the side menu (design A).
 *  - Orders: new orders to accept plus accepted ones not shipped yet. Gold, or red when one is past its answer time. Hover text: "5 to accept or ship · 2 late".
 *  - Returns: return / warranty cases still open.  Messages: new messages from the Leap team since Messages was last opened.
 *  - Server: GET /supplier-counts/me and POST /supplier-counts/me/messages-read (services/api/src/modules/supplierCounts), migration 128.
 *  - Chinese and English. With the menu collapsed, a small number sits on the icon.
 *
 *   node scripts/patch-supplier-counts.js            dry run
 *   node scripts/patch-supplier-counts.js --write    applies it (each changed file is saved as <file>.before-supplier-counts first)
 * Then: cd services\api ; npm run migrate     (and restart the API). Supplier portal: Ctrl+F5.
 *
 * A file that is not as this patch expects is NOT changed (the whole patch stops). Windows (CRLF) line endings are handled. Running it twice is harmless.
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"created":[{"file":"services/api/db/migrations/128_supplier_messages_read.sql","what":"server: migration 128 (when the supplier last opened Messages)","text":"-- Migration 128: when a supplier last opened Messages in the supplier portal, so the side menu can show how many messages from the Leap team\n-- arrived since then (the number goes away when they open Messages). NULL: never opened, every message from Leap counts.\nALTER TABLE suppliers ADD COLUMN IF NOT EXISTS messages_read_at TIMESTAMPTZ;\n"},{"file":"services/api/src/modules/supplierCounts/service.js","what":"server: the side-menu numbers","text":"/**\n * The numbers beside Orders, Returns and Messages in the supplier portal's side menu (design A): what is waiting for the supplier.\n *   orders    new orders to accept (no answer yet), and accepted ones not shipped yet; `late`: new ones past their answer time (respond_by)\n *   returns   return / warranty cases still open (awaiting, in progress)\n *   messages  messages from the Leap team since the supplier last opened Messages (suppliers.messages_read_at, migration 128)\n */\nasync function countsFor(db, supplierId) {\n  const { rows: [o] } = await db.query(\n    `SELECT COUNT(*) FILTER (WHERE so.accepted_at IS NULL) AS to_accept,\n            COUNT(*) FILTER (WHERE so.accepted_at IS NOT NULL) AS to_ship,\n            COUNT(*) FILTER (WHERE so.accepted_at IS NULL AND so.respond_by IS NOT NULL AND so.respond_by < now()) AS late\n     FROM supplier_sub_orders so\n     WHERE so.supplier_id = $1 AND so.status IN ('pending', 'preparing') AND so.refused_at IS NULL`, [supplierId]\n  );\n  const { rows: [r] } = await db.query(\n    `SELECT COUNT(*) AS n FROM return_cases rc JOIN supplier_sub_orders so ON so.id = rc.sub_order_id\n     WHERE so.supplier_id = $1 AND rc.status IN ('awaiting', 'in_progress')`, [supplierId]\n  );\n  const { rows: [m] } = await db.query(\n    `SELECT COUNT(*) AS n FROM supplier_messages sm JOIN suppliers s ON s.id = sm.supplier_id\n     WHERE sm.supplier_id = $1 AND sm.sender_role = 'admin' AND sm.created_at > COALESCE(s.messages_read_at, '-infinity'::timestamptz)`, [supplierId]\n  );\n  const toAccept = Number(o.to_accept); const toShip = Number(o.to_ship);\n  return { orders: { waiting: toAccept + toShip, toAccept, toShip, late: Number(o.late) }, returns: Number(r.n), messages: Number(m.n) };\n}\n\n/** The supplier opened Messages: the number beside it goes away. */\nasync function markMessagesRead(db, supplierId) {\n  await db.query('UPDATE suppliers SET messages_read_at = now() WHERE id = $1', [supplierId]);\n}\n\nmodule.exports = { countsFor, markMessagesRead };\n"},{"file":"services/api/src/modules/supplierCounts/routes.js","what":"server: GET /supplier-counts/me, POST /supplier-counts/me/messages-read","text":"const express = require('express');\nconst db = require('../../../db/pool');\nconst { requireAuth, requireRole } = require('../auth/middleware');\nconst { countsFor, markMessagesRead } = require('./service');\n\n// The supplier portal's side-menu numbers (see ./service.js). GET /supplier-counts/me; POST /supplier-counts/me/messages-read when Messages opens.\nconst router = express.Router();\n\nrouter.get('/me', requireAuth, requireRole('supplier'), async (req, res, next) => {\n  try { res.json(await countsFor(db, req.user.supplierId)); } catch (err) { next(err); }\n});\n\nrouter.post('/me/messages-read', requireAuth, requireRole('supplier'), async (req, res, next) => {\n  try { await markMessagesRead(db, req.user.supplierId); res.json(await countsFor(db, req.user.supplierId)); } catch (err) { next(err); }\n});\n\nmodule.exports = router;\n"},{"file":"apps/supplier-portal/src/menuCounts.js","what":"supplier portal: loads the side-menu numbers","text":"import { API_BASE_URL } from \"./auth\";\n\n/**\n * The numbers beside Orders, Returns and Messages in the side menu (GET /supplier-counts/me). Quiet: a failed load keeps what is shown.\n * Opening Messages marks Leap's messages as read (POST /supplier-counts/me/messages-read), so its number goes away.\n */\nasync function call(method, url, token) {\n  const res = await fetch(`${API_BASE_URL}${url}`, { method, headers: { Authorization: `Bearer ${token}` } });\n  if (!res.ok) throw new Error(`menu counts: ${res.status}`);\n  return res.json();\n}\nexport const fetchMenuCounts = (token) => call(\"GET\", \"/supplier-counts/me\", token);\nexport const markMenuMessagesRead = (token) => call(\"POST\", \"/supplier-counts/me/messages-read\", token);\n\n/** The number (and its colour and hover text) for one menu item, or null when nothing is waiting. */\nexport function menuBadge(counts, id, lang) {\n  if (!counts) return null;\n  const zh = lang === \"zh\";\n  let n = 0; let late = 0; let tip = \"\";\n  if (id === \"orders\") {\n    n = counts.orders ? counts.orders.waiting : 0;\n    late = counts.orders ? counts.orders.late : 0;\n    tip = zh ? `${n} 个订单待接单或发货` : `${n} to accept or ship`;\n    if (late > 0) tip += zh ? ` · ${late} 个已超时` : ` · ${late} late`;\n  } else if (id === \"returns\") {\n    n = counts.returns || 0;\n    tip = zh ? `${n} 个退货待处理` : `${n} ${n === 1 ? \"return\" : \"returns\"} to answer`;\n  } else if (id === \"messages\") {\n    n = counts.messages || 0;\n    tip = zh ? `${n} 条来自 Leap 的新消息` : `${n} new ${n === 1 ? \"message\" : \"messages\"} from Leap`;\n  } else return null;\n  if (!n) return null;\n  return { text: n > 99 ? \"99+\" : String(n), late: late > 0, tip };\n}\n"}],"anchored":[{"file":"apps/supplier-portal/src/App.jsx","what":"supplier portal: numbers beside Orders, Returns and Messages","done":"from \"./menuCounts\"","pairs":[["import { setApiLanguage, apiMessage, uiLocale } from \"./serverMessages\";\n","import { setApiLanguage, apiMessage, uiLocale } from \"./serverMessages\";\nimport { fetchMenuCounts, markMenuMessagesRead, menuBadge } from \"./menuCounts\";      // the numbers beside Orders, Returns and Messages in the side menu\n"],["  const [unreadCount, setUnreadCount] = useState(0);\n","  const [unreadCount, setUnreadCount] = useState(0);\n  const [menuCounts, setMenuCounts] = useState(null);      // what is waiting: orders to accept or ship (and how many are late), open returns, new messages\n"],["  useAutoRefresh(refreshUnreadCount);      // the sidebar's unread badge\n","  useAutoRefresh(refreshUnreadCount);      // the sidebar's unread badge\n  // the side menu's numbers: reloaded with the page and every few seconds; while Messages is open, Leap's messages count as read\n  const refreshMenuCounts = () => {\n    const token = getStoredToken();\n    return (page === \"messages\" ? markMenuMessagesRead(token) : fetchMenuCounts(token)).then((c) => setMenuCounts((cur) => (sameData(cur, c) ? cur : c))).catch(() => {});      // non-critical: the numbers stay as they are\n  };\n  useEffect(() => { refreshMenuCounts(); }, [page, Boolean(openOrder)]);\n  useAutoRefresh(refreshMenuCounts);\n"],["            const active = (page === id && !openOrder) || (id === \"orders\" && !!openOrder);\n","            const active = (page === id && !openOrder) || (id === \"orders\" && !!openOrder);\n            const badge = menuBadge(menuCounts, id, lang);      // gold: waiting; red: an order is late\n"],["aria-label={menuCollapsed ? t.nav[id] : undefined} style={{","aria-label={menuCollapsed ? (badge ? `${t.nav[id]} · ${badge.tip}` : t.nav[id]) : undefined} style={{"],["                {menuCollapsed && <span role=\"tooltip\" className=\"leap-menu-tip\">{t.nav[id]}</span>}\n","                {badge && <span data-testid={`menu-count-${id}`} title={badge.tip} aria-label={menuCollapsed ? undefined : badge.tip} style={{\n                  ...font, ...(menuCollapsed ? { position: \"absolute\", top: 3, left: \"calc(50% + 3px)\", minWidth: 16, height: 16, padding: \"0 4px\", fontSize: 10, boxShadow: `0 0 0 2px ${active ? MENU.activeBg : MENU.bg}` } : { marginLeft: \"auto\", minWidth: 20, height: 20, padding: \"0 6px\", fontSize: 11 }),\n                  boxSizing: \"border-box\", borderRadius: 10, display: \"inline-flex\", alignItems: \"center\", justifyContent: \"center\", fontWeight: 800, lineHeight: 1,\n                  background: badge.late ? \"#C0362C\" : \"#F2A71B\", color: badge.late ? \"#FFFFFF\" : \"#241A05\",      // gold, or red when an order is late\n                }}>{badge.text}</span>}\n                {menuCollapsed && <span role=\"tooltip\" className=\"leap-menu-tip\">{badge ? `${t.nav[id]} · ${badge.tip}` : t.nav[id]}</span>}\n"]]}]};
const plan = [];
let problems = 0;
const once = (s, a) => s.split(a).length === 2;
const read = (file) => { const p = path.join(root, file); return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null; };
function edit(file, what, done, change) {
  const s = read(file);
  if (s === null) { console.log(`MISSING   ${file}: not found. Run this from D:\\LEAP-MARKETPLACE.`); problems++; return; }
  if (s.replace(/\r\n/g, '\n').includes(done)) { console.log(`already   ${file}: ${what}`); return; }
  const eol = s.includes('\r\n') ? '\r\n' : '\n';
  const out = change(s.replace(/\r\n/g, '\n'));
  if (typeof out !== 'string') { console.log(`REFUSED   ${file}: ${out && out.why ? out.why : 'its text is not what this patch expects'}, so nothing was changed. Send this file.`); problems++; return; }
  plan.push({ file, what, before: s, after: out.replace(/\n/g, eol) });
}

for (const e of DATA.created) {
  const p = path.join(root, e.file);
  if (fs.existsSync(p)) {
    if (fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n') === e.text) { console.log(`already   ${e.file}: ${e.what}`); continue; }
    console.log(`REFUSED   ${e.file}: a different file with this name is already there, so nothing was changed. Send this file.`); problems++; continue;
  }
  // a new folder (services/api/src/modules/supplierCounts) is made, but only inside one that is already there
  if (!fs.existsSync(path.dirname(path.dirname(p)))) { console.log(`MISSING   ${path.dirname(path.dirname(e.file))}: folder not found. Run this from D:\\LEAP-MARKETPLACE.`); problems++; continue; }
  plan.push({ file: e.file, what: e.what, before: null, after: e.text });
}
for (const e of DATA.anchored) {
  edit(e.file, e.what, e.done, (s) => {
    let out = s;
    for (const [a, b] of e.pairs) { if (!once(out, a)) return null; out = out.replace(a, () => b); }
    return out;
  });
}
edit('services/api/src/index.js', 'server: /supplier-counts is served', "require('./modules/supplierCounts/routes')", (s) => {
  const m = s.match(/\n([ \t]*)app\.use\('\/payouts', payoutsRoutes\);[^\n]*/);
  if (!m) return { why: "the line app.use('/payouts', payoutsRoutes); was not found" };
  const at = m.index + m[0].length;
  return s.slice(0, at) + `\n${m[1]}app.use('/supplier-counts', require('./modules/supplierCounts/routes')); // the supplier portal side-menu numbers` + s.slice(at);
});
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) {
    const p = path.join(root, c.file);
    if (c.before !== null) fs.writeFileSync(`${p}.before-supplier-counts`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Then: cd services\\api ; npm run migrate ; restart the API. Supplier portal: Ctrl+F5.');
