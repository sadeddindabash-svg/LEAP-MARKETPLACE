#!/usr/bin/env node
/**
 * Admin portal redesign, step 6: a real restyle of the page frame every admin page shares.
 * A navy header band on every page (small gold "LEAP ADMIN", big white title, glass search and bell, gold avatar, the page's tabs on the band),
 * navy headers on the order / supplier / ticket / return case pages, card titles with a gold mark, roomier tables with a soft gold row hover,
 * one style for every field, dropdown and button inside the pages, and slim scrollbars.
 * Run AFTER the earlier admin patches. No API change.
 *   node scripts/patch-admin-header-band.js            dry run
 *   node scripts/patch-admin-header-band.js --write    applies it
 */
const DATA = {"created": [], "replaced": [], "anchored": [{"file": "apps/admin-dashboard/src/App.jsx", "what": "Admin: navy header band on every page (title, search, bell, user and tabs on it), navy headers on order / supplier / ticket / return case pages, one style for fields, tables and buttons", "done": "data-leap-page", "pairs": [["  return (\n    <>\n    <div style={{ display: \"flex\", justifyContent: \"space-between\", alignItems: \"center\", gap: 20, padding: \"18px 28px\", borderBottom: `1px solid ${HEADER.line}`, background: HEADER.bg }}>\n      <div style={{ flex: \"1 1 auto\", minWidth: 0 }}>\n        <div style={{ ...disp, fontSize: 24, fontWeight: 800, letterSpacing: \"-0.01em\", color: HEADER.text }}>{title}</div>\n        {subtitle && <div style={{ ...body, fontSize: 12.5, color: HEADER.soft, marginTop: 2 }}>{subtitle}</div>}\n      </div>", "  const hasTabs = showGroup || Boolean(tabs && tabs.tabs.length > 0);\n  return (\n    <div data-leap-header=\"\" style={{ position: \"relative\", background: `linear-gradient(120deg, ${C.navyDeep} 0%, ${C.navy} 55%, ${C.navySoft} 130%)`, padding: hasTabs ? \"24px 32px 0\" : \"24px 32px 26px\", boxShadow: \"inset 0 -1px 0 rgba(255,255,255,0.06)\" }}>\n    {/* a soft gloss across the top, like the app's navy cards */}\n    <span aria-hidden=\"true\" style={{ position: \"absolute\", inset: \"0 0 55% 0\", background: \"linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0))\", pointerEvents: \"none\" }} />\n    <div style={{ position: \"relative\", display: \"flex\", justifyContent: \"space-between\", alignItems: \"center\", gap: 20, flexWrap: \"wrap\" }}>\n      <div style={{ flex: \"1 1 320px\", minWidth: 0 }}>\n        <div style={{ ...body, fontSize: 10.5, fontWeight: 800, letterSpacing: \"0.14em\", textTransform: \"uppercase\", color: C.signal, marginBottom: 6 }}>Leap admin</div>\n        <div style={{ ...disp, fontSize: 28, lineHeight: \"34px\", fontWeight: 800, letterSpacing: \"-0.02em\", color: HEADER.text }}>{title}</div>\n        {subtitle && <div style={{ ...body, fontSize: 13, lineHeight: \"19px\", color: HEADER.soft, marginTop: 4, maxWidth: 760 }}>{subtitle}</div>}\n      </div>", false], ["const HEADER = { bg: C.card, line: C.line, text: C.ink, soft: C.muted };", "const HEADER = { bg: C.navy, line: \"rgba(255,255,255,0.12)\", text: \"#fff\", soft: C.onNavyMuted };", false], ["          <div style={{ width: 36, height: 36, borderRadius: \"50%\", background: C.navy, color: C.signal,", "          <div style={{ width: 38, height: 38, borderRadius: \"50%\", background: C.signal, color: C.onSignal, boxShadow: \"0 0 0 3px rgba(249,179,23,0.25)\",", false], ["    {showGroup && <FolderTabs label={groupTabs.label} tabs={groupTabs.tabs} activeId={groupTabs.activeId} onSelect={groupTabs.onSelect} />}\n    {tabs && tabs.tabs.length > 0 && <FolderTabs label={tabs.label} tabs={tabs.tabs} activeId={tabs.activeId} onSelect={tabs.onSelect} maxVisible={tabs.maxVisible || 7} />}\n    </>\n  );", "    {showGroup && <FolderTabs dark label={groupTabs.label} tabs={groupTabs.tabs} activeId={groupTabs.activeId} onSelect={groupTabs.onSelect} />}\n    {tabs && tabs.tabs.length > 0 && <FolderTabs dark label={tabs.label} tabs={tabs.tabs} activeId={tabs.activeId} onSelect={tabs.onSelect} maxVisible={tabs.maxVisible || 7} />}\n    </div>\n  );", false], ["      <div style={{ display: \"flex\", alignItems: \"center\", gap: 8, height: 40, boxSizing: \"border-box\", background: C.canvas, border: `1px solid ${C.line}`, borderRadius: 10, padding: \"0 12px\" }}>\n        <Search size={15} color={C.muted} />", "      <div style={{ display: \"flex\", alignItems: \"center\", gap: 8, height: 40, boxSizing: \"border-box\", background: \"rgba(255,255,255,0.08)\", border: \"1px solid rgba(255,255,255,0.16)\", borderRadius: 10, padding: \"0 12px\" }}>\n        <Search size={15} color={C.onNavyMuted} />", false], ["          aria-label=\"Search\"\n          style={{ ...body, fontSize: 12.5, color: C.ink, border: \"none\", background: \"none\", outline: \"none\", width: \"100%\" }}", "          aria-label=\"Search\"\n          data-leap-plain=\"\"\n          style={{ ...body, fontSize: 12.5, color: \"#fff\", border: \"none\", background: \"none\", outline: \"none\", width: \"100%\" }}", false], ["        style={{ position: \"relative\", width: 40, height: 40, boxSizing: \"border-box\", background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, boxShadow: \"0 1px 2px rgba(11,49,70,0.06), 0 4px 12px rgba(11,49,70,0.06)\", cursor: \"pointer\", display: \"flex\", alignItems: \"center\", justifyContent: \"center\", padding: 0 }}\n      >\n        <Bell size={17} color={C.ink} />", "        style={{ position: \"relative\", width: 40, height: 40, boxSizing: \"border-box\", background: \"rgba(255,255,255,0.08)\", border: \"1px solid rgba(255,255,255,0.16)\", borderRadius: 10, cursor: \"pointer\", display: \"flex\", alignItems: \"center\", justifyContent: \"center\", padding: 0 }}\n      >\n        <Bell size={17} color=\"#fff\" />", false], ["table th { background: ${C.surfaceHigh}; }\n`;", "table th { background: ${C.surfaceHigh}; }\n[data-leap-header] input::placeholder { color: ${C.onNavyMuted}; }\n[data-leap-page] input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]):not([type=color]):not([data-leap-plain]), [data-leap-page] select, [data-leap-page] textarea {\n  border-radius: 10px !important; border-color: ${C.lineStrong} !important; font-family: 'Manrope', sans-serif; color: ${C.ink}; background-color: #fff;\n}\n[data-leap-page] input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]):not([type=color]):not([data-leap-plain]), [data-leap-page] select { min-height: 38px; box-sizing: border-box; }\n[data-leap-page] input::placeholder, [data-leap-page] textarea::placeholder { color: #8A93A0; }\n[data-leap-page] select { cursor: pointer; }\n[data-leap-page] button { font-family: 'Manrope', sans-serif; transition: background-color 150ms ease, box-shadow 150ms ease, transform 60ms ease, border-color 150ms ease; }\n[data-leap-page] button:not(:disabled):active { transform: translateY(1px); }\n[data-leap-page] button:disabled { cursor: not-allowed !important; }\n[data-leap-page] tbody tr { transition: background-color 120ms ease; }\n[data-leap-page] tbody tr:hover > td { background: #FDF8EA; }\n[data-leap-page] table td { font-variant-numeric: tabular-nums; }\n[data-leap-page] h1, [data-leap-page] h2, [data-leap-page] h3 { font-family: 'Manrope', sans-serif; letter-spacing: -0.01em; }\n[data-leap-page] ::-webkit-scrollbar { width: 10px; height: 10px; }\n[data-leap-page] ::-webkit-scrollbar-thumb { background: #C9D1DA; border-radius: 999px; border: 2px solid ${C.canvas}; }\n`;", false], ["          <div ref={pageBoxRef} style={{", "          <div ref={pageBoxRef} data-leap-page=\"\" style={{", false], ["<div style={{ ...body, fontSize: 12, color: C.muted, display: \"flex\", alignItems: \"center\", gap: 6 }}>", "<div style={{ ...body, fontSize: 12, color: C.muted, display: \"flex\", alignItems: \"center\", gap: 6, background: \"#fff\", borderRadius: 8, padding: \"4px 10px\", marginTop: 6, width: \"fit-content\" }}>", false]], "regex": [["<div style=\\{\\{ display: \"flex\", alignItems: \"center\", gap: 10, padding: \"18px 28px\", borderBottom: `1px solid \\$\\{C\\.line\\}`, background: C\\.card \\}\\}>(\\n\\s*)<button onClick=\\{onBack\\} aria-label=\"Back\" title=\"Back\" style=\\{\\{ width: 36, height: 36, borderRadius: 10, border: `1px solid \\$\\{C\\.line\\}`, background: C\\.card, cursor: \"pointer\", display: \"flex\", alignItems: \"center\", justifyContent: \"center\", flexShrink: 0 \\}\\}><ChevronLeft size=\\{18\\} color=\\{C\\.ink\\} /></button>", "<div data-leap-header=\"\" style={{ display: \"flex\", alignItems: \"center\", gap: 12, flexWrap: \"wrap\", padding: \"24px 32px\", background: `linear-gradient(120deg, ${C.navyDeep} 0%, ${C.navy} 55%, ${C.navySoft} 130%)` }}>$1<button onClick={onBack} aria-label=\"Back\" title=\"Back\" style={{ width: 38, height: 38, borderRadius: 10, border: \"1px solid rgba(255,255,255,0.18)\", background: \"rgba(255,255,255,0.08)\", cursor: \"pointer\", display: \"flex\", alignItems: \"center\", justifyContent: \"center\", flexShrink: 0 }}><ChevronLeft size={18} color=\"#fff\" /></button>", 12], ["\\.\\.\\.disp, fontSize: 24, fontWeight: 800, letterSpacing: \"-0.01em\", color: C\\.ink \\}\\}>", "...disp, fontSize: 26, fontWeight: 800, letterSpacing: \"-0.02em\", color: \"#fff\" }}>", 12]]}, {"file": "apps/admin-dashboard/src/components/PageChrome.jsx", "what": "Admin: page tabs on the navy header (white, gold line, gold counts)", "done": "dark = false }) {", "pairs": [["function FolderTab({ tab, active, onSelect, marked }) {", "function FolderTab({ tab, active, onSelect, marked, dark = false }) {", false], ["        background: \"transparent\", color: active ? C.ink : C.muted, position: \"relative\", transition: \"color 200ms ease\",", "        background: \"transparent\", color: dark ? (active ? \"#fff\" : C.onNavyMuted) : (active ? C.ink : C.muted), position: \"relative\", transition: \"color 200ms ease\",", false], ["fontSize: 10.5, fontWeight: 800, color: \"#fff\", background: tab.tone === \"red\" ? C.red : C.navy }}>{tab.count}</span>", "fontSize: 10.5, fontWeight: 800, color: tab.tone === \"red\" ? \"#fff\" : dark ? C.onSignal : \"#fff\", background: tab.tone === \"red\" ? C.red : dark ? C.signal : C.navy }}>{tab.count}</span>", false], ["export function FolderTabs({ label, tabs, activeId, onSelect, maxVisible = 7 }) {", "export function FolderTabs({ label, tabs, activeId, onSelect, maxVisible = 7, dark = false }) {", false], ["    <div ref={barRef} data-leap-tabbar=\"\" style={{ display: \"flex\", alignItems: \"flex-end\", gap: 2, padding: \"14px 28px 0\", background: C.card, borderBottom: `1px solid ${C.line}`, flexWrap: \"wrap\" }}>", "    <div ref={barRef} data-leap-tabbar=\"\" style={dark\n      ? { position: \"relative\", display: \"flex\", alignItems: \"flex-end\", gap: 4, padding: \"18px 0 0\", background: \"transparent\", borderBottom: \"none\", flexWrap: \"wrap\" }\n      : { display: \"flex\", alignItems: \"flex-end\", gap: 2, padding: \"14px 28px 0\", background: C.card, borderBottom: `1px solid ${C.line}`, flexWrap: \"wrap\" }}>", false], ["        {visible.map((tab) => <FolderTab key={tab.id} tab={tab} active={tab.id === activeId} onSelect={pick} marked={Boolean(mark && mark.w)} />)}", "        {visible.map((tab) => <FolderTab key={tab.id} tab={tab} active={tab.id === activeId} onSelect={pick} marked={Boolean(mark && mark.w)} dark={dark} />)}", false], ["            style={{ ...body, display: \"inline-flex\", alignItems: \"center\", gap: 4, height: TAB_HEIGHT, padding: \"0 14px\", border: \"none\", background: \"transparent\", color: C.ink, fontSize: 13, fontWeight: 700, cursor: \"pointer\" }}", "            style={{ ...body, display: \"inline-flex\", alignItems: \"center\", gap: 4, height: TAB_HEIGHT, padding: \"0 14px\", border: \"none\", background: \"transparent\", color: dark ? \"#fff\" : C.ink, fontSize: 13, fontWeight: 700, cursor: \"pointer\" }}", false]], "regex": []}, {"file": "apps/admin-dashboard/src/components/ui.jsx", "what": "Admin: card titles bold with a gold mark, roomier table rows", "done": "width: 4, height: 18, borderRadius: 4, background: C.signal", "pairs": [["        <div style={{ display: \"flex\", justifyContent: \"space-between\", alignItems: \"center\", padding: \"16px 20px\", borderBottom: `1px solid ${C.line}` }}>\n          <span style={{ ...disp, fontSize: 17, fontWeight: 700, color: C.ink }}>{title}</span>", "        <div style={{ display: \"flex\", justifyContent: \"space-between\", alignItems: \"center\", gap: 12, padding: \"16px 20px\", borderBottom: `1px solid ${C.line}`, background: \"linear-gradient(180deg, #FFFFFF, #FBFCFD)\" }}>\n          <span style={{ ...disp, display: \"inline-flex\", alignItems: \"center\", gap: 10, fontSize: 16.5, fontWeight: 800, letterSpacing: \"-0.01em\", color: C.ink }}>\n            <span aria-hidden=\"true\" style={{ width: 4, height: 18, borderRadius: 4, background: C.signal, flexShrink: 0 }} />\n            {title}\n          </span>", false], ["  return <td style={{ ...body, fontSize: 13, color: C.ink, padding: \"13px 16px\", borderBottom: `1px solid ${C.line}`, textAlign: align || \"left\", ...style }}>{children}</td>;", "  return <td style={{ ...body, fontSize: 13.5, color: C.ink, padding: \"14px 18px\", borderBottom: `1px solid ${C.line}`, textAlign: align || \"left\", verticalAlign: \"middle\", ...style }}>{children}</td>;", false], ["padding: \"10px 16px\", background: C.surfaceHigh,", "padding: \"12px 18px\", background: C.surfaceHigh,", false]], "regex": []}]};
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const plan = [];
let problems = 0;
const once = (s, a) => s.split(a).length === 2;
const read = (file) => { const p = path.join(root, file); return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null; };
function edit(file, what, done, change) {
  const s = read(file);
  if (s === null) { console.log(`MISSING   ${file}: not found. Run this from D:\\LEAP-MARKETPLACE.`); problems++; return; }
  if (s.replace(/\r\n/g, '\n').includes(done)) { console.log(`already   ${file}: ${what}`); return; }
  const eol = s.includes('\r\n') ? '\r\n' : '\n';
  const out = change(s.replace(/\r\n/g, '\n'));
  if (typeof out !== 'string') { console.log(`REFUSED   ${file}: ${out && out.why ? out.why : 'its text is not what this patch expects'}, so nothing was changed. Send this file.`); problems++; return; }
  plan.push({ file, what, before: s, after: out.replace(/\n/g, eol) });
}

