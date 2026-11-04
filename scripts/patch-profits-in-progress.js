#!/usr/bin/env node
/**
 * Financial -> Profits (design A): a fifth box, "In progress · NOT FINAL", beside Net profit, Sales, Margin and Orders counted: the profit expected from
 * the orders still inside their return window, how many they are, their sales, and which one becomes final next. Dashed gold, so it reads as not final;
 * the four boxes keep counting final money only. Run patch-profits.js first (this one builds on it).
 *
 *   node scripts/patch-profits-in-progress.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-profits-in-progress.js --write    applies it (the file is saved as <file>.before-profits-in-progress first)
 *
 * Windows (CRLF) line endings are handled. Running it twice is harmless ("already").
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "apps/admin-dashboard/src/ProfitsPanel.jsx", "what": "admin, Financial -> Profits: the In progress box beside the four boxes", "done": "function InProgress(", "pairs": [["      {children}\n    </div>\n", "      {children}\n    </div>\n  );\n}\n\n// The fifth box (design A): the money still inside its return window, beside the final figures, dashed gold so it reads as \"not final\".\nfunction InProgress({ notFinal, today }) {\n  const next = notFinal.next[0];\n  const when = !next ? null : next.finalAt === today ? \"today\" : next.finalAt;\n  return (\n    <div data-testid=\"profit-kpi-in-progress\" style={{ flex: 1.15, minWidth: 0, background: \"#FFF8E8\", border: `1.5px dashed ${C.signal}`, borderRadius: 12, padding: 16 }}>\n      <div style={{ ...body, fontSize: 11.5, fontWeight: 700, letterSpacing: \"0.05em\", textTransform: \"uppercase\", color: \"#7A5300\" }}>\n        In progress <span style={{ fontSize: 10, fontWeight: 800, background: C.amberBg, borderRadius: 20, padding: \"2px 7px\", marginInlineStart: 4 }}>NOT FINAL</span>\n      </div>\n      <div style={{ ...disp, fontSize: 28, fontWeight: 800, color: C.ink, margin: \"6px 0 4px\" }}>{notFinal.orders > 0 ? `≈ ${money(notFinal.expectedProfit)}` : money(0)}</div>\n      <div style={small}>\n        <b style={{ color: C.ink }}>{notFinal.orders} {notFinal.orders === 1 ? \"order\" : \"orders\"}</b> · {money(notFinal.sales)} in sales\n        {next && <><br />next final: {when} ({next.orderId})</>}\n        {!next && <><br />nothing inside a return window</>}\n      </div>\n    </div>\n"], ["            <Kpi label=\"Orders counted\" value={t.orders}><Change value={ch.orders} unit=\"\" /></Kpi>\n          </div>\n", "            <Kpi label=\"Orders counted\" value={t.orders}><Change value={ch.orders} unit=\"\" /></Kpi>\n            <InProgress notFinal={report.notFinal} today={String(report.now).slice(0, 10)} />\n          </div>\n"]]}], "created": []};
const once = (s, a) => s.split(a).length === 2;
const plan = [];
let problems = 0;
for (const e of DATA.anchored) {
  const p = path.join(root, e.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${e.file}: not found. Run this from D:\\LEAP-MARKETPLACE.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const c = (x) => (s.includes('\r\n') ? x.replace(/\r?\n/g, '\r\n') : x);
  if (s.includes(c(e.done))) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  let out = s;
  for (const [a0, b0] of e.pairs) { const a = c(a0), b = c(b0); if (!once(out, a)) { out = null; break; } out = out.replace(a, () => b); }
  if (out === null) { console.log(`REFUSED   ${e.file}: its text is not what this patch expects, so nothing was changed. Send this file.`); problems++; continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: out });
}
for (const e of DATA.created) {
  const p = path.join(root, e.file);
  if (!fs.existsSync(path.dirname(p))) { console.log(`MISSING   ${path.dirname(e.file)}: folder not found. Run this from D:\\LEAP-MARKETPLACE.`); problems++; continue; }
  if (fs.existsSync(p)) {
    const s = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
    if (s === e.text) { console.log(`already   ${e.file}: ${e.what}`); continue; }
    console.log(`REFUSED   ${e.file}: a different file with this name is already there, so nothing was changed. Send this file.`); problems++; continue;
  }
  plan.push({ file: e.file, what: e.what, before: null, after: e.text });
}
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) {
    const p = path.join(root, c.file);
    if (c.before !== null) fs.writeFileSync(`${p}.before-profits-in-progress`, c.before);
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Ctrl+F5 in the admin portal.');
