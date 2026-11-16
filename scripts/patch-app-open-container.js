#!/usr/bin/env node
/**
 * Buyer app (confirmed with the person via mockup): every product card opens into its product page ("open container"): the page grows out of the card, its
 * corners straightening as it fills the screen (0.38 s), and shrinks back into the card on the way back. The same for every product card (home, search, a
 * category, My garage parts, the wishlist, similar parts). The card's cart and heart buttons stay as they are. A product opened any other way (a link, a
 * notification) gets the usual page. No new package: a new file, lib/core/product_open.dart.
 *
 *   node scripts/patch-app-open-container.js            dry run
 *   node scripts/patch-app-open-container.js --write    applies it (each changed file is saved as <file>.before-patch-app-open-container first)
 * Then: buyer app: q, then flutter run again
 */
const DATA = {"created": [{"file": "apps/mobile/lib/core/product_open.dart", "what": "buyer app: the \"open container\" page (the product page grows out of the card)", "text": "import 'package:flutter/material.dart';\nimport 'package:go_router/go_router.dart';\n\n/// \"Open container\" (confirmed with the person via mockup): a product card remembers where it is on the screen just before it opens its product, and the\n/// product page grows out of that card (its corners straightening as it fills the screen) and shrinks back into it on the way back. A product opened any\n/// other way (a link, a notification, a screen that is not a card) gets the usual page.\nclass ProductOpen {\n  static Rect? _origin;\n  static DateTime? _at;\n  // the decision for each product page, kept by its page key: the router can build the same page again, and it must stay the same kind of page\n  static final Map<Object, Rect?> _byPage = {};\n\n  /// Called by a card just before it opens its product.\n  static void remember(BuildContext context) {\n    final box = context.findRenderObject();\n    if (box is RenderBox && box.attached && box.hasSize) {\n      _origin = box.localToGlobal(Offset.zero) & box.size;\n      _at = DateTime.now();\n    }\n  }\n\n  static Rect? _take() {\n    final origin = _origin;\n    final fresh = _at != null && DateTime.now().difference(_at!) < const Duration(seconds: 2);\n    _origin = null;\n    _at = null;\n    return fresh ? origin : null;\n  }\n\n  /// The product route's page.\n  static Page<void> page(GoRouterState state, Widget child) {\n    final key = state.pageKey;\n    final origin = _byPage.containsKey(key.value) ? _byPage[key.value] : (_byPage[key.value] = _take());\n    if (_byPage.length > 40) _byPage.remove(_byPage.keys.first);\n    if (origin == null) return MaterialPage<void>(key: key, child: child);\n    return CustomTransitionPage<void>(\n      key: key,\n      child: child,\n      transitionDuration: const Duration(milliseconds: 380),\n      reverseTransitionDuration: const Duration(milliseconds: 320),\n      transitionsBuilder: (context, animation, secondaryAnimation, child) => _Grow(origin: origin, animation: animation, child: child),\n    );\n  }\n}\n\n/// The page drawn at its full size, seen through a rounded window that grows from the card to the whole screen; the page's content fades in as it grows.\nclass _Grow extends StatelessWidget {\n  final Rect origin;\n  final Animation<double> animation;\n  final Widget child;\n  const _Grow({required this.origin, required this.animation, required this.child});\n\n  @override\n  Widget build(BuildContext context) {\n    final fade = CurvedAnimation(parent: animation, curve: const Interval(0.25, 0.65, curve: Curves.easeOut));\n    final background = Theme.of(context).scaffoldBackgroundColor;\n    return AnimatedBuilder(\n      animation: animation,\n      child: FadeTransition(opacity: fade, child: child),\n      builder: (context, page) {\n        final t = Curves.easeInOutCubic.transform(animation.value.clamp(0.0, 1.0).toDouble());\n        return ClipPath(\n          clipper: _Window(origin: origin, t: t),\n          child: ColoredBox(color: background, child: page),\n        );\n      },\n    );\n  }\n}\n\nclass _Window extends CustomClipper<Path> {\n  final Rect origin;\n  final double t;\n  const _Window({required this.origin, required this.t});\n\n  @override\n  Path getClip(Size size) {\n    final rect = Rect.lerp(origin, Offset.zero & size, t)!;\n    return Path()..addRRect(RRect.fromRectAndRadius(rect, Radius.circular(12 * (1 - t))));\n  }\n\n  @override\n  bool shouldReclip(_Window old) => old.t != t || old.origin != origin;\n}\n"}], "replaced": [], "anchored": [{"file": "apps/mobile/lib/widgets/product_card.dart", "what": "buyer app product cards: remember where the card is before opening the product", "done": "ProductOpen.remember(context);", "pairs": [["import '../core/language_state.dart';\n", "import '../core/language_state.dart';\nimport '../core/product_open.dart';\n", false], ["        onTap: widget.onTap,\n", "        // the product page grows out of this card (\"open container\")\n        onTap: () {\n          ProductOpen.remember(context);\n          widget.onTap();\n        },\n", false]]}, {"file": "apps/mobile/lib/app.dart", "what": "buyer app: the product page grows out of the card it was opened from", "done": "ProductOpen.page(state, ProductScreen(", "pairs": [["import 'core/garage_state.dart';\n", "import 'core/garage_state.dart';\nimport 'core/product_open.dart';\n", false], ["      path: '/product/:id',\n      builder: (context, state) => ProductScreen(productId: state.pathParameters['id']!),", "      path: '/product/:id',\n      // opened from a product card, the page grows out of the card (ProductOpen); otherwise the usual page\n      pageBuilder: (context, state) => ProductOpen.page(state, ProductScreen(productId: state.pathParameters['id']!)),", false], ["      path: '/products/:id',\n      builder: (context, state) => ProductScreen(productId: state.pathParameters['id']!),", "      path: '/products/:id',\n      pageBuilder: (context, state) => ProductOpen.page(state, ProductScreen(productId: state.pathParameters['id']!)),", false]]}]};
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const plan = [];
let problems = 0;
const once = (s, a) => s.split(a).length === 2;
const read = (file) => { const p = path.join(root, file); return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null; };
function edit(file, what, done, change) {
  const s = read(file);
  if (s === null) { console.log(`MISSING   ${file}: not found. Run this from D:\\LEAP-MARKETPLACE.`); problems++; return; }
  if (s.replace(/\r\n/g, '\n').includes(done)) { console.log(`already   ${file}: ${what}`); return; }
  const eol = s.includes('\r\n') ? '\r\n' : '\n';
  const out = change(s.replace(/\r\n/g, '\n'));
  if (typeof out !== 'string') { console.log(`REFUSED   ${file}: ${out && out.why ? out.why : 'its text is not what this patch expects'}, so nothing was changed. Send this file.`); problems++; return; }
  plan.push({ file, what, before: s, after: out.replace(/\n/g, eol) });
}

