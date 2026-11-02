#!/usr/bin/env node
/**
 * Admin portal (design E): the page is a panel on the gold, with space on its top, right and bottom (on the left it meets the menu, so the chosen
 * item flows into it), and everything in the page, the title too, sits in one rounded container inside the panel, with space around it.
 * Needs patch-side-menu first.
 *
 *   node scripts/patch-page-frame.js            dry run
 *   node scripts/patch-page-frame.js --write    applies it (App.jsx is saved as App.jsx.before-page-frame first)
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored":[{"file":"apps/admin-dashboard/src/App.jsx","what":"the page as a panel on the gold, everything in one container inside it","done":"const PANEL = { bg: MENU.activeBg","pairs":[["  bg: C.signal, text: \"#3D2C06\", strong: C.onSignal, soft: \"#5C4407\", line: \"#D9940F\", badge: C.ink,\n  activeBg: C.canvas, activeText: C.ink, activeIcon: \"#8A5A00\", expanded: 240, collapsed: 76,\n};\n","  bg: C.signal, text: \"#3D2C06\", strong: C.onSignal, soft: \"#5C4407\", line: \"#D9940F\", badge: C.ink,\n  activeBg: \"#E9ECF0\", activeText: C.ink, activeIcon: \"#8A5A00\", expanded: 240, collapsed: 76,\n};\n"],["};\nconst MENU_CSS = `\n","};\n// Design E: the page is a panel on the gold (space on its top, right and bottom; on the left it meets the menu, so the chosen item flows into it),\n// and everything in the page, the title too, sits in one rounded container inside the panel, with space around it.\nconst PANEL = { bg: MENU.activeBg, gap: 14, inset: 16, radius: 20, boxRadius: 16 };\nconst MENU_CSS = `\n"],[".leap-menu-curve { position: absolute; right: 0; width: 20px; height: 20px; pointer-events: none; clip-path: inset(0); }\n.leap-menu-curve.top { bottom: 100%; border-bottom-right-radius: 20px; box-shadow: 10px 10px 0 10px ${C.canvas}; }\n.leap-menu-curve.bottom { top: 100%; border-top-right-radius: 20px; box-shadow: 10px -10px 0 10px ${C.canvas}; }\n.leap-menu-tip { display: none; position: absolute; left: calc(100% + 6px); top: 50%; transform: translateY(-50%); height: 30px; padding: 0 10px; border-radius: 8px;\n",".leap-menu-curve { position: absolute; right: 0; width: 20px; height: 20px; pointer-events: none; clip-path: inset(0); }\n.leap-menu-curve.top { bottom: 100%; border-bottom-right-radius: 20px; box-shadow: 10px 10px 0 10px ${MENU.activeBg}; }\n.leap-menu-curve.bottom { top: 100%; border-top-right-radius: 20px; box-shadow: 10px -10px 0 10px ${MENU.activeBg}; }\n.leap-menu-tip { display: none; position: absolute; left: calc(100% + 6px); top: 50%; transform: translateY(-50%); height: 30px; padding: 0 10px; border-radius: 8px;\n"],["    }}>\n    <div style={{ display: \"flex\", height: \"100%\", minHeight: 700, background: C.canvas, ...body }}>\n      <style>{FONT_IMPORT}</style>\n","    }}>\n    <div style={{ display: \"flex\", height: \"100%\", minHeight: 700, background: MENU.bg, ...body }}>\n      <style>{FONT_IMPORT}</style>\n"],["      </nav>\n      <div style={{ flex: 1, overflowY: \"auto\" }}>\n        {/* the group's tabs go to the page's header, which shows them UNDER the title (the common page design) */}\n        <PageTabsContext.Provider value={pageTabs}>\n          {content}\n        </PageTabsContext.Provider>\n      </div>\n    </div>\n","      </nav>\n      <main style={{ flex: 1, minWidth: 0, display: \"flex\", margin: `${PANEL.gap}px ${PANEL.gap}px ${PANEL.gap}px 0`, background: PANEL.bg, borderRadius: `0 ${PANEL.radius}px ${PANEL.radius}px ${PANEL.radius}px`, overflow: \"hidden\", boxShadow: \"0 1px 3px rgba(36, 26, 5, 0.12)\" }}>\n        <div style={{ flex: 1, minWidth: 0, overflowY: \"auto\", padding: PANEL.inset }}>\n          <div style={{ minHeight: \"100%\", boxSizing: \"border-box\", background: C.canvas, border: `1px solid ${C.line}`, borderRadius: PANEL.boxRadius, overflow: \"hidden\", boxShadow: \"0 1px 2px rgba(20, 23, 28, 0.05)\" }}>\n            {/* the group's tabs go to the page's header, which shows them UNDER the title (the common page design) */}\n            <PageTabsContext.Provider value={pageTabs}>\n              {content}\n            </PageTabsContext.Provider>\n          </div>\n        </div>\n      </main>\n    </div>\n"]]}],"created":[]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-page-frame`, c.before);
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Refresh the admin portal (Ctrl+F5).');
