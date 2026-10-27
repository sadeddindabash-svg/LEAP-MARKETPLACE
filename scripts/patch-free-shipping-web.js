#!/usr/bin/env node
/**
 * Website: free shipping above a limit. The cart and the checkout show the shipping fee line, the "Add $X more for free shipping" note with a progress bar, and (when shipping is free) a green "Free shipping" icon over the Checkout button;
 * the order page shows the shipping fee that was charged. The totals include the fee. Needs patch-free-shipping.js (the server) and its migration 111; with the rule off, or the server not updated, nothing changes on the website.
 * Run it AFTER patch-product-cars.js (the cart page) and the other storefront patches.
 *
 *   node scripts/patch-free-shipping-web.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-free-shipping-web.js --write    applies it (each changed file is saved as <file>.before-free-shipping-web first)
 *
 * A file that is not exactly what the patch expects is NOT changed (the whole patch stops, so nothing is half applied). Running it twice is harmless ("already").
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "apps/web-storefront/lib/i18n.ts", "what": "the words for the shipping fee, the hint and the Free shipping icon (English and Arabic)", "done": "shipping_add_more", "pairs": [["  order_total_line: \"Total\",", "  order_total_line: \"Total\",\n  shipping_fees: \"Shipping fees\",\n  shipping_free: \"Free\",\n  shipping_add_more: \"Add {amount} more for free shipping\",\n  shipping_reached: \"You've reached {amount}: shipping is free\",\n  shipping_promo_free: \"Free shipping with your promo code\",\n  shipping_free_badge: \"Free shipping\","], ["  order_total_line: \"الإجمالي\",", "  order_total_line: \"الإجمالي\",\n  shipping_fees: \"رسوم الشحن\",\n  shipping_free: \"مجاني\",\n  shipping_add_more: \"أضف {amount} للحصول على شحن مجاني\",\n  shipping_reached: \"وصلت إلى {amount}: الشحن مجاني\",\n  shipping_promo_free: \"شحن مجاني مع رمز الخصم\",\n  shipping_free_badge: \"شحن مجاني\","]]}, {"file": "apps/web-storefront/lib/api.ts", "what": "the cart carries the shipping answer and an order carries its shipping fee", "done": "CartShipping", "pairs": [["  lockExpiresAt?: string | null;\n}\n\n/** Who is asking and in which language:", "  lockExpiresAt?: string | null;\n  /** The shipping fee on a small order (the admin's free-shipping rule): what to pay now, the limit, and how much more is needed. Absent from an older server. */\n  shipping?: CartShipping | null;\n}\n\n/** The shipping fee of a cart (worked out by the server). `enabled` false means the rule is off: no fee is ever charged. */\nexport interface CartShipping {\n  enabled: boolean;\n  thresholdUsd: number;\n  feeUsd: number;\n  chargedUsd: number;\n  remainingUsd: number;\n  qualifies: boolean;\n  waivedByPromo: boolean;\n}\n\n/** Who is asking and in which language:"], ["  discountAmount: number;\n", "  discountAmount: number;\n  /** The shipping fee charged on this order (0 when there was none); the total includes it. */\n  shippingFee?: number;\n"]]}, {"file": "apps/web-storefront/lib/cart.ts", "what": "the totals include the shipping fee (goods = after the discount; total = goods + fee)", "done": "shippingFee", "pairs": [["export function totals(cart: Pick<Cart, \"items\" | \"appliedDiscountUsd\" | \"appliedDiscountSource\" | \"loyaltyDiscountPercentage\" | \"appliedPromoCode\">) {\n  const sub = subtotal(cart);\n  const discount = Math.min(Math.max(cart.appliedDiscountUsd ?? 0, 0), sub);\n  return {\n    subtotal: sub,\n    discount,\n    total: Math.max(sub - discount, 0),\n    source: (cart.appliedDiscountSource ?? \"none\") as DiscountSource,\n    loyaltyPercent: cart.loyaltyDiscountPercentage ?? 0,\n    promoCode: cart.appliedPromoCode ?? null,\n  };\n}\n\n", "export function totals(cart: Pick<Cart, \"items\" | \"appliedDiscountUsd\" | \"appliedDiscountSource\" | \"loyaltyDiscountPercentage\" | \"appliedPromoCode\"> & { shipping?: Cart[\"shipping\"] }) {\n  const sub = subtotal(cart);\n  const discount = Math.min(Math.max(cart.appliedDiscountUsd ?? 0, 0), sub);\n  const goods = Math.max(sub - discount, 0);\n  const fee = Number(cart.shipping?.chargedUsd ?? 0);\n  const shippingFee = Number.isFinite(fee) ? Math.max(fee, 0) : 0;      // the fee of a small order (the server decides it); 0 when the rule is off or the value is not a number\n  return {\n    subtotal: sub,\n    discount,\n    goods,\n    shippingFee,\n    total: goods + shippingFee,\n    source: (cart.appliedDiscountSource ?? \"none\") as DiscountSource,\n    loyaltyPercent: cart.loyaltyDiscountPercentage ?? 0,\n    promoCode: cart.appliedPromoCode ?? null,\n  };\n}\n\n"]]}, {"file": "apps/web-storefront/components/CartProvider.tsx", "what": "the cart summary includes the shipping fee", "done": "shipping: cart?.shipping", "pairs": [["appliedPromoCode: cart?.appliedPromoCode }),", "appliedPromoCode: cart?.appliedPromoCode, shipping: cart?.shipping }),"]]}, {"file": "apps/web-storefront/app/cart/page.tsx", "what": "the cart: the shipping fee line and note under the lines, and the Free shipping icon over Checkout", "done": "FreeShippingBadge", "pairs": [["import { Price } from \"@/components/Price\";", "import { Price } from \"@/components/Price\";\nimport { ShippingRow, FreeShippingHint, FreeShippingBadge } from \"@/components/FreeShipping\";"], ["          <div className=\"mt-2 flex justify-between border-t-2 border-line pt-4 text-[22px] font-extrabold\"><span>{t(\"total\")}</span><Price usd={summary.total} /></div>", "          <ShippingRow shipping={cart.shipping} />\n          <FreeShippingHint shipping={cart.shipping} />\n          <div className=\"mt-2 flex justify-between border-t-2 border-line pt-4 text-[22px] font-extrabold\"><span>{t(\"total\")}</span><Price usd={summary.total} /></div>"], ["          <Link href=\"/checkout\" className=\"mt-5 flex min-h-13 w-full items-center justify-center rounded-[10px] bg-signal text-base font-bold text-on-signal hover:bg-signal-dark\">{t(\"checkout\")}</Link>", "          <Link href=\"/checkout\" className=\"relative mt-5 flex min-h-13 w-full items-center justify-center rounded-[10px] bg-signal text-base font-bold text-on-signal hover:bg-signal-dark\">{t(\"checkout\")}<FreeShippingBadge shipping={cart.shipping} /></Link>"]]}, {"file": "apps/web-storefront/app/checkout/page.tsx", "what": "the checkout summary shows the shipping fee line (the total includes it)", "done": "ShippingRow", "pairs": [["import { Price } from \"@/components/Price\";", "import { Price } from \"@/components/Price\";\nimport { ShippingRow } from \"@/components/FreeShipping\";"], ["          <div className=\"mt-1 flex justify-between border-t-2 border-line pt-3 text-[22px] font-extrabold\"><span>{t(\"total\")}</span><Price usd={summary.total} /></div>", "          <ShippingRow shipping={cart.shipping} />\n          <div className=\"mt-1 flex justify-between border-t-2 border-line pt-3 text-[22px] font-extrabold\"><span>{t(\"total\")}</span><Price usd={summary.total} /></div>"]]}, {"file": "apps/web-storefront/app/orders/[id]/page.tsx", "what": "the order page shows the shipping fee that was charged", "done": "order.shippingFee", "pairs": [["          <p className=\"flex justify-between text-xl font-extrabold\"><span>{t(\"order_total_line\")}</span><Price usd={order.total} /></p>", "          {order.shippingFee ? <p className=\"flex justify-between\"><span>{t(\"shipping_fees\")}</span><span>+<Price usd={order.shippingFee} /></span></p> : null}\n          <p className=\"flex justify-between text-xl font-extrabold\"><span>{t(\"order_total_line\")}</span><Price usd={order.total} /></p>"]]}], "whole": []};
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
  const fresh = fs.readFileSync(path.join(__dirname, 'free-shipping-web-files', e.file), 'utf8');
  if (s === fresh) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  if (sha(s) !== e.sha) { refuse(e.file, 'this file is not the one the new version was made from (it was changed on your side), so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: fresh });
}
for (const t of (DATA.tests || [])) {
  const p = path.join(root, t.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${t.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const fresh = fs.readFileSync(path.join(__dirname, 'free-shipping-web-files', t.file), 'utf8');
  if (s === fresh) { console.log(`already   ${t.file}: ${t.what}`); continue; }
  if (sha(s) !== t.sha) { refuse(t.file, 'this test file is not the one the new version was made from, so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: t.file, what: t.what, before: s, after: fresh });
}
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) { const p = path.join(root, c.file); fs.writeFileSync(`${p}.before-free-shipping-web`, c.before); fs.writeFileSync(p, c.after); console.log(`patched   ${c.file}: ${c.what}`); }
  else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
