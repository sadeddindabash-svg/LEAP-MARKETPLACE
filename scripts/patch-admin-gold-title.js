#!/usr/bin/env node
/**
 * Admin portal: the title bar at the top of every page in the SAME golden yellow as the side menu (C.signal), with dark text on it: the title,
 * the line under it, your name and role use the menu's own dark tones, and the bar's bottom line the menu's darker gold. Search and the bell
 * stay white; the tabs under the bar stay as they are. One setting changes: HEADER in apps/admin-dashboard/src/App.jsx (it was white).
 *
 *   node scripts/patch-admin-gold-title.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-admin-gold-title.js --write    applies it (the file is saved as App.jsx.before-admin-gold-title first)
 *
 * Windows (CRLF) line endings are handled. Running it twice is harmless ("already").
 */
const fs = require('fs');
const path = require('path');
const rel = 'apps/admin-dashboard/src/App.jsx';
const file = path.join(__dirname, '..', ...rel.split('/'));
const write = process.argv.includes('--write');
const GOLD = 'const HEADER = { bg: C.signal, line: "#D9940F", text: C.onSignal, soft: "#5C4407" };      // golden yellow, the same as the side menu, with dark text';
const AVATAR_OLD = 'background: C.ink, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", ...body, fontWeight: 700, fontSize: 12.5 }}>{initials}</div>';
const AVATAR_NEW = 'background: C.ink, color: C.signal, display: "flex", alignItems: "center", justifyContent: "center", ...body, fontWeight: 700, fontSize: 12.5 }}>{initials}</div>';

if (!fs.existsSync(file)) { console.log(`MISSING   ${rel}: not found. Run this from D:\\LEAP-MARKETPLACE.`); process.exit(1); }
const original = fs.readFileSync(file, 'utf8');
const eol = original.includes('\r\n') ? '\r\n' : '\n';
let s = original.replace(/\r\n/g, '\n');
if (s.includes(GOLD)) { console.log(`already   ${rel}: every page's title bar in the side menu's gold`); process.exit(0); }
const line = s.match(/\nconst HEADER = \{[^}\n]*\};[^\n]*/);
if (!line) { console.log(`REFUSED   ${rel}: the title bar's colours (const HEADER = { ... }) were not found, so nothing was changed. Send this file.`); process.exit(1); }
s = s.replace(line[0], () => `\n${GOLD}`);
const avatar = s.split(AVATAR_OLD).length === 2;              // your initials: gold on the dark circle (left as they are if that line is different)
if (avatar) s = s.replace(AVATAR_OLD, () => AVATAR_NEW);
const out = s.replace(/\n/g, eol);
if (!write) { console.log(`would     ${rel}: every page's title bar in the side menu's gold${avatar ? ' (and gold initials)' : ''}`); console.log('\nDry run only. Add --write to apply.'); process.exit(0); }
fs.writeFileSync(`${file}.before-admin-gold-title`, original);
fs.writeFileSync(file, out);
console.log(`patched   ${rel}: every page's title bar in the side menu's gold${avatar ? ' (and gold initials)' : ''}`);
console.log('\nDone. Ctrl+F5 in the admin portal.');
