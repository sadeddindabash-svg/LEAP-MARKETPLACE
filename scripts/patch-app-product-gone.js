#!/usr/bin/env node
/**
 * Mobile app: opening a product the admin deleted (from an old order, a notification or a link) shows "This product is no longer
 * available" (Arabic / English) with "Find a similar part" and "Back to my orders". Apply after patch-delete-rule.js.
 *
 *   node scripts/patch-app-product-gone.js            dry run
 *   node scripts/patch-app-product-gone.js --write    applies it
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored":[{"file":"apps/mobile/lib/features/catalog/product_screen.dart","what":"a deleted product shows \"This product is no longer available\"","done":"import '../../widgets/product_gone_view.dart';","pairs":[["import '../../widgets/fit_version_note.dart';","import '../../widgets/fit_version_note.dart';\nimport '../../widgets/product_gone_view.dart';"],["          if (snapshot.hasError) {\n            return Center(","          // deleted by the admin: an old order, a notification or a shared link can still lead here\n          if (snapshot.hasError && ProductGoneView.isGone(snapshot.error)) {\n            return ProductGoneView(language: language);\n          }\n          if (snapshot.hasError) {\n            return Center("]]}],"created":[{"file":"apps/mobile/lib/widgets/product_gone_view.dart","what":"the \"no longer available\" screen","text":"import 'package:flutter/material.dart';\nimport 'package:go_router/go_router.dart';\nimport '../core/theme.dart';\n\n/// Shown instead of a product that the admin DELETED (the server answers 410 \"This product is no longer available\", migration 119):\n/// a buyer can still reach it from an old order, a notification or a shared link. Arabic or English.\nclass ProductGoneView extends StatelessWidget {\n  final String language;\n  const ProductGoneView({super.key, required this.language});\n\n  /// True when loading the product failed because it was deleted.\n  static bool isGone(Object? error) {\n    final text = '$error'.toLowerCase();\n    return text.contains('no longer available') || text.contains('product_deleted') || text.contains('410');\n  }\n\n  @override\n  Widget build(BuildContext context) {\n    final palette = LeapPalette.of(context);\n    final ar = language == 'ar';\n    return Center(\n      child: Padding(\n        key: const ValueKey('product-gone'),\n        padding: const EdgeInsets.all(28),\n        child: Column(\n          mainAxisSize: MainAxisSize.min,\n          children: [\n            Container(\n              width: 96,\n              height: 96,\n              decoration: BoxDecoration(color: palette.muted.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(16)),\n              child: Icon(Icons.block, size: 40, color: palette.muted),\n            ),\n            const SizedBox(height: 16),\n            Text(\n              ar ? 'هذا المنتج لم يعد متوفراً' : 'This product is no longer available',\n              textAlign: TextAlign.center,\n              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: palette.ink),\n            ),\n            const SizedBox(height: 6),\n            Text(\n              ar ? 'تمت إزالته من LEAP. طلباتك السابقة لا تتأثر.' : 'It has been removed from LEAP. Your past orders are not affected.',\n              textAlign: TextAlign.center,\n              style: TextStyle(fontSize: 13, color: palette.muted),\n            ),\n            const SizedBox(height: 18),\n            FilledButton(\n              onPressed: () => context.push('/search'),\n              child: Text(ar ? 'ابحث عن قطعة مشابهة' : 'Find a similar part'),\n            ),\n            TextButton(\n              onPressed: () => context.go('/orders'),\n              child: Text(ar ? 'العودة إلى طلباتي' : 'Back to my orders'),\n            ),\n          ],\n        ),\n      ),\n    );\n  }\n}\n"},{"file":"apps/mobile/test/product_gone_test.dart","what":"the tests","text":"import 'dart:io';\nimport 'package:flutter/material.dart';\nimport 'package:flutter_test/flutter_test.dart';\nimport 'package:go_router/go_router.dart';\nimport 'package:leap_mobile/widgets/product_gone_view.dart';\n\n// A product the admin deleted: the product screen says it is no longer available.\nvoid main() {\n  test('recognises the server answer for a deleted product', () {\n    expect(ProductGoneView.isGone(Exception('This product is no longer available')), isTrue);\n    expect(ProductGoneView.isGone('HTTP 410'), isTrue);\n    expect(ProductGoneView.isGone(Exception('Network error')), isFalse);\n  });\n\n  testWidgets('shows the message in English and Arabic', (tester) async {\n    for (final lang in ['en', 'ar']) {\n      final router = GoRouter(routes: [GoRoute(path: '/', builder: (_, __) => Scaffold(body: ProductGoneView(language: lang)))]);\n      await tester.pumpWidget(MaterialApp.router(routerConfig: router));\n      await tester.pumpAndSettle();\n      expect(find.text(lang == 'ar' ? 'هذا المنتج لم يعد متوفراً' : 'This product is no longer available'), findsOneWidget);\n    }\n  });\n\n  test('the product screen uses it', () {\n    final src = File('lib/features/catalog/product_screen.dart').readAsStringSync();\n    expect(src.contains('ProductGoneView.isGone(snapshot.error)'), isTrue);\n  });\n}\n"}]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-app-product-gone`, c.before);
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Then: cd apps\\mobile ; flutter test test/product_gone_test.dart ; flutter analyze lib/widgets/product_gone_view.dart lib/features/catalog/product_screen.dart');
