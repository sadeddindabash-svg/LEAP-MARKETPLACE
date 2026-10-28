#!/usr/bin/env node
/**
 * Website: a WISHLIST HEART on every product card (on the photo's bottom corner, at the end side: it flips in Arabic) and on the product page (beside Share). Outline when not saved, red when saved; signed out it leads to the login page.
 * One shared list (components/WishlistProvider.tsx) is loaded once for the whole site, so the hearts and the existing wide "Add to wishlist" button always agree. No server change, no migration.
 * Needs components/WishlistProvider.tsx and components/WishlistHeart.tsx from the same package. Run it AFTER patch-you-saved.js.
 *
 *   node scripts/patch-wishlist-heart.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-wishlist-heart.js --write    applies it (each changed file is saved as <file>.before-wishlist-heart first)
 *
 * A file that is not exactly what the patch expects is NOT changed (the whole patch stops, so nothing is half applied). Running it twice is harmless ("already").
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "apps/web-storefront/app/layout.tsx", "what": "the shared wishlist list wraps the site (inside the sign-in provider)", "done": "WishlistProvider", "pairs": [["import { AuthProvider } from \"@/components/AuthProvider\";", "import { AuthProvider } from \"@/components/AuthProvider\";\nimport { WishlistProvider } from \"@/components/WishlistProvider\";"], ["<GarageProvider>", "<WishlistProvider>\n            <GarageProvider>"], ["</GarageProvider>", "</GarageProvider>\n          </WishlistProvider>"]]}, {"file": "apps/web-storefront/components/ProductCard.tsx", "what": "a wishlist heart on the photo's corner of every product card", "done": "WishlistHeart", "pairs": [["import CardAddToCart from \"@/components/CardAddToCart\";", "import CardAddToCart from \"@/components/CardAddToCart\";\nimport WishlistHeart from \"@/components/WishlistHeart\";"], ["<CardAddToCart productId={p.id} name={p.name} inStock={inStock} /></div>", "<CardAddToCart productId={p.id} name={p.name} inStock={inStock} /></div>\n      <WishlistHeart productId={p.id} name={p.name} variant=\"card\" />"]]}, {"file": "apps/web-storefront/app/products/[id]/page.tsx", "what": "a wishlist heart beside Share in the product page's title row", "done": "WishlistHeart", "pairs": [["import { WishlistButton } from \"@/components/WishlistButton\";", "import { WishlistButton } from \"@/components/WishlistButton\";\nimport WishlistHeart from \"@/components/WishlistHeart\";"], ["<ShareButton title={product.name} />", "<div className=\"flex shrink-0 items-center gap-2\">\n              <WishlistHeart productId={product.id} name={product.name} variant=\"page\" />\n              <ShareButton title={product.name} />\n            </div>"]]}, {"file": "apps/web-storefront/components/WishlistButton.tsx", "what": "the wide Add to wishlist button follows the shared list, so it always agrees with the hearts", "done": "useOptionalWishlist", "pairs": [["import { checkWishlisted, addToWishlist, removeFromWishlist } from \"@/lib/api\";", "import { checkWishlisted, addToWishlist, removeFromWishlist } from \"@/lib/api\";\nimport { useOptionalWishlist } from \"@/components/WishlistProvider\";"], ["const [isWishlisted, setIsWishlisted] = useState(false);", "const [ownWishlisted, setIsWishlisted] = useState(false);"], ["const [isToggling, setIsToggling] = useState(false);", "const [isToggling, setIsToggling] = useState(false);\n  const shared = useOptionalWishlist();      // the one list the hearts use; without it (a page outside the site) the button keeps its own check\n  const isWishlisted = shared ? shared.isSaved(productId) : ownWishlisted;"], ["    checkWishlisted(token, productId)\n      .then(setIsWishlisted)\n      .finally(() => setIsChecking(false));", "    if (shared) { setIsChecking(false); return; }\n    checkWishlisted(token, productId)\n      .then(setIsWishlisted)\n      .finally(() => setIsChecking(false));"], ["}, [authLoading, user, productId]);", "}, [authLoading, user, productId, shared]);"], ["    setIsToggling(true);\n    try {\n      if (isWishlisted) {", "    setIsToggling(true);\n    if (shared) {\n      try { await shared.toggle(productId); } finally { setIsToggling(false); }\n      return;\n    }\n    try {\n      if (isWishlisted) {"]]}, {"file": "apps/web-storefront/lib/i18n.ts", "what": "the words of the heart's label (English and Arabic)", "done": "wishlist_add_aria", "pairs": [["  log_in_to_save: \"♡ Log in to save\",", "  log_in_to_save: \"♡ Log in to save\",\n  wishlist_add_aria: \"Save to wishlist\",\n  wishlist_remove_aria: \"Remove from wishlist\","], ["  log_in_to_save: \"♡ سجّل الدخول للحفظ\",", "  log_in_to_save: \"♡ سجّل الدخول للحفظ\",\n  wishlist_add_aria: \"حفظ في المفضلة\",\n  wishlist_remove_aria: \"إزالة من المفضلة\","]]}], "whole": []};
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const once = (s, a) => s.split(a).length === 2;

const plan = [];
let problems = 0;
const refuse = (file, why) => { console.log(`REFUSED   ${file}: ${why}`); problems++; };
for (const e of DATA.anchored) {
  const p = path.join(root, e.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${e.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  if (s.includes(e.done)) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  let out = s;
  for (const [a, b] of e.pairs) { if (!once(out, a)) { out = null; break; } out = out.replace(a, () => b); }
  if (out === null) { refuse(e.file, 'its text is not what this patch expects, so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: out });
}
for (const e of DATA.whole) {
  const p = path.join(root, e.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${e.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const fresh = fs.readFileSync(path.join(__dirname, 'wishlist-heart-files', e.file), 'utf8');
  if (s === fresh) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  if (sha(s) !== e.sha) { refuse(e.file, 'this file is not the one the new version was made from (it was changed on your side), so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: fresh });
}
for (const t of (DATA.tests || [])) {
  const p = path.join(root, t.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${t.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const fresh = fs.readFileSync(path.join(__dirname, 'wishlist-heart-files', t.file), 'utf8');
  if (s === fresh) { console.log(`already   ${t.file}: ${t.what}`); continue; }
  if (sha(s) !== t.sha) { refuse(t.file, 'this test file is not the one the new version was made from, so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: t.file, what: t.what, before: s, after: fresh });
}
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) { const p = path.join(root, c.file); fs.writeFileSync(`${p}.before-wishlist-heart`, c.before); fs.writeFileSync(p, c.after); console.log(`patched   ${c.file}: ${c.what}`); }
  else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
