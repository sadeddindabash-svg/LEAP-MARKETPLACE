#!/usr/bin/env node
/**
 * Website: Notifications joins the account menu (second, under My account). The bell beside the cart opens it with the menu beside it and Notifications
 * marked, under the same title box as the other menu pages ("Updates on your orders, returns, support replies and saved parts."). English and Arabic.
 *
 *   node scripts/patch-notifications-menu.js            dry run
 *   node scripts/patch-notifications-menu.js --write    applies it (each changed file is saved as <file>.before-notifications-menu first)
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "apps/web-storefront/components/AccountShell.tsx", "what": "Notifications in the account menu (under My account); the bell opens it with the menu beside it", "done": "[\"/notifications\", \"notifications\", \"acct_desc_notifications\"]", "pairs": [["[\"/account\", \"account_hub_title\", \"acct_desc_account\"], ", "[\"/account\", \"account_hub_title\", \"acct_desc_account\"], [\"/notifications\", \"notifications\", \"acct_desc_notifications\"], "]]}, {"file": "apps/web-storefront/lib/i18n.ts", "what": "the line under the Notifications title (English and Arabic)", "done": "acct_desc_notifications:", "pairs": [["  acct_desc_saved: \"Searches you saved, to run again in one click.\",\n", "  acct_desc_saved: \"Searches you saved, to run again in one click.\",\n  acct_desc_notifications: \"Updates on your orders, returns, support replies and saved parts.\",\n"], ["  acct_desc_saved: \"\u0639\u0645\u0644\u064a\u0627\u062a \u0627\u0644\u0628\u062d\u062b \u0627\u0644\u062a\u064a \u062d\u0641\u0638\u062a\u0647\u0627 \u0644\u062a\u0639\u064a\u062f\u0647\u0627 \u0628\u0646\u0642\u0631\u0629 \u0648\u0627\u062d\u062f\u0629.\",\n", "  acct_desc_saved: \"\u0639\u0645\u0644\u064a\u0627\u062a \u0627\u0644\u0628\u062d\u062b \u0627\u0644\u062a\u064a \u062d\u0641\u0638\u062a\u0647\u0627 \u0644\u062a\u0639\u064a\u062f\u0647\u0627 \u0628\u0646\u0642\u0631\u0629 \u0648\u0627\u062d\u062f\u0629.\",\n  acct_desc_notifications: \"\u062a\u062d\u062f\u064a\u062b\u0627\u062a \u0637\u0644\u0628\u0627\u062a\u0643 \u0648\u0645\u0631\u062a\u062c\u0639\u0627\u062a\u0643 \u0648\u0631\u062f\u0648\u062f \u0627\u0644\u062f\u0639\u0645 \u0648\u0627\u0644\u0642\u0637\u0639 \u0627\u0644\u0645\u062d\u0641\u0648\u0638\u0629.\",\n"]]}, {"file": "apps/web-storefront/app/notifications/page.tsx", "what": "\"Mark all read\" stays at the end of the line beside the menu", "done": "className=\"ms-auto inline-flex min-h-11", "pairs": [["<button type=\"button\" className=\"inline-flex min-h-11 items-center rounded-[10px] border-[1.5px] border-navy px-4 text-sm font-bold text-navy hover:bg-chalk\"\n            onClick={() => { const token = getAuthToken(); if (!token) return; setItems(", "<button type=\"button\" className=\"ms-auto inline-flex min-h-11 items-center rounded-[10px] border-[1.5px] border-navy px-4 text-sm font-bold text-navy hover:bg-chalk\"\n            onClick={() => { const token = getAuthToken(); if (!token) return; setItems("]]}, {"file": "apps/web-storefront/components/AccountShell.test.tsx", "what": "tests", "done": "toHaveLength(13)", "pairs": [["\"/account/two-factor\", \"/contact\"]) expect(inAccountMenu(p), p).toBe(true);", "\"/account/two-factor\", \"/contact\", \"/notifications\"]) expect(inAccountMenu(p), p).toBe(true);"], ["expect(screen.getAllByRole(\"link\")).toHaveLength(12);", "expect(screen.getAllByRole(\"link\")).toHaveLength(13);"], ["/\\.account-page > \\*, \\.account-body > \\* \\{ margin-inline-start: 0 !important;", "/\\.account-page > \\*, \\.account-body > \\*(, \\.account-sub > \\*)? \\{ margin-inline-start: 0 !important;"]]}], "created": []};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-notifications-menu`, c.before);
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Ctrl+F5 on the website.');
