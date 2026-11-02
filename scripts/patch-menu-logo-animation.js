#!/usr/bin/env node
/**
 * Admin, supplier and hub portals: the logo at the top of the menu (the hub's top bar) is drawn like an engraving each time a portal opens, like on
 * the sign-in page (public/brand/leap-logo-animated.svg); the still logo if that file is missing. Needs patch-logo-files and patch-logo-animation first.
 *
 *   node scripts/patch-menu-logo-animation.js            dry run
 *   node scripts/patch-menu-logo-animation.js --write    applies it (each changed file is saved as <file>.before-menu-logo-animation first)
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored":[{"file":"apps/admin-dashboard/src/components/PageChrome.jsx","what":"admin: the menu logo is drawn when the portal opens","done":"const LOGO_ANIMATED_URL","pairs":[["export const LOGO_URL = \"/brand/leap-logo.png\";\nexport function BrandLogo({ size = 36, tint = C.signal, label = \"\" }) {\n","export const LOGO_URL = \"/brand/leap-logo.png\";\n// The logo drawn like an engraving when the portal opens (the same as the sign-in page, the website and the apps); the still logo if it is missing.\nconst LOGO_ANIMATED_URL = \"/brand/leap-logo-animated.svg\";\nexport function BrandLogo({ size = 36, tint = C.signal, label = \"\" }) {\n"],["export function BrandLogo({ size = 36, tint = C.signal, label = \"\" }) {\n  const [failed, setFailed] = useState(false);\n  if (failed) {\n    return (\n","export function BrandLogo({ size = 36, tint = C.signal, label = \"\" }) {\n  const [tried, setTried] = useState(0);      // 0: the animated logo, 1: the still logo, 2: neither could be loaded (the stand-in mark)\n  if (tried >= 2) {\n    return (\n"],["  }\n  return <img src={LOGO_URL} alt={label} width={size} height={size} onError={() => setFailed(true)} style={{ width: size, height: size, objectFit: \"contain\", borderRadius: \"50%\", flexShrink: 0, display: \"block\", boxShadow: \"0 0 0 2px rgba(255, 255, 255, 0.85)\" }} />;      // a thin white ring: the round gold logo stays clear on the gold menu\n}\n","  }\n  return <img src={tried === 0 ? LOGO_ANIMATED_URL : LOGO_URL} alt={label} width={size} height={size} onError={() => setTried((n) => n + 1)} style={{ width: size, height: size, objectFit: \"contain\", borderRadius: \"50%\", flexShrink: 0, display: \"block\", boxShadow: \"0 0 0 2px rgba(255, 255, 255, 0.85)\" }} />;      // a thin white ring: the round gold logo stays clear on the gold menu\n}\n"]]},{"file":"apps/supplier-portal/src/components/PageChrome.jsx","what":"supplier: the menu logo is drawn when the portal opens","done":"const LOGO_ANIMATED_URL","pairs":[["export const LOGO_URL = \"/brand/leap-logo.png\";\nexport function BrandLogo({ size = 36, tint = C.signal, label = \"\" }) {\n","export const LOGO_URL = \"/brand/leap-logo.png\";\n// The logo drawn like an engraving when the portal opens (the same as the sign-in page, the website and the apps); the still logo if it is missing.\nconst LOGO_ANIMATED_URL = \"/brand/leap-logo-animated.svg\";\nexport function BrandLogo({ size = 36, tint = C.signal, label = \"\" }) {\n"],["export function BrandLogo({ size = 36, tint = C.signal, label = \"\" }) {\n  const [failed, setFailed] = useState(false);\n  if (failed) {\n    return (\n","export function BrandLogo({ size = 36, tint = C.signal, label = \"\" }) {\n  const [tried, setTried] = useState(0);      // 0: the animated logo, 1: the still logo, 2: neither could be loaded (the stand-in mark)\n  if (tried >= 2) {\n    return (\n"],["  }\n  return <img src={LOGO_URL} alt={label} width={size} height={size} onError={() => setFailed(true)} style={{ width: size, height: size, objectFit: \"contain\", borderRadius: \"50%\", flexShrink: 0, display: \"block\", boxShadow: \"0 0 0 2px rgba(255, 255, 255, 0.85)\" }} />;      // a thin white ring: the round gold logo stays clear on the gold menu\n}\n","  }\n  return <img src={tried === 0 ? LOGO_ANIMATED_URL : LOGO_URL} alt={label} width={size} height={size} onError={() => setTried((n) => n + 1)} style={{ width: size, height: size, objectFit: \"contain\", borderRadius: \"50%\", flexShrink: 0, display: \"block\", boxShadow: \"0 0 0 2px rgba(255, 255, 255, 0.85)\" }} />;      // a thin white ring: the round gold logo stays clear on the gold menu\n}\n"]]},{"file":"apps/hub-portal/src/App.jsx","what":"hub: the top bar logo is drawn when the portal opens","done":"const LOGO_ANIMATED_URL","pairs":[["const LOGO_URL = \"/brand/leap-logo.png\";\nfunction BrandLogo({ size = 36, tint = C.signal, label = \"\" }) {\n","const LOGO_URL = \"/brand/leap-logo.png\";\n// The logo drawn like an engraving when the portal opens (the same as the sign-in page, the website and the apps); the still logo if it is missing.\nconst LOGO_ANIMATED_URL = \"/brand/leap-logo-animated.svg\";\nfunction BrandLogo({ size = 36, tint = C.signal, label = \"\" }) {\n"],["function BrandLogo({ size = 36, tint = C.signal, label = \"\" }) {\n  const [failed, setFailed] = useState(false);\n  if (failed) {\n    return (\n","function BrandLogo({ size = 36, tint = C.signal, label = \"\" }) {\n  const [tried, setTried] = useState(0);      // 0: the animated logo, 1: the still logo, 2: neither could be loaded (the stand-in mark)\n  if (tried >= 2) {\n    return (\n"],["  }\n  return <img src={LOGO_URL} alt={label} width={size} height={size} onError={() => setFailed(true)} style={{ width: size, height: size, objectFit: \"contain\", borderRadius: \"50%\", flexShrink: 0, display: \"block\", boxShadow: \"0 0 0 2px rgba(255, 255, 255, 0.85)\" }} />;      // a thin white ring: the round gold logo stays clear on the gold menu\n}\n","  }\n  return <img src={tried === 0 ? LOGO_ANIMATED_URL : LOGO_URL} alt={label} width={size} height={size} onError={() => setTried((n) => n + 1)} style={{ width: size, height: size, objectFit: \"contain\", borderRadius: \"50%\", flexShrink: 0, display: \"block\", boxShadow: \"0 0 0 2px rgba(255, 255, 255, 0.85)\" }} />;      // a thin white ring: the round gold logo stays clear on the gold menu\n}\n"]]}],"created":[]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-menu-logo-animation`, c.before);
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Refresh the admin, supplier and hub portals (Ctrl+F5).');
