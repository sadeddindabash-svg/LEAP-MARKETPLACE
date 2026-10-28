/**
 * Fixes the discount tag and the brand logo on a product card so that they are on OPPOSITE sides in both languages (the logo at the start, the discount at the end: left and right in English, right and left in Arabic).
 * It repairs what made them land on top of each other in Arabic: a tag told to read left-to-right on the element itself (dir="ltr", which also pins its position to the right), or a fixed right-/left- instead of end-/start-.
 *
 *   node scripts/fix-card-discount-tag.js            says what it found and what it would change; writes nothing
 *   node scripts/fix-card-discount-tag.js --write    applies it (each changed file is saved as <file>.before-card-tag-fix first)
 *
 * It changes nothing when the files are already right ("already correct"), and it stops without changing anything when it cannot find the card's tag (it then prints the lines it looked at so they can be sent for a closer look).
 */
const fs = require('fs');
const path = require('path');
const write = process.argv.includes('--write');
const root = path.resolve(__dirname, '..');
const dir = process.env.CARD_DIR || path.join(root, 'apps', 'web-storefront', 'components');

function load(name) { const p = path.join(dir, name); if (!fs.existsSync(p)) return null; return { p, text: fs.readFileSync(p, 'utf8') }; }
const card = load('ProductCard.tsx'); const badge = load('BrandBadge.tsx');
if (!card) { console.log('Could not find ' + path.join(dir, 'ProductCard.tsx') + '. Run this from the project folder (D:\\LEAP-MARKETPLACE).'); process.exit(1); }

const changes = []; const out = {};
// ---- the discount tag, in ProductCard.tsx (one line)
const eol = card.text.includes('\r\n') ? '\r\n' : '\n'; const lines = card.text.split(/\r?\n/);
const at = lines.findIndex((l) => l.includes('data-testid="discount-tag"'));
if (at < 0) { console.log('The discount tag (data-testid="discount-tag") was not found in ProductCard.tsx, so nothing was changed. The lines about it:'); lines.forEach((l, i) => { if (/discount|percent/i.test(l)) console.log('  ' + (i + 1) + ': ' + l.trim().slice(0, 200)); }); process.exit(1); }
let line = lines[at]; const before = line;
const open = /<span\b[^>]*data-testid="discount-tag"[^>]*>/.exec(line);
if (open) {
  let tag = open[0];
  if (/\sdir="ltr"/.test(tag)) { tag = tag.replace(/\sdir="ltr"/, ''); changes.push('the tag no longer has dir="ltr" on itself (that pinned it to the right in Arabic)'); }
  tag = tag.replace(/\bright-(\d+(?:\.\d+)?)/, (m, n) => { changes.push('the tag uses end-' + n + ' instead of right-' + n); return 'end-' + n; }).replace(/\bleft-(\d+(?:\.\d+)?)/, (m, n) => { changes.push('the tag uses start-' + n + ' instead of left-' + n); return 'start-' + n; });
  line = line.replace(open[0], tag);
}
if (!/<bdi\b/.test(line) && line.includes('-{percent}%</span>')) { line = line.replace('-{percent}%</span>', '<bdi dir="ltr">-{percent}%</bdi></span>'); changes.push('the "-29%" text keeps its own left-to-right order inside the tag (<bdi dir="ltr">)'); }
if (line !== before) { lines[at] = line; out[card.p] = { text: lines.join(eol), note: 'ProductCard.tsx' }; }
// ---- the brand logo, in BrandBadge.tsx
if (badge) {
  const bl = badge.text.split(/\r?\n/); const bi = bl.findIndex((l) => l.includes('data-testid="brand-badge"'));
  if (bi >= 0) { const b0 = bl[bi]; let b1 = b0.replace(/\bleft-(\d+(?:\.\d+)?)/, (m, n) => { changes.push('the logo uses start-' + n + ' instead of left-' + n); return 'start-' + n; }).replace(/\bright-(\d+(?:\.\d+)?)/, (m, n) => { changes.push('the logo uses end-' + n + ' instead of right-' + n + ' (the logo belongs at the START)'); return 'start-' + n; }); const bo = /<span\b[^>]*data-testid="brand-badge"[^>]*>/.exec(b1); if (bo && /\sdir="ltr"/.test(bo[0])) { b1 = b1.replace(bo[0], bo[0].replace(/\sdir="ltr"/, '')); changes.push('the logo no longer has dir="ltr" on itself'); } if (b1 !== b0) { bl[bi] = b1; out[badge.p] = { text: bl.join(badge.text.includes('\r\n') ? '\r\n' : '\n'), note: 'BrandBadge.tsx' }; } }
}
if (Object.keys(out).length === 0) { console.log('already correct: the discount tag is at the end and the logo at the start (nothing to change in ' + (badge ? 'ProductCard.tsx and BrandBadge.tsx' : 'ProductCard.tsx') + ').'); console.log('The tag line is: ' + before.trim().slice(0, 260)); process.exit(0); }
console.log((write ? 'Changing: ' : 'Would change: ') + changes.join('; '));
for (const [p, v] of Object.entries(out)) { if (write) { fs.copyFileSync(p, p + '.before-card-tag-fix'); fs.writeFileSync(p, v.text); console.log('  fixed ' + v.note + ' (saved the old one as ' + path.basename(p) + '.before-card-tag-fix)'); } else console.log('  would fix ' + v.note); }
if (!write) console.log('Nothing was written. Run again with --write to apply.');
