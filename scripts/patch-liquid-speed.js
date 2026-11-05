#!/usr/bin/env node
/**
 * The speed of the liquid bottom menu (website on a phone + buyer app). Choose it in milliseconds; you can run it again with another number.
 * The drop slides in that time; the icon rises a little faster (0.82 x); the stretch and the gold circle's pop follow the slide.
 *
 *   node scripts/patch-liquid-speed.js 300            dry run (300 ms; any number from 150 to 800)
 *   node scripts/patch-liquid-speed.js 300 --write    applies it (each changed file is saved as <file>.before-liquid-speed first)
 * Then: Ctrl+F5 on the website (on the phone); buyer app: q, then flutter run --dart-define=API_BASE_URL=http://192.168.0.210:4000
 * Run patch-liquid-menu first. Windows (CRLF) line endings are kept. A file that is not as expected is NOT changed (nothing is changed then).
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const arg = process.argv.slice(2).find((a) => /^\d+$/.test(a));
const ms = arg ? Number(arg) : 300;
if (ms < 150 || ms > 800) { console.log('Choose a speed from 150 to 800 (milliseconds), e.g. node scripts/patch-liquid-speed.js 300'); process.exit(1); }
const icon = Math.round(ms * 0.82);
const sec = (n) => `${(n / 1000).toString().replace(/^0/, '')}s`;   // 300 -> ".3s"

// each rule: what to find (it must be there) and what it becomes
const FILES = [
  { file: 'apps/web-storefront/components/MobileTabBar.tsx', what: 'website phone menu', rules: [
    [/transition-\[inset-inline-start\] duration-\[\d+ms\]/g, `transition-[inset-inline-start] duration-[${ms}ms]`, 1],
    [/leap-liquid-icon transition-transform duration-\[\d+ms\]/g, `leap-liquid-icon transition-transform duration-[${icon}ms]`, 1],
    [/ring-2 ring-navy transition-transform duration-\[\d+ms\]/g, `ring-2 ring-navy transition-transform duration-[${icon}ms]`, 1],
    [/animation: leap-liquid-stretch [\d.]+s/g, `animation: leap-liquid-stretch ${sec(ms)}`, 1],
    [/animation: leap-liquid-pop [\d.]+s/g, `animation: leap-liquid-pop ${sec(ms)}`, 1],
  ] },
  { file: 'apps/mobile/lib/widgets/liquid_nav_bar.dart', what: 'buyer app menu', rules: [
    [/duration: const Duration\(milliseconds: \d+\), value: 1\)/g, `duration: const Duration(milliseconds: ${ms}), value: 1)`, 1],
    [/Duration\(milliseconds: still \? 0 : \d+\)/g, `Duration(milliseconds: still ? 0 : ${icon})`, 1],
  ] },
];

const plan = [];
let problems = 0;
for (const f of FILES) {
  const p = path.join(root, f.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${f.file}: not found. Run this from D:\\LEAP-MARKETPLACE, after patch-liquid-menu.`); problems++; continue; }
  const before = fs.readFileSync(p, 'utf8');
  let after = before;
  for (const [re, to, n] of f.rules) {
    const found = (after.match(re) || []).length;
    if (found !== n) { console.log(`REFUSED   ${f.file}: it is not the version patch-liquid-menu made (send this file), so nothing was changed.`); problems++; after = null; break; }
    after = after.replace(re, () => to);
  }
  if (after === null) continue;
  if (after === before) console.log(`already   ${f.file}: ${f.what} at ${ms} ms`);
  else plan.push({ p, f, before, after });
}
if (problems) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) { fs.writeFileSync(`${c.p}.before-liquid-speed`, c.before); fs.writeFileSync(c.p, c.after); console.log(`patched   ${c.f.file}: ${c.f.what} at ${ms} ms`); }
  else console.log(`would     ${c.f.file}: ${c.f.what} at ${ms} ms`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Then: Ctrl+F5 on the website (on the phone); buyer app: q, then flutter run --dart-define=API_BASE_URL=http://192.168.0.210:4000');
