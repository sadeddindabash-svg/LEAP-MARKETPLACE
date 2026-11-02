#!/usr/bin/env node
/**
 * Admin portal: the page fills the space beside the menu, with no gold space around it (design E as before: a light panel, and everything in the
 * page, the title too, in one rounded container inside it). Works on top of patch-page-frame, whether patch-page-frame-2 was applied or not.
 *
 *   node scripts/patch-page-full.js            dry run
 *   node scripts/patch-page-full.js --write    applies it (App.jsx is saved as App.jsx.before-page-full first)
 *
 * A file that is not exactly what the patch expects is NOT changed. Windows (CRLF) line endings are handled. Running it twice is harmless ("already").
 */
const fs = require('fs');
const path = require('path');
const DATA = {"file": "apps/admin-dashboard/src/App.jsx", "done": "const PANEL = { bg: MENU.activeBg, inset: 16, boxRadius: 16 };", "variants": [["after patch-page-frame", [["};\n// Design E: the page is a panel on the gold (space on its top, right and bottom; on the left it meets the menu, so the chosen item flows into it),\n// and everything in the page, the title too, sits in one rounded container inside the panel, with space around it.\nconst PANEL = { bg: MENU.activeBg, gap: 14, inset: 16, radius: 20, boxRadius: 16 };\nconst MENU_CSS = `\n", "};\n// The page: a light panel filling the space beside the menu (the chosen item flows into it), and everything in the page, the title too,\n// in one rounded container inside the panel, with space around it.\nconst PANEL = { bg: MENU.activeBg, inset: 16, boxRadius: 16 };\nconst MENU_CSS = `\n"], ["      </nav>\n      <main style={{ flex: 1, minWidth: 0, display: \"flex\", margin: `${PANEL.gap}px ${PANEL.gap}px ${PANEL.gap}px 0`, background: PANEL.bg, borderRadius: `0 ${PANEL.radius}px ${PANEL.radius}px ${PANEL.radius}px`, overflow: \"hidden\", boxShadow: \"0 1px 3px rgba(36, 26, 5, 0.12)\" }}>\n        <div style={{ flex: 1, minWidth: 0, overflowY: \"auto\", padding: PANEL.inset }}>\n", "      </nav>\n      <main style={{ flex: 1, minWidth: 0, display: \"flex\", background: PANEL.bg }}>\n        <div style={{ flex: 1, minWidth: 0, overflowY: \"auto\", padding: PANEL.inset }}>\n"]]], ["after patch-page-frame-2", [["  bg: C.signal, text: \"#3D2C06\", strong: C.onSignal, soft: \"#5C4407\", line: \"#D9940F\", badge: C.ink,\n  activeBg: C.canvas, activeText: C.ink, activeIcon: \"#8A5A00\", expanded: 240, collapsed: 76,\n};\n", "  bg: C.signal, text: \"#3D2C06\", strong: C.onSignal, soft: \"#5C4407\", line: \"#D9940F\", badge: C.ink,\n  activeBg: \"#E9ECF0\", activeText: C.ink, activeIcon: \"#8A5A00\", expanded: 240, collapsed: 76,\n};\n"], ["};\n// The page: one rounded container on the gold, holding everything in the page (the title too), with gold space on its top, right and bottom;\n// on the left it meets the menu, so the chosen item flows into it.\nconst PANEL = { bg: MENU.activeBg, gap: 14, radius: 20 };\nconst MENU_CSS = `\n", "};\n// The page: a light panel filling the space beside the menu (the chosen item flows into it), and everything in the page, the title too,\n// in one rounded container inside the panel, with space around it.\nconst PANEL = { bg: MENU.activeBg, inset: 16, boxRadius: 16 };\nconst MENU_CSS = `\n"], ["      </nav>\n      <main style={{ flex: 1, minWidth: 0, display: \"flex\", margin: `${PANEL.gap}px ${PANEL.gap}px ${PANEL.gap}px 0`, background: PANEL.bg, borderRadius: `0 ${PANEL.radius}px ${PANEL.radius}px ${PANEL.radius}px`, overflow: \"hidden\", boxShadow: \"0 1px 3px rgba(36, 26, 5, 0.14)\" }}>\n        <div style={{ flex: 1, minWidth: 0, overflowY: \"auto\" }}>\n          {/* the group's tabs go to the page's header, which shows them UNDER the title (the common page design) */}\n          <PageTabsContext.Provider value={pageTabs}>\n            {content}\n          </PageTabsContext.Provider>\n        </div>\n", "      </nav>\n      <main style={{ flex: 1, minWidth: 0, display: \"flex\", background: PANEL.bg }}>\n        <div style={{ flex: 1, minWidth: 0, overflowY: \"auto\", padding: PANEL.inset }}>\n          <div style={{ minHeight: \"100%\", boxSizing: \"border-box\", background: C.canvas, border: `1px solid ${C.line}`, borderRadius: PANEL.boxRadius, overflow: \"hidden\", boxShadow: \"0 1px 2px rgba(20, 23, 28, 0.05)\" }}>\n            {/* the group's tabs go to the page's header, which shows them UNDER the title (the common page design) */}\n            <PageTabsContext.Provider value={pageTabs}>\n              {content}\n            </PageTabsContext.Provider>\n          </div>\n        </div>\n"]]]]};
const write = process.argv.includes('--write');
const p = path.join(__dirname, '..', DATA.file);
if (!fs.existsSync(p)) { console.log(`MISSING   ${DATA.file}: not found. Run this from D:\\LEAP-MARKETPLACE.`); process.exit(1); }
const s = fs.readFileSync(p, 'utf8');
const c = (x) => (s.includes('\r\n') ? x.replace(/\r?\n/g, '\r\n') : x);
if (s.includes(c(DATA.done))) { console.log(`already   ${DATA.file}: the page fills the space beside the menu`); process.exit(0); }
let out = null, which = null;
for (const [name, pairs] of DATA.variants) {
  let t = s;
  for (const [a0, b0] of pairs) { const a = c(a0), b = c(b0); if (t.split(a).length !== 2) { t = null; break; } t = t.replace(a, () => b); }
  if (t !== null) { out = t; which = name; break; }
}
if (out === null) { console.log(`REFUSED   ${DATA.file}: its text is not what this patch expects (apply patch-page-frame first), so nothing was changed. Send this file.`); process.exit(1); }
if (!write) { console.log(`would     ${DATA.file}: the page fills the space beside the menu (${which})`); console.log('\nDry run only. Add --write to apply.'); process.exit(0); }
fs.writeFileSync(`${p}.before-page-full`, s); fs.writeFileSync(p, out);
console.log(`patched   ${DATA.file}: the page fills the space beside the menu (${which})`);
console.log('\nDone. Refresh the admin portal (Ctrl+F5).');
