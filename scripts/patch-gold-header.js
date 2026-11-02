#!/usr/bin/env node
/**
 * Admin portal: the header of every page (title, description, search, notifications, name) is golden yellow, with dark text on it.
 * Needs patch-page-design and patch-page-tabs first.
 *
 *   node scripts/patch-gold-header.js            dry run
 *   node scripts/patch-gold-header.js --write    applies it (App.jsx is saved as App.jsx.before-gold-header first)
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored":[{"file":"apps/admin-dashboard/src/App.jsx","what":"the header of every page: golden yellow","done":"const HEADER = { bg: C.signal","pairs":[["// Under it, the page's main tabs: those of its group (handed down by the shell), and/or the page's own (`tabs`: { label, tabs: [{ id, label }], activeId, onSelect }).\nfunction TopBar({ title, subtitle, tabs }) {\n","// Under it, the page's main tabs: those of its group (handed down by the shell), and/or the page's own (`tabs`: { label, tabs: [{ id, label }], activeId, onSelect }).\n// The header's colors: golden yellow, with dark text that reads well on it.\nconst HEADER = { bg: C.signal, line: C.signalDark, text: C.onSignal, soft: \"#4A3608\" };\nfunction TopBar({ title, subtitle, tabs }) {\n"],["    <>\n    <div style={{ display: \"flex\", justifyContent: \"space-between\", alignItems: \"center\", gap: 20, padding: \"18px 28px\", borderBottom: `1px solid ${C.line}`, background: C.card }}>\n      <div style={{ flex: \"1 1 auto\", minWidth: 0 }}>\n","    <>\n    <div style={{ display: \"flex\", justifyContent: \"space-between\", alignItems: \"center\", gap: 20, padding: \"18px 28px\", borderBottom: `1px solid ${HEADER.line}`, background: HEADER.bg }}>\n      <div style={{ flex: \"1 1 auto\", minWidth: 0 }}>\n"],["      <div style={{ flex: \"1 1 auto\", minWidth: 0 }}>\n        <div style={{ ...disp, fontSize: 22, fontWeight: 700, color: C.ink }}>{title}</div>\n        {subtitle && <div style={{ ...body, fontSize: 12.5, color: C.muted, marginTop: 2 }}>{subtitle}</div>}\n      </div>\n","      <div style={{ flex: \"1 1 auto\", minWidth: 0 }}>\n        <div style={{ ...disp, fontSize: 22, fontWeight: 700, color: HEADER.text }}>{title}</div>\n        {subtitle && <div style={{ ...body, fontSize: 12.5, color: HEADER.soft, marginTop: 2 }}>{subtitle}</div>}\n      </div>\n"],["          <div>\n            <div style={{ ...body, fontSize: 12.5, fontWeight: 700, color: C.ink }}>{displayName}</div>\n            <div style={{ ...body, fontSize: 10.5, color: C.muted }}>{roleLabel}</div>\n          </div>\n","          <div>\n            <div style={{ ...body, fontSize: 12.5, fontWeight: 700, color: HEADER.text }}>{displayName}</div>\n            <div style={{ ...body, fontSize: 10.5, color: HEADER.soft }}>{roleLabel}</div>\n          </div>\n"],["    <div style={{ position: \"relative\", width: 280 }}>\n      <div style={{ display: \"flex\", alignItems: \"center\", gap: 8, height: 40, boxSizing: \"border-box\", background: C.canvas, border: `1px solid ${C.line}`, borderRadius: 10, padding: \"0 12px\" }}>\n        <Search size={15} color={C.muted} />\n","    <div style={{ position: \"relative\", width: 280 }}>\n      <div style={{ display: \"flex\", alignItems: \"center\", gap: 8, height: 40, boxSizing: \"border-box\", background: \"#fff\", border: `1px solid ${C.signalDark}`, borderRadius: 10, padding: \"0 12px\" }}>\n        <Search size={15} color={C.muted} />\n"],["        aria-label=\"Notifications\"\n        style={{ position: \"relative\", width: 40, height: 40, boxSizing: \"border-box\", background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, cursor: \"pointer\", display: \"flex\", alignItems: \"center\", justifyContent: \"center\", padding: 0 }}\n      >\n","        aria-label=\"Notifications\"\n        style={{ position: \"relative\", width: 40, height: 40, boxSizing: \"border-box\", background: C.card, border: `1px solid ${C.signalDark}`, borderRadius: 10, cursor: \"pointer\", display: \"flex\", alignItems: \"center\", justifyContent: \"center\", padding: 0 }}\n      >\n"]]}],"created":[]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-gold-header`, c.before);
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Refresh the admin portal (Ctrl+F5).');
