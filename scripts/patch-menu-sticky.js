#!/usr/bin/env node
/**
 * Admin portal: the side menu stays in view while a long page scrolls, so the admin's name, email and Log out at its bottom are always visible,
 * on every page and tab. Needs patch-page-full first.
 *
 *   node scripts/patch-menu-sticky.js            dry run
 *   node scripts/patch-menu-sticky.js --write    applies it (App.jsx is saved as App.jsx.before-menu-sticky first)
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored":[{"file":"apps/admin-dashboard/src/App.jsx","what":"the side menu stays in view on long pages (name, email and Log out always visible)","done":"position: \"sticky\", top: 0, height: \"100vh\"","pairs":[["      <style>{MENU_CSS}</style>\n      <nav aria-label=\"Main menu\" style={{ width: menuCollapsed ? MENU.collapsed : MENU.expanded, transition: \"width 160ms ease\", background: MENU.bg, display: \"flex\", flexDirection: \"column\", flexShrink: 0 }}>\n        <div style={menuCollapsed ? { display: \"flex\", flexDirection: \"column\", alignItems: \"center\", gap: 10, padding: \"16px 0 10px\" } : { display: \"flex\", alignItems: \"center\", justifyContent: \"space-between\", padding: \"16px 14px 10px 24px\" }}>\n","      <style>{MENU_CSS}</style>\n      {/* the menu stays in view while a long page scrolls, so the name and Log out at its bottom are always there */}\n      <nav aria-label=\"Main menu\" style={{ width: menuCollapsed ? MENU.collapsed : MENU.expanded, transition: \"width 160ms ease\", background: MENU.bg, display: \"flex\", flexDirection: \"column\", flexShrink: 0, position: \"sticky\", top: 0, height: \"100vh\", minHeight: 600, alignSelf: \"flex-start\", zIndex: 5 }}>\n        <div style={menuCollapsed ? { display: \"flex\", flexDirection: \"column\", alignItems: \"center\", gap: 10, padding: \"16px 0 10px\" } : { display: \"flex\", alignItems: \"center\", justifyContent: \"space-between\", padding: \"16px 14px 10px 24px\" }}>\n"]]}],"created":[]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-menu-sticky`, c.before);
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Refresh the admin portal (Ctrl+F5).');
