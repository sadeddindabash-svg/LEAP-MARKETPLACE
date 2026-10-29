#!/usr/bin/env node
/**
 * Mobile app: ONE CART PER ACCOUNT. The app uses the cart id the server answers with (the account cart's) from then on, shows a banner on the cart screen when this device's basket was combined with the account basket, and signing out
 * gives the device a fresh empty guest cart. (After an order the app already empties the same cart item by item.) Needs lib/models/cart_merge.dart and lib/widgets/cart_merge_banner.dart from the same package, and the server package
 * (patch-account-cart.js, migration 115). I cannot run Flutter: please run flutter analyze and flutter test, then try it.
 *
 *   node scripts/patch-account-cart-app.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-account-cart-app.js --write    applies it (each changed file is saved as <file>.before-account-cart-app first)
 *
 * A file that is not exactly what the patch expects is NOT changed (the whole patch stops, so nothing is half applied). Windows (CRLF) line endings are handled. Running it twice is harmless ("already").
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "apps/mobile/lib/services/api_client.dart", "what": "the API client keeps the cart id the server answered with and what it combined", "done": "lastCartMerge = CartMerge.fromJson", "pairs": [["import '../models/cart_item.dart';", "import '../models/cart_item.dart';\nimport '../models/cart_merge.dart';"], ["  CartShipping lastCartShipping = CartShipping.off;", "  CartShipping lastCartShipping = CartShipping.off;\n  /// ONE CART PER ACCOUNT: the cart id the server answered with (the account cart's, which may not be the id that was asked), and what it combined (only in the answer that did); CartState reads both right after each cart call.\n  String? lastCartId;\n  CartMerge? lastCartMerge;"], ["    lastCartShipping = CartShipping.fromJson(body['shipping']);", "    lastCartShipping = CartShipping.fromJson(body['shipping']);\n    lastCartId = body['cartId'] as String?;\n    lastCartMerge = CartMerge.fromJson(body['merge']);"]]}, {"file": "apps/mobile/lib/core/cart_state.dart", "what": "the cart state: one cart per account (adopts the account cart's id, the notice, a fresh guest cart on sign-out)", "done": "_startFreshGuestCart", "pairs": [["import '../models/cart_shipping.dart';", "import '../models/cart_merge.dart';\nimport '../models/cart_shipping.dart';"], ["  CartShipping _shipping = CartShipping.off;", "  CartShipping _shipping = CartShipping.off;\n  // ONE CART PER ACCOUNT: set when the server combined this device's basket with the account basket; shown on the cart screen until dismissed.\n  CartMerge? _mergeNotice;"], ["  CartShipping get shipping => _shipping;", "  CartShipping get shipping => _shipping;\n  CartMerge? get mergeNotice => _mergeNotice;\n  void dismissMergeNotice() {\n    if (_mergeNotice == null) return;\n    _mergeNotice = null;\n    notifyListeners();\n  }"], ["    _shipping = _apiClient.lastCartShipping;", "    _shipping = _apiClient.lastCartShipping;\n    // ONE CART PER ACCOUNT: the cart the server answered with is THE cart from now on (this device keeps its id), and what it combined is kept for the notice.\n    final answeredId = _apiClient.lastCartId;\n    if (answeredId != null && answeredId != _cartId) {\n      _cartId = answeredId;\n      _secureStorage.write(key: _cartIdKey, value: answeredId);\n    }\n    final combined = _apiClient.lastCartMerge;\n    if (combined != null) _mergeNotice = combined;"], ["    if (_token == token) return;\n    _token = token;\n    refresh();\n  }", "    if (_token == token) return;\n    final signedOut = _token != null && token == null;\n    _token = token;\n    if (signedOut) {\n      _startFreshGuestCart();\n      return;\n    }\n    refresh();\n  }\n\n  /// Signed out: this device gets a FRESH EMPTY guest cart (a new id), so the next person never sees the account's cart.\n  Future<void> _startFreshGuestCart() async {\n    final id = const Uuid().v4();\n    _cartId = id;\n    _items = [];\n    _appliedPromoCode = null;\n    _appliedPromoDetails = null;\n    _promoDiscountUsd = 0;\n    _loyaltyDiscountPercentage = 0;\n    _loyaltyDiscountUsd = 0;\n    _appliedDiscountSource = 'none';\n    _appliedDiscountUsd = 0;\n    _shipping = CartShipping.off;\n    _lockActive = false;\n    _lockExpiresAt = null;\n    _mergeNotice = null;\n    _errorMessage = null;\n    notifyListeners();\n    await _secureStorage.write(key: _cartIdKey, value: id);\n    await refresh();\n  }"]]}, {"file": "apps/mobile/lib/features/cart/cart_screen.dart", "what": "the cart screen shows the banner that carts were combined", "done": "const CartMergeBanner()", "pairs": [["import '../../widgets/free_shipping.dart';", "import '../../widgets/cart_merge_banner.dart';\nimport '../../widgets/free_shipping.dart';"], ["              Icon(Icons.shopping_cart_outlined, size: 40, color: palette.muted),", "              const CartMergeBanner(),\n              Icon(Icons.shopping_cart_outlined, size: 40, color: palette.muted),"], ["        for (final entry in grouped.entries) _SupplierGroup(supplierName: entry.key, items: entry.value),", "        const CartMergeBanner(),\n        for (final entry in grouped.entries) _SupplierGroup(supplierName: entry.key, items: entry.value),"]]}, {"file": "apps/mobile/lib/core/app_strings.dart", "what": "the words of the combined-carts banner (English and Arabic)", "done": "cart_merged_title", "pairs": [["    'basket_empty': {'en': 'Your basket is empty. Browse categories to add fitment-confirmed parts.', 'ar': 'سلتك فارغة. تصفح الفئات لإضافة قطع مؤكدة التوافق.'},", "    'basket_empty': {'en': 'Your basket is empty. Browse categories to add fitment-confirmed parts.', 'ar': 'سلتك فارغة. تصفح الفئات لإضافة قطع مؤكدة التوافق.'},\n    'cart_merged_title': {'en': \"We combined this device's basket with your account basket.\", 'ar': 'دمجنا سلة هذا الجهاز مع سلة حسابك.'},\n    'cart_merged_added_one': {'en': '1 item was added.', 'ar': 'أُضيف منتج واحد.'},\n    'cart_merged_added_many': {'en': '{n} items were added.', 'ar': 'تمت إضافة {n} من المنتجات.'},\n    'cart_merged_reduced': {'en': 'The quantity of “{name}” was lowered to {to}: that is all we have in stock.', 'ar': 'تم تخفيض كمية «{name}» إلى {to}: هذا كل ما لدينا في المخزون.'},\n    'cart_merged_dropped': {'en': '“{name}” was not added: it is out of stock.', 'ar': 'لم تتم إضافة «{name}»: غير متوفر في المخزون.'},\n    'cart_merged_dismiss': {'en': 'Dismiss', 'ar': 'إغلاق'},"]]}], "whole": []};
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const once = (s, a) => s.split(a).length === 2;

const plan = [];
let problems = 0;
const refuse = (file, why) => { console.log(`REFUSED   ${file}: ${why}`); problems++; };
for (const e of DATA.anchored) {
  const p = path.join(root, e.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${e.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const c = (x) => (s.includes('\r\n') ? x.replace(/\r?\n/g, '\r\n') : x);
  if (s.includes(c(e.done))) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  let out = s;
  for (const [a0, b0] of e.pairs) { const a = c(a0), b = c(b0); if (!once(out, a)) { out = null; break; } out = out.replace(a, () => b); }
  if (out === null) { refuse(e.file, 'its text is not what this patch expects, so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: out });
}
for (const e of DATA.whole) {
  const p = path.join(root, e.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${e.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const fresh = fs.readFileSync(path.join(__dirname, 'account-cart-app-files', e.file), 'utf8');
  if (s === fresh) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  if (sha(s) !== e.sha) { refuse(e.file, 'this file is not the one the new version was made from (it was changed on your side), so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: fresh });
}
for (const t of (DATA.tests || [])) {
  const p = path.join(root, t.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${t.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const fresh = fs.readFileSync(path.join(__dirname, 'account-cart-app-files', t.file), 'utf8');
  if (s === fresh) { console.log(`already   ${t.file}: ${t.what}`); continue; }
  if (sha(s) !== t.sha) { refuse(t.file, 'this test file is not the one the new version was made from, so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: t.file, what: t.what, before: s, after: fresh });
}
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) { const p = path.join(root, c.file); fs.writeFileSync(`${p}.before-account-cart-app`, c.before); fs.writeFileSync(p, c.after); console.log(`patched   ${c.file}: ${c.what}`); }
  else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
