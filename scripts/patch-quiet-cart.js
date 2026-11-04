#!/usr/bin/env node
/**
 * Mobile app: removes the "Added to cart: ..." and "... removed from cart" messages, whatever patches came before (it finds the messages by their wording,
 * not by the exact text around them). Error messages (out of stock, no connection) stay.
 *   lib/widgets/product_card.dart              "Added to cart: <part>"            (adding from a product card)
 *   lib/features/catalog/product_screen.dart   "Added <part> to your basket"      (adding on a product's screen)
 *   lib/features/cart/cart_screen.dart         "<part> removed from cart  Undo"   (removing from the basket)
 *
 *   node scripts/patch-quiet-cart.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-quiet-cart.js --write    applies it (each changed file is saved as <file>.before-quiet-cart first)
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const N = '\\r?\\n';
const JOBS = [
  {
    file: 'apps/mobile/lib/widgets/product_card.dart',
    what: 'no "Added to cart" message from a product card',
    // if (mounted) { final message = existing != null ... 'added_to_cart' ... showSnackBar( ... ); }
    find: new RegExp(`([ \\t]*)if \\(mounted\\) \\{${N}[ \\t]*final message = existing != null${N}[\\s\\S]*?'added_to_cart'[\\s\\S]*?showSnackBar\\(${N}[\\s\\S]*?\\);${N}[ \\t]*\\}${N}`),
    put: (m, ind) => `${ind}// No "Added to cart" message: the cart's number going up (and the photo flying to it) says so. A failure is still said below.\n`,
  },
  {
    file: 'apps/mobile/lib/features/catalog/product_screen.dart',
    what: 'no "Added to your basket" message on a product screen',
    find: new RegExp(`([ \\t]*)if \\(mounted\\) \\{${N}[ \\t]*final isAr = context\\.read<LanguageState>\\(\\)\\.isArabic;${N}[\\s\\S]*?to your basket'[\\s\\S]*?showSnackBar\\(${N}[\\s\\S]*?\\);${N}[ \\t]*\\}${N}`),
    put: (m, ind) => `${ind}// No "Added to cart" message: the cart's number going up (and the photo flying to it) says so. A failure is still said below.\n`,
  },
  {
    file: 'apps/mobile/lib/features/cart/cart_screen.dart',
    what: 'no "removed from cart" message (with Undo) in the basket',
    // messenger.showSnackBar( SnackBar( content: Text('$removedName $removedLabel'), ... SnackBarAction( ... ), ), );
    find: new RegExp(`([ \\t]*)messenger\\.showSnackBar\\(${N}[ \\t]*SnackBar\\(${N}[ \\t]*content: Text\\('\\$removedName \\$removedLabel'\\),[\\s\\S]*?SnackBarAction\\([\\s\\S]*?${N}\\1\\);${N}`),
    put: (m, ind) => `${ind}// No "... removed from cart" message: the line disappearing from the basket says it. A failure is still said above.\n`,
  },
];
let problems = 0;
const plan = [];
for (const j of JOBS) {
  const p = path.join(root, j.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${j.file}: not found. Run this from D:\\LEAP-MARKETPLACE.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const m = s.match(j.find);
  if (!m) {
    const still = j.file.endsWith('cart_screen.dart') ? s.includes("'$removedName $removedLabel'") : (s.includes("'added_to_cart')}: ") || s.includes("to your basket'"));
    if (still) { console.log(`REFUSED   ${j.file}: the message is there but written differently, so nothing was changed. Send this file.`); problems++; }
    else console.log(`already   ${j.file}: ${j.what}`);
    continue;
  }
  const eol = s.includes('\r\n') ? '\r\n' : '\n';
  const out = s.replace(j.find, (whole, ind) => j.put(whole, ind).replace(/\n/g, eol));
  plan.push({ file: j.file, what: j.what, before: s, after: out });
}
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) {
    const p = path.join(root, c.file);
    fs.writeFileSync(`${p}.before-quiet-cart`, c.before);
    fs.writeFileSync(p, c.after);
    console.log(`patched   ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. App: press R in the start-all window (or run flutter run again).');
if (!plan.length) console.log('\nNothing to do: the messages are already gone from these files. If you still see them, the app on the phone is an older build: run flutter run again.');
