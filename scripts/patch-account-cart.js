#!/usr/bin/env node
/**
 * SERVER: ONE CART PER ACCOUNT. Plugs services/api/src/modules/cart/accountCart.js (from the same package) in front of the cart routes: a signed-in buyer's device carts are combined into one account cart (items added together and
 * lowered only to the stock available; the account cart's promo code and price lock are kept), a device sent to a combined cart's old id lands on the account cart, a cart of another account is never shown, a request that is not
 * signed in never sees an account's cart; every answer carries the cart's real id (cartId), and the one that combined carts also carries { merge }. Adds POST /cart/:cartId/clear (after an order). Needs migration 115.
 *
 *   node scripts/patch-account-cart.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-account-cart.js --write    applies it (the changed file is saved as <file>.before-account-cart first)
 *
 * A file that is not exactly what the patch expects is NOT changed (the whole patch stops, so nothing is half applied). Running it twice is harmless ("already").
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "services/api/src/modules/cart/routes.js", "what": "the cart routes sit behind the account cart layer (one cart per account)", "done": "accountCartRouter(router)", "pairs": [["\nmodule.exports = router;\n", "\nrouter.getFullCart = getFullCart;      // used by the account cart layer's POST /:cartId/clear\nmodule.exports = require('./accountCart').accountCartRouter(router);\n"]]}, {"file": "services/api/src/modules/quote-requests/routes.js", "what": "a quote's items are put into the buyer's account cart (the cart id the device sends may be a combined cart's old id)", "done": "targetCartId", "pairs": [["const { requireAuth } = require('../auth/middleware');", "const { requireAuth } = require('../auth/middleware');\nconst { resolveCart } = require('../cart/accountCart');"], ["    await client.query('BEGIN');\n    await client.query('INSERT INTO carts (id) VALUES ($1) ON CONFLICT (id) DO NOTHING', [cartId]);\n", "    // ONE CART PER ACCOUNT: the quote's items go into the buyer's account cart (the id the device sends may be the old id of a cart that was combined into it).\n    const targetCartId = (await resolveCart(cartId, req.user.sub, 'en')).cartId;\n    await client.query('BEGIN');\n"], ["        [cartId, item.product_id, item.quantity]", "        [targetCartId, item.product_id, item.quantity]"]]}], "whole": []};
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
  const fresh = fs.readFileSync(path.join(__dirname, 'account-cart-files', e.file), 'utf8');
  if (s === fresh) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  if (sha(s) !== e.sha) { refuse(e.file, 'this file is not the one the new version was made from (it was changed on your side), so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: fresh });
}
for (const t of (DATA.tests || [])) {
  const p = path.join(root, t.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${t.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const fresh = fs.readFileSync(path.join(__dirname, 'account-cart-files', t.file), 'utf8');
  if (s === fresh) { console.log(`already   ${t.file}: ${t.what}`); continue; }
  if (sha(s) !== t.sha) { refuse(t.file, 'this test file is not the one the new version was made from, so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: t.file, what: t.what, before: s, after: fresh });
}
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) { const p = path.join(root, c.file); fs.writeFileSync(`${p}.before-account-cart`, c.before); fs.writeFileSync(p, c.after); console.log(`patched   ${c.file}: ${c.what}`); }
  else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
