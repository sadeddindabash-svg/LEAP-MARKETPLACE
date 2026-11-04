#!/usr/bin/env node
/**
 * Website, Notifications (the page the bell opens): wider, 1024 px like the account pages instead of 672 px. On a wide screen the time moves to the end of
 * the title's line, so each notification is a line shorter. Mirrored in Arabic; on a phone nothing changes.
 *
 *   node scripts/patch-notifications-wide.js            dry run
 *   node scripts/patch-notifications-wide.js --write    applies it (the file is saved as <file>.before-notifications-wide first)
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "apps/web-storefront/app/notifications/page.tsx", "what": "the notifications page is wider (1024 px) and the time sits at the end of the line", "done": "mx-auto max-w-5xl px-4 py-10 sm:px-8\">", "pairs": [["  if (isLoading) return <div className=\"mx-auto max-w-2xl px-4 py-10 sm:px-8\" aria-busy=\"true\">", "  if (isLoading) return <div className=\"mx-auto max-w-5xl px-4 py-10 sm:px-8\" aria-busy=\"true\">"], ["  return (\n    <div className=\"mx-auto max-w-2xl px-4 py-10 sm:px-8\">", "  // 1024 px wide like the account pages; on a wide screen the time sits at the end of the title's line (on a phone it stays under the text)\n  return (\n    <div className=\"mx-auto max-w-5xl px-4 py-10 sm:px-8\">"], ["                <span className=\"min-w-0 flex-1\">\n                  <span className={`block ${n.isRead ? \"font-semibold\" : \"font-extrabold\"}`}>{n.title}</span>\n                  <span className=\"block text-sm text-muted\">{n.body}</span>\n                  <span className=\"mt-1 block text-xs text-muted\">{timeAgo(lang, n.createdAt)}</span>", "                <span className=\"grid min-w-0 flex-1 sm:grid-cols-[1fr_auto] sm:gap-x-4\">\n                  <span className={`block ${n.isRead ? \"font-semibold\" : \"font-extrabold\"}`}>{n.title}</span>\n                  <span className=\"block text-sm text-muted sm:col-start-1\">{n.body}</span>\n                  <span className=\"mt-1 block text-xs text-muted sm:col-start-2 sm:row-start-1 sm:mt-0.5 sm:whitespace-nowrap\">{timeAgo(lang, n.createdAt)}</span>"]]}], "created": []};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-notifications-wide`, c.before);
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Ctrl+F5 on the website.');
