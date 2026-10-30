#!/usr/bin/env node
/**
 * Supplier portal, Finance: Payout history (left, wider) and Payout account (right) in the same row; they stack on a narrow window.
 * Apply after patch-products-export.js.
 *
 *   node scripts/patch-finance-row.js            dry run
 *   node scripts/patch-finance-row.js --write    applies it (App.jsx is saved as App.jsx.before-finance-row first)
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored":[{"file":"apps/supplier-portal/src/App.jsx","what":"Finance: Payout history and Payout account in the same row","done":"data-testid=\"finance-payouts-row\"","pairs":[["            <Card title={fi.recordsTitle}>","          </>\n        )}\n        {/* Payout history and Payout account in the same row (they stack on a narrow window). */}\n        <div data-testid=\"finance-payouts-row\" style={{ display: \"flex\", gap: 16, alignItems: \"flex-start\", flexWrap: \"wrap\" }}>\n        {finance && (\n          <div style={{ flex: \"2 1 520px\", minWidth: 0 }}>\n            <Card title={fi.recordsTitle}>"],["{fi.returnCaseNote}</div>\n            </Card>\n          </>\n        )}\n        <Card title={fi.bankTitle}>","{fi.returnCaseNote}</div>\n            </Card>\n          </div>\n        )}\n        <div style={{ flex: \"1 1 320px\", minWidth: 0 }}>\n        <Card title={fi.bankTitle}>"],["                  )}\n                </div>\n              </div>\n            )}\n          </div>\n        </Card>\n      </div>\n    </div>\n  );\n}","                  )}\n                </div>\n              </div>\n            )}\n          </div>\n        </Card>\n        </div>\n        </div>\n      </div>\n    </div>\n  );\n}"]]}],"created":[{"file":"apps/supplier-portal/src/financeLayout.wiring.test.js","what":"the test","text":"import { readFileSync } from \"node:fs\";\nimport { describe, expect, it } from \"vitest\";\n\n// Finance: Payout history and Payout account in the same row. Reads the source text.\ndescribe(\"Finance layout\", () => {\n  const app = readFileSync(\"src/App.jsx\", \"utf8\");\n  it(\"the two cards share one row\", () => {\n    const row = app.indexOf('data-testid=\"finance-payouts-row\"');\n    expect(row).toBeGreaterThan(-1);\n    expect(app.indexOf(\"<Card title={fi.recordsTitle}>\", row)).toBeGreaterThan(row);\n    expect(app.indexOf(\"<Card title={fi.bankTitle}>\", row)).toBeGreaterThan(app.indexOf(\"<Card title={fi.recordsTitle}>\", row));\n  });\n});\n"}]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-finance-row`, c.before);
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Reload the supplier portal with Ctrl+F5.');
