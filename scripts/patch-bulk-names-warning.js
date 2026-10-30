#!/usr/bin/env node
/**
 * Bulk upload: a row whose OE Number, Item Name and Price are filled is imported even when its name is outside the name length rule
 * (the rule shows as a warning, before and after the import). The results table shows Row | OE Number | Name | Price | Status.
 * Apply after patch-name-minimums.js.
 *
 *   node scripts/patch-bulk-names-warning.js            dry run
 *   node scripts/patch-bulk-names-warning.js --write    applies it (each changed file is saved as <file>.before-bulk-names-warning first)
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored":[{"file":"services/api/src/modules/supplier/routes.js","what":"bulk import: a row with OE number, name and price is imported even outside the name rule (a warning)","done":"nameWarning: nameWarning || null","pairs":[["      const nameLengthError = validateSupplierName(itemName, 'itemName', supplierNameMinimums(requirements));   // a row outside the rules is not imported\n      if (nameLengthError) {\n        results.push({ index: i, success: false, error: nameLengthError });\n        continue;\n      }\n","      // A row with its three cells filled is imported even when its name is outside the name rule: the rule is reported as a warning.\n      const nameWarning = validateSupplierName(itemName, 'itemName', supplierNameMinimums(requirements));\n"],["      results.push({ index: i, success: true, productId: id, status, missing });","      results.push({ index: i, success: true, productId: id, status, missing, nameWarning: nameWarning || null });"]]},{"file":"apps/supplier-portal/src/App.jsx","what":"bulk upload: the name rule is a warning; the results show Row, OE Number, Name, Price, Status","done":"data-testid={`bulk-name-warning-${i}`}","pairs":[["    if (!supplierNameRule(r.itemName, requirements).ok) return 'name';      // outside the name rule: shown in red, not imported\n",""],["个字符（现有 ${rule.length}），不会导入`, `Name too long: at most ${rule.max} characters (has ${rule.length}), not imported`)","个字符（现有 ${rule.length}），仍会导入`, `Name too long: at most ${rule.max} characters (has ${rule.length}), still imported`)"],["个字符（现有 ${rule.length}），不会导入`, `Name too short: at least ${rule.min} characters (has ${rule.length}), not imported`);","个字符（现有 ${rule.length}），仍会导入`, `Name too short: at least ${rule.min} characters (has ${rule.length}), still imported`);"],["              {(counts.name || 0) > 0 && chip(L(`${counts.name} 行名称不符合要求（不会导入）`, `${counts.name} names outside the rules (not imported)`), C.red, '#FBE7E5')}","              {rows.filter((r) => !supplierNameRule(r.itemName, requirements).ok).length > 0 && chip(L(`${rows.filter((r) => !supplierNameRule(r.itemName, requirements).ok).length} 行名称不符合字数要求（仍会导入）`, `${rows.filter((r) => !supplierNameRule(r.itemName, requirements).ok).length} names outside the length rule (still imported)`), ...AMBER)}"],["              {rows.length - (counts.ready || 0) - (counts.name || 0) > 0 && chip(L(`${rows.length - (counts.ready || 0) - (counts.name || 0)} 行将成为草稿`, `${rows.length - (counts.ready || 0) - (counts.name || 0)} will be drafts`), ...AMBER)}","              {rows.length - (counts.ready || 0) > 0 && chip(L(`${rows.length - (counts.ready || 0)} 行将成为草稿`, `${rows.length - (counts.ready || 0)} will be drafts`), ...AMBER)}"],["                          {state === 'name' ? chip(nameRuleText(r), C.red, '#FBE7E5')\n                            : state === 'ready' ?","                          {state === 'ready' ?"],["                          {r.rowError && <div style={{ ...font, fontSize: 11, color: C.red, marginTop: 4, maxWidth: 220 }}>{r.rowError}</div>}","                          {!supplierNameRule(r.itemName, requirements).ok && <div data-testid={`bulk-name-warning-${i}`} style={{ ...font, fontSize: 11, color: '#8A5A12', marginTop: 4, maxWidth: 240 }}>{nameRuleText(r)}</div>}\n                          {r.rowError && <div style={{ ...font, fontSize: 11, color: C.red, marginTop: 4, maxWidth: 220 }}>{r.rowError}</div>}"],["            <thead><tr><Th>{L('行', 'Row')}</Th><Th>OE Number</Th><Th>{L('状态', 'Status')}</Th></tr></thead>","            <thead><tr><Th>{L('行', 'Row')}</Th><Th>OE Number</Th><Th>{L('名称', 'Name')}</Th><Th align=\"right\">{L('价格 (¥)', 'Price (¥)')}</Th><Th>{L('状态', 'Status')}</Th></tr></thead>"],["                  <Td>{rows[r.index]?.oemNumber}</Td>\n                  <Td>{!r.success ?","                  <Td>{rows[r.index]?.oemNumber}</Td>\n                  <Td>{rows[r.index]?.itemName}</Td>\n                  <Td align=\"right\">{rows[r.index]?.price ?? '—'}</Td>\n                  <Td>{!r.success ?"],["                    : chip(L(`草稿：缺少 ${(r.missing || []).map(missingText).join('、')}`, `Draft: needs ${(r.missing || []).map(missingText).join(', ')}`), ...AMBER)}</Td>","                    : chip(L(`草稿：缺少 ${(r.missing || []).map(missingText).join('、')}`, `Draft: needs ${(r.missing || []).map(missingText).join(', ')}`), ...AMBER)}\n                    {r.success && r.nameWarning && <div style={{ ...font, fontSize: 11, color: '#8A5A12', marginTop: 4 }}>{L('名称不符合字数要求', 'Name outside the length rule')}</div>}</Td>"]]},{"file":"apps/supplier-portal/src/nameRule.wiring.test.js","what":"the tests follow the new behaviour","done":"names outside the length rule (still imported)","pairs":[["  it(\"Bulk upload shows a row outside the rule in red and does not count it as ready or draft\", () => {\n    expect(app).toContain(\"if (!supplierNameRule(r.itemName, requirements).ok) return 'name';\");\n    expect(app).toContain(\"names outside the rules (not imported)\");\n  });","  it(\"Bulk upload imports a row whose three cells are filled even outside the name rule, and shows the rule as a warning\", () => {\n    expect(app).not.toContain(\"return 'name';\");\n    expect(app).toContain(\"names outside the length rule (still imported)\");\n    expect(app).toContain(\"data-testid={`bulk-name-warning-${i}`}\");\n  });\n  it(\"the results show Row, OE Number, Name, Price and Status\", () => {\n    expect(app).toContain(\"<Th>{L('名称', 'Name')}</Th><Th align=\\\"right\\\">{L('价格 (¥)', 'Price (¥)')}</Th>\");\n  });"]]}],"created":[]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-bulk-names-warning`, c.before);
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Restart with start-all (the server changed), then reload the supplier portal with Ctrl+F5.');
