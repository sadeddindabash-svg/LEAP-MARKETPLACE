#!/usr/bin/env node
/**
 * Mobile app basket: the tick boxes (each line and "Select all") are golden yellow (#F9B317) with a navy check, instead of dark navy. The website is not changed.
 * Needs patch-cart-select first.
 *
 *   node scripts/patch-gold-ticks.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-gold-ticks.js --write    applies it (the file is saved as <file>.before-gold-ticks first)
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const file = 'apps/mobile/lib/features/cart/cart_screen.dart';
const p = path.join(root, file);
if (!fs.existsSync(p)) { console.log(`MISSING   ${file}: not found. Run this from D:\\LEAP-MARKETPLACE.`); process.exit(1); }
const s = fs.readFileSync(p, 'utf8');
const GOLD = 'activeColor: const Color(0xFFF9B317), checkColor: const Color(0xFF0B3146),';
if (s.split(GOLD).length - 1 >= 2) { console.log(`already   ${file}: golden yellow tick boxes`); process.exit(0); }
const n = s.split('activeColor: const Color(0xFF0B3146),').length - 1;
if (n !== 2) { console.log(`REFUSED   ${file}: the two tick boxes of patch-cart-select were not found (run patch-cart-select first), so nothing was changed.`); process.exit(1); }
const out = s.split('activeColor: const Color(0xFF0B3146),').join(GOLD);
if (!write) { console.log(`would     ${file}: golden yellow tick boxes (2)\n\nDry run only. Add --write to apply.`); process.exit(0); }
fs.writeFileSync(`${p}.before-gold-ticks`, s);
fs.writeFileSync(p, out);
console.log(`patched   ${file}: golden yellow tick boxes (2)\n\nDone. App: press q in the start-all window, then flutter run again.`);
