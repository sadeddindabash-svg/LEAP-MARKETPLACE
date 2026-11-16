#!/usr/bin/env node
/**
 * Supplier portal: a live countdown for every new order waiting for the supplier's answer (confirmed with the person via mockup), in the orders list
 * (a new "Answer within" column, "2nd time" tag, Pending sorted by the least time left) and, large, in the order's answer box with the deadline.
 * Colours: more than 50% of the time left green; 50% to 10% red; the last 10% dark red, blinking; then "Overdue". The time comes from admin > Orders > Rules.
 * Run AFTER patch-order-rules-flow.
 *   node scripts/patch-supplier-answer-countdown.js            dry run
 *   node scripts/patch-supplier-answer-countdown.js --write    applies it
 */
const DATA = {"created": [], "replaced": [], "anchored": [{"file": "services/api/src/modules/supplier/routes.js", "what": "API, supplier orders: how long the supplier has to answer (from Orders > Rules) and which time the order was sent", "done": "answerWindowHours", "pairs": [["so.respond_by, so.accepted_at, so.refused_at, so.refusal_reason, so.refusal_note\n", "so.respond_by, so.accepted_at, so.refused_at, so.refusal_reason, so.refusal_note, so.resend_count\n", false], ["    const result = [];\n    for (const so of subOrders) {", "    // the answer time from admin > Orders > Rules, for the portal's countdown (24 hours when the rules are not there yet)\n    let answerWindowHours = 24;\n    try { answerWindowHours = (await require('../orderResponse/noAnswer').getRules()).waitHours || 24; } catch (err) { /* rules not installed: 24 h */ }\n    const result = [];\n    for (const so of subOrders) {", false], ["        respondBy: so.respond_by,\n", "        respondBy: so.respond_by,\n        answerWindowHours,\n        timesSent: (so.resend_count || 0) + 1,\n", false]]}, {"file": "apps/supplier-portal/src/App.jsx", "what": "supplier portal: a live answer countdown in the orders list and, large, in the order (green / red / dark red blinking / overdue)", "done": "AnswerCountdownBig", "pairs": [["// ---------------------------------------------------------------- Orders: a NEW order is accepted or refused (24 hours to answer)", "// ---------------------------------------------------------------- Answer countdown (confirmed with the person via mockup)\n// How long the supplier has left to accept or refuse a new order: from the moment it is assigned (or sent again) until respondBy,\n// out of answerWindowHours (Orders > Rules in the admin). Colours: more than 50% left = green; 50% to 10% = red; the last 10% = dark red, blinking;\n// time up = \"Overdue\". Shown in the orders list and, large, in the order's answer box. Ticks every second.\nconst COUNTDOWN_COLORS = {\n  ok: { fg: \"#17663a\", bg: \"#e3f6ea\", t1: \"#1f9d6b\", t2: \"#17663a\" },\n  mid: { fg: \"#d92d20\", bg: \"#fde7e7\", t1: \"#f04438\", t2: \"#d92d20\" },\n  hot: { fg: \"#ffffff\", bg: \"#7a0f0f\", t1: \"#9b1c1c\", t2: \"#7a0f0f\" },\n  over: { fg: \"#ffffff\", bg: \"#3d0707\", t1: \"#3d0707\", t2: \"#2a0505\" },\n};\nconst COUNTDOWN_TEXT = {\n  en: { hours: \"hours\", min: \"min\", sec: \"sec\", overdue: \"Overdue\", times: (n) => `${n === 2 ? \"2nd\" : n === 3 ? \"3rd\" : `${n}th`} time`, by: \"Answer by\", after: \"After that the order is given to another supplier.\", hot: \"Less than 10% of the time left: please answer now.\", head: \"Answer within\" },\n  zh: { hours: \"小时\", min: \"分\", sec: \"秒\", overdue: \"已超时\", times: (n) => `第${n}次`, by: \"请在此时间前答复\", after: \"超时后，订单将转给其他供应商。\", hot: \"剩余时间不足 10%：请立即答复。\", head: \"答复剩余\" },\n};\nfunction useNowTick(enabled) {\n  const [now, setNow] = useState(() => Date.now());\n  useEffect(() => { if (!enabled) return undefined; const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, [enabled]);\n  return now;\n}\nfunction answerLeft(order, now) {\n  if (!order || order.status !== \"pending\" || order.acceptedAt || order.refusedAt || !order.respondBy) return null;\n  const end = new Date(order.respondBy).getTime(); if (!Number.isFinite(end)) return null;\n  const windowMs = Math.max(1, Number(order.answerWindowHours || 24)) * 3600000;\n  const ms = end - now; const frac = Math.max(0, Math.min(1, ms / windowMs));\n  const level = ms <= 0 ? \"over\" : frac > 0.5 ? \"ok\" : frac > 0.1 ? \"mid\" : \"hot\";\n  const s = Math.max(0, Math.floor(ms / 1000));\n  return { ms, frac, level, h: Math.floor(s / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };\n}\nconst two = (n) => String(n).padStart(2, \"0\");\n// in the orders list\nfunction AnswerCountdownChip({ order }) {\n  const { lang } = useLang();\n  const T = COUNTDOWN_TEXT[lang === \"zh\" ? \"zh\" : \"en\"];\n  const now = useNowTick(Boolean(order && order.respondBy && order.status === \"pending\"));\n  const left = answerLeft(order, now);\n  if (!left) return <span style={{ color: \"#9aa5b1\" }}>—</span>;\n  const c = COUNTDOWN_COLORS[left.level];\n  return (\n    <div data-testid={`answer-countdown-${order.subOrderId}`}>\n      <span className={left.level === \"hot\" ? \"leap-blink\" : undefined} style={{ display: \"inline-flex\", alignItems: \"center\", gap: 6, borderRadius: 8, padding: \"4px 9px\", fontWeight: 800, fontSize: 12, fontVariantNumeric: \"tabular-nums\", whiteSpace: \"nowrap\", color: c.fg, background: c.bg }}>\n        {left.level === \"over\" ? T.overdue : `⏱ ${two(left.h)}:${two(left.m)}:${two(left.s)}`}\n      </span>\n      {left.level !== \"over\" && <div style={{ width: 70, height: 4, borderRadius: 9, background: \"#eef1f5\", overflow: \"hidden\", marginTop: 4 }}><i style={{ display: \"block\", height: \"100%\", width: `${Math.round((1 - left.frac) * 100)}%`, background: c.t2 }} /></div>}\n    </div>\n  );\n}\n// large, in the order's answer box\nfunction AnswerCountdownBig({ order }) {\n  const { lang } = useLang();\n  const T = COUNTDOWN_TEXT[lang === \"zh\" ? \"zh\" : \"en\"];\n  const now = useNowTick(true);\n  const left = answerLeft(order, now);\n  if (!left) return null;\n  const c = COUNTDOWN_COLORS[left.level];\n  const tile = (n, label) => (\n    <span style={{ position: \"relative\", background: `linear-gradient(${c.t1} 50%, ${c.t2} 50%)`, color: \"#fff\", borderRadius: 8, minWidth: 58, padding: \"8px 4px 5px\", textAlign: \"center\", boxShadow: \"0 3px 6px rgba(0,0,0,.2)\" }}>\n      <b style={{ display: \"block\", fontSize: 28, lineHeight: 1, fontVariantNumeric: \"tabular-nums\" }}>{two(n)}</b>\n      <small style={{ fontSize: 9.5, opacity: 0.8 }}>{label}</small>\n      <span aria-hidden=\"true\" style={{ position: \"absolute\", left: 0, right: 0, top: \"50%\", height: 1, background: \"rgba(0,0,0,.35)\" }} />\n    </span>\n  );\n  const colon = <span style={{ fontWeight: 900, color: c.t2, fontSize: 22, alignSelf: \"center\" }}>:</span>;\n  const deadline = new Date(order.respondBy).toLocaleString(lang === \"zh\" ? \"zh-CN\" : \"en-GB\", { day: \"numeric\", month: \"short\", hour: \"2-digit\", minute: \"2-digit\" });\n  return (\n    <div data-testid=\"answer-countdown\" role=\"timer\" aria-live=\"off\" style={{ marginTop: 10 }}>\n      {left.level === \"over\" ? (\n        <div style={{ textAlign: \"center\", fontWeight: 900, fontSize: 18, color: c.fg, background: c.bg, borderRadius: 8, padding: \"10px 0\" }}>{T.overdue}</div>\n      ) : (\n        <div className={left.level === \"hot\" ? \"leap-blink\" : undefined} dir=\"ltr\" style={{ display: \"flex\", gap: 4, justifyContent: \"center\" }}>\n          {tile(left.h, T.hours)}{colon}{tile(left.m, T.min)}{colon}{tile(left.s, T.sec)}\n        </div>\n      )}\n      {left.level !== \"over\" && <div style={{ height: 8, borderRadius: 9, background: \"#f0e2c2\", overflow: \"hidden\", marginTop: 8 }}><i style={{ display: \"block\", height: \"100%\", width: `${Math.round((1 - left.frac) * 100)}%`, background: c.t2 }} /></div>}\n      <div style={{ fontSize: 12, color: C.muted, textAlign: \"center\", marginTop: 6 }}>{T.by} <b style={{ color: C.ink }}>{deadline}</b>{order.timesSent > 1 ? ` · ${T.times(order.timesSent)}` : \"\"}. {T.after}</div>\n      {left.level === \"hot\" && <div style={{ marginTop: 8, fontSize: 12, background: \"#fff\", border: \"1px solid #f2b8b2\", color: \"#7a0f0f\", borderRadius: 8, padding: \"8px 10px\", fontWeight: 700 }}>{T.hot}</div>}\n      <style>{\"@keyframes leapBlink{50%{opacity:.55}}.leap-blink{animation:leapBlink 1s infinite}\"}</style>\n    </div>\n  );\n}\n\n// ---------------------------------------------------------------- Orders: a NEW order is accepted or refused (24 hours to answer)", false], ["      {hoursLeft !== null && <div data-testid=\"answer-deadline\" style={{ fontSize: 12, color: hoursLeft <= 0 ? C.red : C.muted, marginTop: 3 }}>{hoursLeft <= 0 ? a.overdue : a.left(hoursLeft)}</div>}", "      {/* the live countdown (replaces \"Please answer within N hours\") */}\n      <AnswerCountdownBig order={order} />", false], ["<Th>{t.orders.thStatus}</Th><Th></Th></tr></thead>", "<Th>{t.orders.thStatus}</Th><Th>{COUNTDOWN_TEXT[lang === \"zh\" ? \"zh\" : \"en\"].head}</Th><Th></Th></tr></thead>", false], ["<tr><td colSpan={6} style={{ textAlign: \"center\", color: C.muted, fontSize: 13, padding: 32 }}>{lang === \"zh\" ? \"暂无订单\" : \"No orders yet.\"}</td></tr>", "<tr><td colSpan={7} style={{ textAlign: \"center\", color: C.muted, fontSize: 13, padding: 32 }}>{lang === \"zh\" ? \"暂无订单\" : \"No orders yet.\"}</td></tr>", false], ["                      <Td><PlateChip small>{o.orderId}</PlateChip></Td>", "                      <Td><PlateChip small>{o.orderId}</PlateChip>{o.status === \"pending\" && o.timesSent > 1 && <span style={{ fontSize: 10.5, fontWeight: 800, background: C.ink, color: \"#f9b317\", borderRadius: 5, padding: \"1px 6px\", marginLeft: 6 }}>{COUNTDOWN_TEXT[lang === \"zh\" ? \"zh\" : \"en\"].times(o.timesSent)}</span>}</Td>", false], ["                      <Td><Badge label={t.statusOrder[o.status] || o.status} statusKey={o.status} /></Td>\n                      <Td align=\"right\"><ChevronRight size={15} color={C.muted} /></Td>", "                      <Td><Badge label={t.statusOrder[o.status] || o.status} statusKey={o.status} /></Td>\n                      <Td><AnswerCountdownChip order={o} /></Td>\n                      <Td align=\"right\"><ChevronRight size={15} color={C.muted} /></Td>", false], ["  const filtered = filterIdx === 0 ? orders : orders.filter(o => o.status === keys[filterIdx]);\n\n  return (\n    <div>\n      {/* the order states are the page's tabs, each with its number */}", "  // Pending: the order with the least time left to answer comes first\n  const filtered = filterIdx === 0 ? orders : keys[filterIdx] === \"pending\"\n    ? orders.filter(o => o.status === \"pending\").sort((x, y) => (x.respondBy ? new Date(x.respondBy).getTime() : Infinity) - (y.respondBy ? new Date(y.respondBy).getTime() : Infinity))\n    : orders.filter(o => o.status === keys[filterIdx]);\n\n  return (\n    <div>\n      {/* the order states are the page's tabs, each with its number */}", false], ["  const hoursLeft = order.respondBy ? Math.ceil((new Date(order.respondBy).getTime() - Date.now()) / 3600000) : null;\n", "", false]]}]};
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
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
    if (!n.includes(e.done) && (e.pairs.some(([a, , all]) => all !== 'maybe' && all !== 'alts' && !once(n, a)) || (e.block && (!n.includes(e.block.from) || !n.includes(e.block.to))))) { console.log(`skipped   ${e.file}: not as expected, left as it is (${e.what})`); continue; }
  }
  edit(e.file, e.what, e.done, (s) => {
    let out = s;
    for (const [a, b, all] of e.pairs) {
      if (all === 'alts') { const hit = a.find(([x]) => once(out, x)); if (!hit) return { why: `this part was not found: "${a[a.length - 1][0].split('\n').find((l) => l.trim()).trim().slice(0, 90)}"` }; out = out.replace(hit[0], () => hit[1]); continue; }
      if (all === 'maybe') { if (once(out, a)) out = out.replace(a, () => b); continue; }
      if (all) { if (!out.includes(a)) return { why: `this part was not found: "${a.split('\n').find((l) => l.trim()).trim().slice(0, 90)}"` }; out = out.split(a).join(b); continue; } if (!once(out, a)) return { why: `this part was not found: "${a.split('\n').find((l) => l.trim()).trim().slice(0, 90)}"` }; out = out.replace(a, () => b); }
    if (e.region) {
      const r = e.region; const i = out.indexOf(r.from); const j = i < 0 ? -1 : out.indexOf(r.to, i);
      if (i < 0 || j < 0) return { why: `the part starting "${r.from.trim().slice(0, 60)}" was not found` };
      const seg = out.slice(i, j);
      if (r.must && !seg.includes(r.must)) return { why: `"${r.must}" was not found in the part starting "${r.from.trim().slice(0, 60)}"` };
      const changed = seg.replace(new RegExp(r.find, 'g'), r.repl);
      if (changed === seg) return { why: `nothing to change in the part starting "${r.from.trim().slice(0, 60)}"` };
      out = out.slice(0, i) + changed + out.slice(j);
    }
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-patch-supplier-answer-countdown`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Then: API window: Ctrl+C, npm run dev; supplier portal: Ctrl+F5');
