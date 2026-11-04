#!/usr/bin/env node
/**
 * Admin portal: a number beside each side-menu item with something waiting (confirmed with the person via mockup), and on the tabs inside its groups.
 *   Orders (not delivered yet; the hover text says how many are late) · Suppliers (waiting for approval + unread supplier messages)
 *   Returns (open) · Flagged Shipments (open, red) · Support (open tickets) · Financial (shipping costs waiting for approval, red)
 *  - Server: GET /admin-counts (services/api/src/modules/adminCounts); migration 131 remembers when an admin last opened each supplier's messages.
 *  - Refreshes every few seconds and after each page change; an admin only gets the numbers of the pages they may open.
 *
 *   node scripts/patch-admin-counts.js            dry run
 *   node scripts/patch-admin-counts.js --write    applies it (each changed file is saved as <file>.before-admin-counts first)
 * Then: cd services\api ; npm run migrate ; restart the API. Admin portal: Ctrl+F5.
 *
 * A file that is not as this patch expects is NOT changed (the whole patch stops). Windows (CRLF) line endings are handled. Running it twice is harmless.
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"created":[{"file":"services/api/db/migrations/131_admin_messages_read.sql","what":"database: when an admin last opened each supplier's messages (migration 131)","text":"-- Migration 131: when an admin last opened each supplier's message thread, so the admin portal can show how many messages from suppliers are\n-- still unread (the number beside \"Supplier Messages\" in the side menu).\nALTER TABLE suppliers ADD COLUMN IF NOT EXISTS admin_messages_read_at TIMESTAMPTZ;\n"},{"file":"services/api/src/modules/adminCounts/service.js","what":"server: the numbers","text":"/**\n * The numbers in the admin portal's side menu (and on the tabs inside its groups): what is waiting for the platform.\n *   orders            orders not delivered yet (not cancelled); `late`: the ones the delay check already found late (supplier_sub_orders.delay_notified)\n *   suppliers         suppliers waiting for approval\n *   supplierMessages  messages from suppliers an admin has not opened yet (suppliers.admin_messages_read_at, migration 131)\n *   returns           return cases still open\n *   flagged           flagged shipments still open\n *   tickets           support tickets still open\n *   shippingCosts     parcel shipping costs waiting for an admin (migration 127)\n */\nasync function countsFor(db) {\n  const one = async (sql) => Number((await db.query(sql)).rows[0].n);\n  const { rows: [o] } = await db.query(\n    `SELECT COUNT(*) AS n,\n            COUNT(*) FILTER (WHERE EXISTS (\n              SELECT 1 FROM supplier_sub_orders so WHERE so.order_id = o.id AND so.status != 'cancelled' AND so.delay_notified = true\n                AND NOT EXISTS (SELECT 1 FROM hub_shipments hs WHERE hs.sub_order_id = so.id AND hs.status = 'delivered'))) AS late\n     FROM orders o\n     WHERE o.status != 'cancelled'\n       AND EXISTS (\n         SELECT 1 FROM supplier_sub_orders so WHERE so.order_id = o.id AND so.status != 'cancelled'\n           AND NOT EXISTS (SELECT 1 FROM hub_shipments hs WHERE hs.sub_order_id = so.id AND hs.status = 'delivered'))`\n  );\n  return {\n    orders: { notDelivered: Number(o.n), late: Number(o.late) },\n    suppliers: await one(`SELECT COUNT(*) AS n FROM suppliers WHERE verification_status = 'pending'`),\n    supplierMessages: await one(\n      `SELECT COUNT(*) AS n FROM supplier_messages sm JOIN suppliers s ON s.id = sm.supplier_id\n       WHERE sm.sender_role = 'supplier' AND sm.created_at > COALESCE(s.admin_messages_read_at, '-infinity'::timestamptz)`),\n    returns: await one(`SELECT COUNT(*) AS n FROM return_cases WHERE status IN ('awaiting', 'in_progress')`),\n    flagged: await one(`SELECT COUNT(*) AS n FROM hub_shipments WHERE resolved_at IS NULL AND status IN ('flagged', 'returned_to_supplier', 'discarded_at_hub')`),\n    tickets: await one(`SELECT COUNT(*) AS n FROM support_tickets WHERE status != 'resolved'`),\n    shippingCosts: await one(`SELECT COUNT(*) AS n FROM hub_parcel_costs WHERE state IN ('needs_photo', 'waiting')`).catch(() => 0),\n  };\n}\n\n/** An admin opened a supplier's thread: its messages are read. */\nasync function markSupplierMessagesRead(db, supplierId) {\n  await db.query('UPDATE suppliers SET admin_messages_read_at = now() WHERE id = $1', [supplierId]);\n}\n\nmodule.exports = { countsFor, markSupplierMessagesRead };\n"},{"file":"services/api/src/modules/adminCounts/routes.js","what":"server: GET /admin-counts","text":"const express = require('express');\nconst db = require('../../../db/pool');\nconst { requireAuth, requireRole, requirePageAccess } = require('../auth/middleware');\nconst { countsFor } = require('./service');\n\n// GET /admin-counts -- the numbers in the admin portal's side menu (see ./service.js). A number for a page this admin may not open is null.\nconst router = express.Router();\nconst PAGE_OF = { orders: 'orders', suppliers: 'suppliers', supplierMessages: 'supplierMessages', returns: 'returns', flagged: 'flagged', tickets: 'tickets', shippingCosts: 'shippingCosts' };\n\n// the same check as requirePageAccess, as a yes / no\nconst mayOpen = (req, pageId) => new Promise((resolve) => {\n  const res = { status: () => ({ json: () => resolve(false) }) };\n  requirePageAccess(pageId)(req, res, (err) => resolve(!err));\n});\n\nrouter.get('/', requireAuth, requireRole('admin'), async (req, res, next) => {\n  try {\n    const counts = await countsFor(db);\n    const out = {};\n    for (const [key, pageId] of Object.entries(PAGE_OF)) out[key] = (await mayOpen(req, pageId)) ? counts[key] : null;\n    res.json(out);\n  } catch (err) {\n    next(err);\n  }\n});\n\nmodule.exports = router;\n"},{"file":"apps/admin-dashboard/src/adminCounts.js","what":"admin portal: loads the numbers","text":"import { API_BASE_URL, getStoredToken } from \"./auth\";\n\n/**\n * The numbers in the side menu and on the tabs of its groups (GET /admin-counts): orders not delivered, suppliers waiting for approval, unread\n * supplier messages, open returns, open flagged shipments, open tickets, shipping costs waiting for approval. Quiet: a failed load keeps what is shown.\n */\nexport async function fetchAdminCounts(token = getStoredToken()) {\n  const res = await fetch(`${API_BASE_URL}/admin-counts`, { headers: { Authorization: `Bearer ${token}` } });\n  if (!res.ok) throw new Error(`admin counts: ${res.status}`);\n  return res.json();\n}\n\nconst RED = new Set([\"flagged\", \"shippingCosts\"]);      // these hold something up: shown in red\n\n/** The number (and its hover text) for one page. `flaggedCount`: the count the shell already had, used until /admin-counts answers. */\nexport function pageBadge(counts, pageId, { flaggedCount = 0 } = {}) {\n  const c = counts || {};\n  let n = 0; let tip = \"\";\n  if (pageId === \"orders\" && c.orders) {\n    n = c.orders.notDelivered; tip = `${n} ${n === 1 ? \"order\" : \"orders\"} not delivered yet${c.orders.late ? ` · ${c.orders.late} late` : \"\"}`;\n  } else if (pageId === \"suppliers\") { n = c.suppliers || 0; tip = `${n} ${n === 1 ? \"supplier\" : \"suppliers\"} waiting for approval`; }\n  else if (pageId === \"supplierMessages\") { n = c.supplierMessages || 0; tip = `${n} unread ${n === 1 ? \"message\" : \"messages\"} from suppliers`; }\n  else if (pageId === \"returns\") { n = c.returns || 0; tip = `${n} open ${n === 1 ? \"return\" : \"returns\"}`; }\n  else if (pageId === \"flagged\") { n = c.flagged ?? flaggedCount; tip = `${n} flagged ${n === 1 ? \"shipment\" : \"shipments\"} still open`; }\n  else if (pageId === \"tickets\") { n = c.tickets || 0; tip = `${n} open ${n === 1 ? \"ticket\" : \"tickets\"}`; }\n  else if (pageId === \"shippingCosts\") { n = c.shippingCosts || 0; tip = `${n} ${n === 1 ? \"parcel's\" : \"parcels'\"} shipping cost waiting for your approval`; }\n  return n > 0 ? { count: n, red: RED.has(pageId), tip } : { count: 0, red: false, tip: \"\" };\n}\n\n/** A side-menu entry: one page, or a group (the total of its pages this admin may open). */\nexport function menuBadge(counts, pageIds, extra) {\n  const parts = pageIds.map((id) => pageBadge(counts, id, extra)).filter((b) => b.count > 0);\n  return { count: parts.reduce((s, b) => s + b.count, 0), red: parts.some((b) => b.red), tip: parts.map((b) => b.tip).join(\" · \") };\n}\n\n/** For a tab inside a group: { count, tone } as the page tabs take them (nothing when 0). */\nexport function tabBadge(counts, pageId, extra) {\n  const b = pageBadge(counts, pageId, extra);\n  return b.count > 0 ? { count: b.count, tone: b.red ? \"red\" : \"ink\", tip: b.tip } : {};\n}\n"}],"anchored":[{"file":"services/api/src/modules/supplier-messages/routes.js","what":"server: opening a supplier's thread marks it read","done":"markSupplierMessagesRead","pairs":[["      'SELECT * FROM supplier_messages WHERE supplier_id = $1 ORDER BY created_at ASC',\n      [req.params.supplierId]\n    );\n","      'SELECT * FROM supplier_messages WHERE supplier_id = $1 ORDER BY created_at ASC',\n      [req.params.supplierId]\n    );\n    // an admin opened this thread: its messages are read (the number beside \"Supplier Messages\" in the menu, migration 131)\n    await require('../adminCounts/service').markSupplierMessagesRead(db, req.params.supplierId);\n"]]},{"file":"apps/admin-dashboard/src/App.jsx","what":"admin portal: numbers in the side menu and on the group tabs","done":"from \"./adminCounts\"","pairs":[["import ShippingCostsPanel from \"./ShippingCostsPanel\";","import ShippingCostsPanel from \"./ShippingCostsPanel\";\nimport { fetchAdminCounts, menuBadge, tabBadge } from \"./adminCounts\";      // the numbers in the side menu and on the group tabs"],["  const [flaggedCount, setFlaggedCount] = useState(0);\n","  const [flaggedCount, setFlaggedCount] = useState(0);\n  const [navCounts, setNavCounts] = useState(null);      // what is waiting, per page (GET /admin-counts)\n"],["      .then((data) => setFlaggedCount(data.length))\n      .catch(() => {}); // non-critical -- the sidebar badge just stays at 0 rather than breaking the shell\n","      .then((data) => setFlaggedCount(data.length))\n      .catch(() => {}); // non-critical -- the sidebar badge just stays at 0 rather than breaking the shell\n    fetchAdminCounts(getStoredToken()).then((c) => setNavCounts((cur) => (sameData(cur, c) ? cur : c))).catch(() => {});      // the side menu's numbers\n"],["  // The sidebar badges (flagged shipments, pending suppliers, disputes, moderation, tickets) follow the platform by themselves.\n","  // the side menu's numbers (and the group tabs'), every few seconds\n  useAutoRefresh(() => fetchAdminCounts(getStoredToken()).then((c) => setNavCounts((cur) => (sameData(cur, c) ? cur : c))));\n  // The sidebar badges (flagged shipments, pending suppliers, disputes, moderation, tickets) follow the platform by themselves.\n"],["tabs: tabIds.map((id) => ({ id, label: TAB_LABELS[id] }))","tabs: tabIds.map((id) => ({ id, label: TAB_LABELS[id], ...tabBadge(navCounts, id, { flaggedCount }) }))"],["            const count = n.id === \"flagged\" ? flaggedCount : 0;\n","            // the number: what is waiting on this page, or (a group) on its pages this admin may open; red when it holds something up\n            const badge = menuBadge(navCounts, isGroup ? accessibleChildren(entry.group, hasAccess) : [n.id], { flaggedCount });\n            const count = badge.count;\n"],["<span style={{ ...body, fontSize: 10.5, fontWeight: 800, color: \"#fff\", background: MENU.badge","<span title={badge.tip} aria-label={badge.tip} style={{ ...body, fontSize: 10.5, fontWeight: 800, color: \"#fff\", background: MENU.badge"],["background: MENU.badge","background: badge.red ? C.red : MENU.badge",true],["{menuCollapsed && <span role=\"tooltip\" className=\"leap-menu-tip\">{n.label}</span>}","{menuCollapsed && <span role=\"tooltip\" className=\"leap-menu-tip\">{badge.tip ? `${n.label} · ${badge.tip}` : n.label}</span>}"]]},{"file":"apps/admin-dashboard/src/components/PageChrome.jsx","what":"admin portal: a tab can show a number","done":"{tab.count > 0 && (","pairs":[["      {tab.label}\n    </button>\n  );\n}","      {tab.label}\n      {/* a number on the tab (what is waiting there), when the page gives one */}\n      {tab.count > 0 && (\n        <span title={tab.tip} aria-label={tab.tip} style={{ ...body, minWidth: 18, height: 18, padding: \"0 6px\", boxSizing: \"border-box\", borderRadius: 9, display: \"inline-flex\", alignItems: \"center\", justifyContent: \"center\", fontSize: 10.5, fontWeight: 800, color: \"#fff\", background: tab.tone === \"red\" ? C.red : C.ink }}>{tab.count}</span>\n      )}\n    </button>\n  );\n}"]]}],"mount":{"what":"server: /admin-counts is served","line":"app.use('/admin-counts', require('./modules/adminCounts/routes')); // the admin portal's side-menu numbers","done":"require('./modules/adminCounts/routes')"}};
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
  if (e.base64) {      // a picture: written as it is
    const bytes = Buffer.from(e.base64, 'base64');
    if (fs.existsSync(p)) {
      if (fs.readFileSync(p).equals(bytes)) { console.log(`already   ${e.file}: ${e.what}`); continue; }
      console.log(`REFUSED   ${e.file}: a different file with this name is already there, so nothing was changed. Send this file.`); problems++; continue;
    }
    if (!fs.existsSync(path.dirname(p))) { console.log(`MISSING   ${path.dirname(e.file)}: folder not found. Run this from D:\\LEAP-MARKETPLACE.`); problems++; continue; }
    plan.push({ file: e.file, what: e.what, before: null, after: bytes });
    continue;
  }
  if (fs.existsSync(p)) {
    if (fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n') === e.text) { console.log(`already   ${e.file}: ${e.what}`); continue; }
    console.log(`REFUSED   ${e.file}: a different file with this name is already there, so nothing was changed. Send this file.`); problems++; continue;
  }
  // a new folder (services/api/src/modules/draftPhotos) is made, but only inside one that is already there
  if (!fs.existsSync(path.dirname(path.dirname(p)))) { console.log(`MISSING   ${path.dirname(path.dirname(e.file))}: folder not found. Run this from D:\\LEAP-MARKETPLACE.`); problems++; continue; }
  plan.push({ file: e.file, what: e.what, before: null, after: e.text });
}
for (const e of DATA.replaced || []) {
  edit(e.file, e.what, e.done, (s) => (e.from.includes(s) ? e.text : { why: 'it is not the version patch-hub-label-design made (run that patch first, or send this file)' }));
}
for (const e of DATA.anchored) {
  // a test file: changed when it is there and as expected, otherwise left as it is (it does not stop the patch)
  if (e.optional) {
    const s = read(e.file);
    if (s === null) { console.log(`skipped   ${e.file}: not found (a test file; nothing to do)`); continue; }
    const n = s.replace(/\r\n/g, '\n');
    if (!n.includes(e.done) && (e.pairs.some(([a]) => !once(n, a)) || (e.block && (!n.includes(e.block.from) || !n.includes(e.block.to))))) { console.log(`skipped   ${e.file}: not as expected, left as it is (${e.what})`); continue; }
  }
  edit(e.file, e.what, e.done, (s) => {
    let out = s;
    for (const [a, b, all] of e.pairs) { if (all) { if (!out.includes(a)) return { why: `this part was not found: "${a.split('\n').find((l) => l.trim()).trim().slice(0, 90)}"` }; out = out.split(a).join(b); continue; } if (!once(out, a)) return { why: `this part was not found: "${a.split('\n').find((l) => l.trim()).trim().slice(0, 90)}"` }; out = out.replace(a, () => b); }
    if (e.block) {
      const i = out.indexOf(e.block.from); const j = i < 0 ? -1 : out.indexOf(e.block.to, i);
      if (i < 0 || j < 0) return { why: `the part starting "${e.block.from.trim().slice(0, 60)}" was not found` };
      out = out.slice(0, i) + e.block.text + out.slice(e.block.includeTo ? j + e.block.to.length : j);
    }
    return out;
  });
}
if (DATA.mount) edit('services/api/src/index.js', DATA.mount.what, DATA.mount.done, (s) => {
  const m = s.match(/\n([ \t]*)app\.use\('\/payouts', payoutsRoutes\);[^\n]*/);
  if (!m) return { why: "the line app.use('/payouts', payoutsRoutes); was not found" };
  const at = m.index + m[0].length;
  return s.slice(0, at) + `\n${m[1]}${DATA.mount.line}` + s.slice(at);
});
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) {
    const p = path.join(root, c.file);
    if (c.before !== null) fs.writeFileSync(`${p}.before-admin-counts`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Then: cd services\\api ; npm run migrate ; restart the API. Admin portal: Ctrl+F5.');
