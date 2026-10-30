#!/usr/bin/env node
/**
 * Supplier portal: "My Drafts" is renamed "My Drafts (Not published)" (Chinese: "我的草稿（未发布）"): the Products button, the drafts page title,
 * and where Bulk upload mentions it. Apply after patch-position-optional.js.
 *
 *   node scripts/patch-drafts-name.js            dry run
 *   node scripts/patch-drafts-name.js --write    applies it (each file is saved as <file>.before-drafts-name first)
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored":[{"file":"apps/supplier-portal/src/App.jsx","what":"the button and the page are called \"My Drafts (Not published)\" / \"我的草稿（未发布）\"","done":": \"My Drafts (Not published)\"}","pairs":[["<FileSpreadsheet size={13} /> {lang === \"zh\" ? \"待完善的商品\" : \"My Drafts\"}","<FileSpreadsheet size={13} /> {lang === \"zh\" ? \"我的草稿（未发布）\" : \"My Drafts (Not published)\"}"],["<Card title={cascadeLabel('待完善的商品', 'Drafts needing completion')}","<Card title={cascadeLabel('我的草稿（未发布）', 'My Drafts (Not published)')}"],["{L('草稿请前往\"待完善\"补全缺少的内容。', 'Finish the drafts in My Drafts: each one says what it still needs.')}","{L('草稿请前往\"我的草稿（未发布）\"补全缺少的内容。', 'Finish the drafts in My Drafts (Not published): each one says what it still needs.')}"],["并在\"待完善\"中提示补全。', 'Every row can be changed here. A row with everything goes straight to review; a row still missing something is imported as a draft with what it has, and asks for the rest in My Drafts.')}","并在\"我的草稿（未发布）\"中提示补全。', 'Every row can be changed here. A row with everything goes straight to review; a row still missing something is imported as a draft with what it has, and asks for the rest in My Drafts (Not published).')}"]]},{"file":"apps/supplier-portal/src/productsToolbar.wiring.test.js","what":"the toolbar test follows the new name","done":"'\"My Drafts (Not published)\"'","pairs":[["'\"My Drafts\"'","'\"My Drafts (Not published)\"'"]]}],"created":[]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-drafts-name`, c.before);
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Reload the supplier portal with Ctrl+F5.');