for (const e of DATA.created) {
  const p = path.join(root, e.file);
  if (e.base64) {      // a picture: written as it is
    const bytes = Buffer.from(e.base64, 'base64');
    if (fs.existsSync(p)) {
      if (fs.readFileSync(p).equals(bytes)) { console.log(`already   ${e.file}: ${e.what}`); continue; }
      console.log(`REFUSED   ${e.file}: a different file with this name is already there, so nothing was changed. Send this file.`); problems++; continue;
    }
    if (!fs.existsSync(path.dirname(p))) { console.log(`MISSING   ${path.dirname(e.file)}: folder not found. Run this from D:\\LEAP-MARKETPLACE.`); problems++; continue; }
    plan.push({ file: e.file, what: e.what, before: null, after: bytes });
    continue;
  }
  if (fs.existsSync(p)) {
    if (fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n') === e.text) { console.log(`already   ${e.file}: ${e.what}`); continue; }
    console.log(`REFUSED   ${e.file}: a different file with this name is already there, so nothing was changed. Send this file.`); problems++; continue;
  }
  // a new folder (services/api/src/modules/draftPhotos) is made, but only inside one that is already there
  if (!fs.existsSync(path.dirname(path.dirname(p)))) { console.log(`MISSING   ${path.dirname(path.dirname(e.file))}: folder not found. Run this from D:\\LEAP-MARKETPLACE.`); problems++; continue; }
  plan.push({ file: e.file, what: e.what, before: null, after: e.text });
}
for (const e of DATA.replaced || []) {
  edit(e.file, e.what, e.done, (s) => (e.from.includes(s) ? e.text : { why: 'it is not the version patch-hub-label-design made (run that patch first, or send this file)' }));
}
for (const e of DATA.anchored) {
  // a test file: changed when it is there and as expected, otherwise left as it is (it does not stop the patch)
  if (e.optional) {
    const s = read(e.file);
    if (s === null) { console.log(`skipped   ${e.file}: not found (a test file; nothing to do)`); continue; }
    const n = s.replace(/\r\n/g, '\n');
    if (!n.includes(e.done) && (e.pairs.some(([a, , all]) => all !== 'maybe' && all !== 'alts' && !once(n, a)) || (e.block && (!n.includes(e.block.from) || !n.includes(e.block.to))))) { console.log(`skipped   ${e.file}: not as expected, left as it is (${e.what})`); continue; }
  }
  edit(e.file, e.what, e.done, (s) => {
    let out = s;
    for (const [a, b, all] of e.pairs) {
      if (all === 'alts') { const hit = a.find(([x]) => once(out, x)); if (!hit) return { why: `this part was not found: "${a[a.length - 1][0].split('\n').find((l) => l.trim()).trim().slice(0, 90)}"` }; out = out.replace(hit[0], () => hit[1]); continue; }
      if (all === 'maybe') { if (once(out, a)) out = out.replace(a, () => b); continue; }
      if (all) { if (!out.includes(a)) return { why: `this part was not found: "${a.split('\n').find((l) => l.trim()).trim().slice(0, 90)}"` }; out = out.split(a).join(b); continue; } if (!once(out, a)) return { why: `this part was not found: "${a.split('\n').find((l) => l.trim()).trim().slice(0, 90)}"` }; out = out.replace(a, () => b); }
    if (e.region) {
      const r = e.region; const i = out.indexOf(r.from); const j = i < 0 ? -1 : out.indexOf(r.to, i);
      if (i < 0 || j < 0) return { why: `the part starting "${r.from.trim().slice(0, 60)}" was not found` };
      const seg = out.slice(i, j);
      if (r.must && !seg.includes(r.must)) return { why: `"${r.must}" was not found in the part starting "${r.from.trim().slice(0, 60)}"` };
      const changed = seg.replace(new RegExp(r.find, 'g'), r.repl);
      if (changed === seg) return { why: `nothing to change in the part starting "${r.from.trim().slice(0, 60)}"` };
      out = out.slice(0, i) + changed + out.slice(j);
    }
    if (e.block) {
      const i = out.indexOf(e.block.from); const j = i < 0 ? -1 : out.indexOf(e.block.to, i);
      if (i < 0 || j < 0) return { why: `the part starting "${e.block.from.trim().slice(0, 60)}" was not found` };
      out = out.slice(0, i) + e.block.text + out.slice(e.block.includeTo ? j + e.block.to.length : j);
    }
    return out;
  });
}
if (DATA.mount) edit('services/api/src/index.js', DATA.mount.what, DATA.mount.done, (s) => {
  const m = s.match(/\n([ \t]*)app\.use\('\/payouts', payoutsRoutes\);[^\n]*/);
  if (!m) return { why: "the line app.use('/payouts', payoutsRoutes); was not found" };
  const at = m.index + m[0].length;
  return s.slice(0, at) + `\n${m[1]}${DATA.mount.line}` + s.slice(at);
});
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) {
    const p = path.join(root, c.file);
    if (c.before !== null) fs.writeFileSync(`${p}.before-patch-app-open-container`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Then: buyer app: q, then flutter run again (a new file is added)');
