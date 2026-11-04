#!/usr/bin/env node
/**
 * Mobile app basket: no "... removed from cart" message (with Undo) any more when a part is removed; the line disappearing says it. A failure is still shown.
 *
 *   node scripts/patch-no-cart-messages.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-no-cart-messages.js --write    applies it (each changed file is saved as <file>.before-no-cart-messages first)
 *
 * A file that is not exactly what the patch expects is NOT changed (the whole patch stops, so nothing is half applied).
 * Windows (CRLF) line endings are handled. Running it twice is harmless ("already").
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "apps/mobile/lib/features/cart/cart_screen.dart", "what": "app: no \"removed from cart\" message in the basket", "done": "// No \"... removed from cart\" message", "pairs": [["  Future<void> _removeItem(BuildContext context, CartState cart) async {\n    final removedQuantity = item.quantity;\n    final removedName = item.name;\n    final messenger = ScaffoldMessenger.of(context);\n", "  Future<void> _removeItem(BuildContext context, CartState cart) async {\n    final messenger = ScaffoldMessenger.of(context);\n"], ["    final messenger = ScaffoldMessenger.of(context);\n    final removedLabel = trRead(context, 'cart_removed_from_cart');\n    final undoLabel = trRead(context, 'undo');\n    setState(() => _isRemoving = true);\n", "    final messenger = ScaffoldMessenger.of(context);\n    setState(() => _isRemoving = true);\n"], ["      messenger.showSnackBar(SnackBar(content: Text(mounted ? apiErrorText(context, e) : e.message)));\n      return;\n    } finally {\n", "      messenger.showSnackBar(SnackBar(content: Text(mounted ? apiErrorText(context, e) : e.message)));\n    } finally {\n"], ["    }\n    // REAL BUG FOUND AND FIXED HERE: removeCurrentSnackBar()\n    // immediately followed by showSnackBar() in the same synchronous\n    // call is a known, documented Flutter interaction issue in some\n    // versions -- the new SnackBar's own timer can behave\n    // unpredictably right after a forced removal like this. Removed\n    // entirely; the explicit duration below already handles the\n    // real underlying concern (a message that could otherwise\n    // linger) more directly and safely.\n    messenger.showSnackBar(\n      SnackBar(\n        content: Text('$removedName $removedLabel'),\n        // Real, explicit, guaranteed-finite duration (fix) --\n        // confirmed directly that no duration was ever set anywhere\n        // on this SnackBar before, relying entirely on Flutter's own\n        // default. This removes that dependency and directly\n        // guarantees the message can't stay up indefinitely.\n        duration: const Duration(seconds: 4),\n        action: SnackBarAction(\n          label: undoLabel,\n          onPressed: () async {\n            try {\n              await cart.addItem(item.productId, removedQuantity);\n            } on ApiException catch (e) {\n              messenger.showSnackBar(SnackBar(content: Text(mounted ? apiErrorText(context, e) : e.message)));\n            }\n          },\n        ),\n      ),\n    );\n  }\n", "    }\n    // No \"... removed from cart\" message: the line disappearing from the basket says it. A failure is still said (above).\n  }\n"]]}], "created": [{"file": "apps/mobile/test/no_cart_messages_test.dart", "what": "app: the test for it", "text": "import 'dart:io';\nimport 'package:flutter_test/flutter_test.dart';\n\n// Removing a part from the basket shows no \"... removed from cart\" message any more (the line disappearing says it); a failure is still said. Reads the source text.\nvoid main() {\n  final cart = File('lib/features/cart/cart_screen.dart').readAsStringSync();\n  test('no \"removed from cart\" message, and no Undo', () {\n    expect(cart.contains(\"trRead(context, 'cart_removed_from_cart')\"), isFalse);\n    expect(cart.contains('SnackBarAction('), isFalse);\n  });\n  test('a failure to remove is still shown', () {\n    expect(cart.contains('await cart.removeItem(item.productId);\\n    } on ApiException catch (e) {'), isTrue);\n  });\n}\n"}]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-no-cart-messages`, c.before);
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. App: press R in the start-all window (or run flutter run again).');
