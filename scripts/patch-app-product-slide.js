#!/usr/bin/env node
/**
 * Buyer app (confirmed with the person via mockup): the product page slides in from the side, from the right in English and from the left in Arabic (0.3 s),
 * over the page behind, which dims a little; back slides it out the same way. It replaces the "open container" (patch-app-open-container): works whether that
 * patch was run or not. (If it was, its file lib/core/product_open.dart is no longer used; it can stay or be deleted.)
 *
 *   node scripts/patch-app-product-slide.js            dry run
 *   node scripts/patch-app-product-slide.js --write    applies it (each changed file is saved as <file>.before-patch-app-product-slide first)
 * Then: buyer app: q, then flutter run again
 */
const DATA = {"created": [{"file": "apps/mobile/lib/core/product_slide.dart", "what": "buyer app: the product page that slides in from the side", "text": "import 'package:flutter/material.dart';\nimport 'package:go_router/go_router.dart';\n\n/// The product page slides in from the side (confirmed with the person via mockup): from the right in English, from the left in Arabic, in 0.3 s, over the\n/// page behind, which dims a little. Back slides it out the same way. (It replaces the \"open container\" growing card.)\nclass ProductSlide {\n  static Page<void> page(GoRouterState state, Widget child) {\n    return CustomTransitionPage<void>(\n      key: state.pageKey,\n      child: child,\n      transitionDuration: const Duration(milliseconds: 300),\n      reverseTransitionDuration: const Duration(milliseconds: 260),\n      transitionsBuilder: (context, animation, secondaryAnimation, child) {\n        final curved = CurvedAnimation(parent: animation, curve: Curves.easeOutCubic, reverseCurve: Curves.easeInCubic);\n        return Stack(\n          fit: StackFit.expand,\n          children: [\n            // the page behind dims a little while the new one comes over it\n            IgnorePointer(child: FadeTransition(opacity: Tween<double>(begin: 0, end: 0.25).animate(curved), child: const ColoredBox(color: Colors.black))),\n            SlideTransition(\n              // Offset(1, 0) is the end side: the right in English; textDirection turns it to the left in Arabic\n              position: Tween<Offset>(begin: const Offset(1, 0), end: Offset.zero).animate(curved),\n              textDirection: Directionality.of(context),\n              child: DecoratedBox(\n                decoration: const BoxDecoration(boxShadow: [BoxShadow(color: Color(0x33000000), blurRadius: 24)]),\n                child: child,\n              ),\n            ),\n          ],\n        );\n      },\n    );\n  }\n}\n"}], "replaced": [], "anchored": [{"file": "apps/mobile/lib/app.dart", "what": "buyer app: the product page slides in from the side (instead of the open container)", "done": "ProductSlide.page(state, ProductScreen(", "pairs": [[[["import 'core/product_open.dart';\n", "import 'core/product_slide.dart';\n"], ["import 'core/garage_state.dart';\n", "import 'core/garage_state.dart';\nimport 'core/product_slide.dart';\n"]], null, "alts"], [[["      path: '/product/:id',\n      // opened from a product card, the page grows out of the card (ProductOpen); otherwise the usual page\n      pageBuilder: (context, state) => ProductOpen.page(state, ProductScreen(productId: state.pathParameters['id']!)),", "      path: '/product/:id',\n      // the product page slides in from the side (ProductSlide)\n      pageBuilder: (context, state) => ProductSlide.page(state, ProductScreen(productId: state.pathParameters['id']!)),"], ["      path: '/product/:id',\n      builder: (context, state) => ProductScreen(productId: state.pathParameters['id']!),", "      path: '/product/:id',\n      // the product page slides in from the side (ProductSlide)\n      pageBuilder: (context, state) => ProductSlide.page(state, ProductScreen(productId: state.pathParameters['id']!)),"]], null, "alts"], [[["      path: '/products/:id',\n      pageBuilder: (context, state) => ProductOpen.page(state, ProductScreen(productId: state.pathParameters['id']!)),", "      path: '/products/:id',\n      pageBuilder: (context, state) => ProductSlide.page(state, ProductScreen(productId: state.pathParameters['id']!)),"], ["      path: '/products/:id',\n      builder: (context, state) => ProductScreen(productId: state.pathParameters['id']!),", "      path: '/products/:id',\n      pageBuilder: (context, state) => ProductSlide.page(state, ProductScreen(productId: state.pathParameters['id']!)),"]], null, "alts"]]}, {"file": "apps/mobile/lib/widgets/product_card.dart", "what": "buyer app product cards: the open container's \"remember where the card is\" taken away (if it was there)", "done": "        onTap: widget.onTap,\n", "pairs": [["import '../core/product_open.dart';\n", "", "maybe"], ["        // the product page grows out of this card (\"open container\")\n        onTap: () {\n          ProductOpen.remember(context);\n          widget.onTap();\n        },\n", "        onTap: widget.onTap,\n", "maybe"]]}]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-patch-app-product-slide`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Then: buyer app: q, then flutter run again (a new file is added)');
