#!/usr/bin/env node
/**
 * Mobile app: no "Added to cart: ..." message any more when a part is added (from a product card or a product's screen); the photo flying to the cart says it.
 * A failure (out of stock, no connection) is still shown. Needs patch-fly-to-cart first.
 *
 *   node scripts/patch-no-added-message.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-no-added-message.js --write    applies it (each changed file is saved as <file>.before-no-added-message first)
 *
 * A file that is not exactly what the patch expects is NOT changed (the whole patch stops, so nothing is half applied).
 * Windows (CRLF) line endings are handled. Running it twice is harmless ("already").
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "apps/mobile/lib/features/catalog/product_screen.dart", "what": "app: no \"Added to cart\" message on the product screen", "done": "// No \"Added to cart\" message: the photo flying", "pairs": [["      await cart.addItem(product.id, _qty);\n      if (mounted) {\n        final isAr = context.read<LanguageState>().isArabic;\n        final qtyPrefix = _qty > 1 ? '${_qty} \u00d7 ' : '';\n        final message = isAr\n            ? '\u062a\u0645\u062a \u0625\u0636\u0627\u0641\u0629 $qtyPrefix${product.name} \u0625\u0644\u0649 \u0627\u0644\u0633\u0644\u0629'\n            : 'Added $qtyPrefix${product.name} to your basket';\n        ScaffoldMessenger.of(context).showSnackBar(\n          SnackBar(content: Text(message)),\n        );\n      }\n    } on ApiException catch (e) {\n", "      await cart.addItem(product.id, _qty);\n      // No \"Added to cart\" message: the photo flying to the cart, and its number going up, already say so. A failure is still said (below).\n    } on ApiException catch (e) {\n"]]}, {"file": "apps/mobile/lib/widgets/product_card.dart", "what": "app: no \"Added to cart\" message from a product card", "done": "No \"Added to cart\" message: the photo flying to the cart, and its", "pairs": [["import '../core/language_state.dart';\nimport '../models/cart_item.dart';\nimport '../models/product.dart';\n", "import '../core/language_state.dart';\nimport '../models/product.dart';\n"], ["    try {\n      // Real \"already in cart\" check (#18) -- the real backend\n      // already correctly merges a repeat add into the existing real\n      // line item (confirmed directly: ON CONFLICT ... quantity =\n      // quantity + EXCLUDED.quantity), so there's no real duplicate\n      // to warn about -- this is an honest, informational notice\n      // instead, checked against the real, already-loaded cart\n      // before the add, not a fabricated one.\n      final cart = context.read<CartState>();\n      CartItem? existing;\n      for (final i in cart.items) {\n        if (i.productId == widget.product.id) {\n          existing = i;\n          break;\n        }\n      }\n      await cart.addItem(widget.product.id, 1);\n      if (mounted) {\n        final message = existing != null\n            ? '${trRead(context, 'added_to_cart')}: ${widget.product.name} (${existing.quantity + 1} in cart)'\n            : '${trRead(context, 'added_to_cart')}: ${widget.product.name}';\n        ScaffoldMessenger.of(context).showSnackBar(\n          SnackBar(content: Text(message), duration: const Duration(seconds: 1)),\n        );\n      }\n    } on ApiException catch (e) {\n", "    try {\n      // A repeat add simply adds one more to the same line (the server merges it). No \"Added to cart\" message: the photo flying to the cart, and its\n      // number going up, already say so. A failure is still said (below).\n      await context.read<CartState>().addItem(widget.product.id, 1);\n    } on ApiException catch (e) {\n"]]}], "created": [{"file": "apps/mobile/test/no_added_message_test.dart", "what": "app: the test for it", "text": "import 'dart:io';\nimport 'package:flutter_test/flutter_test.dart';\n\n// Adding a part shows no \"Added to cart\" message any more (the photo flying to the cart says it); a failure is still said. Reads the source text.\nvoid main() {\n  final card = File('lib/widgets/product_card.dart').readAsStringSync();\n  final product = File('lib/features/catalog/product_screen.dart').readAsStringSync();\n  test('no \"Added to cart\" message from a product card or a product screen', () {\n    expect(card.contains(\"trRead(context, 'added_to_cart')\"), isFalse);\n    expect(product.contains('to your basket'), isFalse);\n    expect(product.contains('\u0625\u0644\u0649 \u0627\u0644\u0633\u0644\u0629\\''), isFalse);\n  });\n  test('a failure is still shown', () {\n    expect(card.contains('} on ApiException catch (e) {'), isTrue);\n    expect(product.contains('SnackBar(content: Text(apiErrorText(context, e)))'), isTrue);\n  });\n}\n"}]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-no-added-message`, c.before);
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. App: press R in the start-all window (or run flutter run again).');