for (const e of DATA.created) {
  const p = path.join(root, e.file);
  if (e.base64) {      // a picture: written as it is
    const bytes = Buffer.from(e.base64, 'base64');
    if (fs.existsSync(p)) {
      if (fs.readFileSync(p).equals(bytes)) { console.log(`already   ${e.file}: ${e.what}`); continue; }
      console.log(`REFUSED   ${e.file}: a different file with this name is already there, so nothing was changed. Send this file.`); problems++; continue;
    }
    if (!fs.existsSync(path.dirname(p))) { console.log(`MISSING   ${path.dirname(e.file)}: folder not found. Run this from D:\\LEAP-MARKETPLACE.`); problems++; continue; }
    plan.push({ file: e.file, what: e.what, before: null, after: bytes });
    continue;
  }
  if (fs.existsSync(p)) {
    if (fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n') === e.text) { console.log(`already   ${e.file}: ${e.what}`); continue; }
    console.log(`REFUSED   ${e.file}: a different file with this name is already there, so nothing was changed. Send this file.`); problems++; continue;
  }
  // a new folder (services/api/src/modules/draftPhotos) is made, but only inside one that is already there
  if (!fs.existsSync(path.dirname(path.dirname(p)))) { console.log(`MISSING   ${path.dirname(path.dirname(e.file))}: folder not found. Run this from D:\\LEAP-MARKETPLACE.`); problems++; continue; }
  plan.push({ file: e.file, what: e.what, before: null, after: e.text });
}
for (const e of DATA.replaced || []) {
  edit(e.file, e.what, e.done, (s) => (e.from.includes(s) ? e.text : { why: 'it is not the version patch-hub-label-design made (run that patch first, or send this file)' }));
}
for (const e of DATA.anchored) {
  // a test file: changed when it is there and as expected, otherwise left as it is (it does not stop the patch)
  if (e.optional) {
    const s = read(e.file);
    if (s === null) { console.log(`skipped   ${e.file}: not found (a test file; nothing to do)`); continue; }
    const n = s.replace(/\r\n/g, '\n');
    if (!n.includes(e.done) && (e.pairs.some(([a, , all]) => all !== 'maybe' && all !== 'alts' && !once(n, a)) || (e.block && (!n.includes(e.block.from) || !n.includes(e.block.to))))) { console.log(`skipped   ${e.file}: not as expected, left as it is (${e.what})`); continue; }
  }
  edit(e.file, e.what, e.done, (s) => {
    let out = s;
    for (const [a, b, all] of e.pairs) {
      if (all === 'alts') { const hit = a.find(([x]) => once(out, x)); if (!hit) return { why: `this part was not found: "${a[a.length - 1][0].split('\n').find((l) => l.trim()).trim().slice(0, 90)}"` }; out = out.replace(hit[0], () => hit[1]); continue; }
      if (all === 'maybe') { if (once(out, a)) out = out.replace(a, () => b); continue; }
      if (all) { if (!out.includes(a)) return { why: `this part was not found: "${a.split('\n').find((l) => l.trim()).trim().slice(0, 90)}"` }; out = out.split(a).join(b); continue; } if (!once(out, a)) return { why: `this part was not found: "${a.split('\n').find((l) => l.trim()).trim().slice(0, 90)}"` }; out = out.replace(a, () => b); }
    for (const [re, rep, min] of e.regex || []) { const r = new RegExp(re, 'g'); const n = (out.match(r) || []).length; if (n < min) return { why: `this part was not found: "${re.replace(/\\/g, '').slice(0, 70)}"` }; out = out.replace(r, rep); }
    if (e.region) {
      const r = e.region; const i = out.indexOf(r.from); const j = i < 0 ? -1 : out.indexOf(r.to, i);
      if (i < 0 || j < 0) return { why: `the part starting "${r.from.trim().slice(0, 60)}" was not found` };
      const seg = out.slice(i, j);
      if (r.must && !seg.includes(r.must)) return { why: `"${r.must}" was not found in the part starting "${r.from.trim().slice(0, 60)}"` };
      const changed = seg.replace(new RegExp(r.find, 'g'), r.repl);
      if (changed === seg) return { why: `nothing to change in the part starting "${r.from.trim().slice(0, 60)}"` };
      out = out.slice(0, i) + changed + out.slice(j);
    }
    if (e.block) {
      const i = out.indexOf(e.block.from); const j = i < 0 ? -1 : out.indexOf(e.block.to, i);
      if (i < 0 || j < 0) return { why: `the part starting "${e.block.from.trim().slice(0, 60)}" was not found` };
      out = out.slice(0, i) + e.block.text + out.slice(e.block.includeTo ? j + e.block.to.length : j);
    }
    return out;
  });
}
if (DATA.mount) edit('services/api/src/index.js', DATA.mount.what, DATA.mount.done, (s) => {
  const m = s.match(/\n([ \t]*)app\.use\('\/payouts', payoutsRoutes\);[^\n]*/);
  if (!m) return { why: "the line app.use('/payouts', payoutsRoutes); was not found" };
  const at = m.index + m[0].length;
  return s.slice(0, at) + `\n${m[1]}${DATA.mount.line}` + s.slice(at);
});
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) {
    const p = path.join(root, c.file);
    if (c.before !== null) fs.writeFileSync(`${p}.before-patch-admin-header-band`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Then refresh the admin portal with Ctrl+F5 (no API restart needed).');
