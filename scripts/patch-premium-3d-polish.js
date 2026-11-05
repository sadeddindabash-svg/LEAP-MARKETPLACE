#!/usr/bin/env node
/**
 * Buyer app: style B "Premium 3D", step 3 (confirmed with the person via mockup):
 *  - Account: the same 12 px between every card (the tier card and "Account settings" too); the photo-and-name box is the tab bar's navy;
 *    Help and Useful links are raised rows with gold icons, like the list above them;
 *  - Home: the section icons stay raised without the white rim; the brand strip is a raised card with raised logo buttons; the banner floats on a
 *    deep shadow with a soft shine; every product card (Newest / My car, search, Recently viewed) is a raised card lit from above;
 *  - Cart: Get a quotation is a raised button that sinks when pressed.
 * Run it after patch-premium-3d-more.
 *
 *   node scripts/patch-premium-3d-polish.js            dry run
 *   node scripts/patch-premium-3d-polish.js --write    applies it (each changed file is saved as <file>.before-premium-3d-polish first)
 * Then: buyer app: q, then flutter run --dart-define=API_BASE_URL=http://192.168.0.210:4000   (No server change, no website change.)
 *
 * A file that is not as this patch expects is NOT changed (the whole patch stops; send that file). Windows (CRLF) line endings are handled.
 * Running it twice is harmless.
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"created": [], "anchored": [{"file": "apps/mobile/lib/widgets/premium.dart", "what": "Premium 3D: the round buttons without the white rim", "done": "shape: BoxShape.circle,\n        boxShadow: const [BoxShadow(color: Color(0x66000000)", "pairs": [["        shape: BoxShape.circle,\n        border: Border.all(color: Colors.white.withValues(alpha: 0.08), width: 2),\n", "        shape: BoxShape.circle,\n", false], ["      border: Border.all(color: Colors.white, width: 2),\n", "", false]]}, {"file": "apps/mobile/lib/features/account/account_screen.dart", "what": "Account: the same 12 px between every card, the name box in the tab bar's navy", "done": "color: const Color(0xFF0B3146),      // the tab bar's navy", "pairs": [["              padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),", "              padding: const EdgeInsets.fromLTRB(16, 6, 16, 6),", false], ["          const SizedBox(height: 14),\n          slide('heading', Padding(\n            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),", "          slide('heading', Padding(\n            padding: const EdgeInsets.fromLTRB(16, 6, 16, 8),", false], ["                  padding: const EdgeInsets.only(bottom: 8),", "                  padding: const EdgeInsets.only(bottom: 12),", false], ["          const SizedBox(height: 6),\n          slide('appearance', const PremiumBox(child: _ThemeSection())),", "          slide('appearance', const PremiumBox(margin: EdgeInsets.fromLTRB(16, 0, 16, 6), child: _ThemeSection())),", false], ["      color: LeapColorsDark.background,\n      padding: const EdgeInsets.all(20),", "      color: const Color(0xFF0B3146),      // the tab bar's navy\n      padding: const EdgeInsets.all(20),", false], ["border: Border.all(color: LeapColorsDark.background, width: 1.5)", "border: Border.all(color: const Color(0xFF0B3146), width: 1.5)", false]]}, {"file": "apps/mobile/lib/features/account/loyalty_card.dart", "what": "Account tier card: 12 px from the cards around it", "done": "padding: const EdgeInsets.fromLTRB(16, 6, 16, 6),\n      child: Material(", "pairs": [["      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),\n      child: Material(", "      padding: const EdgeInsets.fromLTRB(16, 6, 16, 6),\n      child: Material(", false]]}, {"file": "apps/mobile/lib/features/account/site_pages.dart", "what": "Account: Help and Useful links as raised rows like the rest of the page", "done": "return PressDown(child: Padding(", "pairs": [["import '../../core/theme.dart';\n", "import '../../core/theme.dart';\nimport '../../widgets/premium.dart';\n", false], ["          padding: const EdgeInsets.fromLTRB(20, 18, 20, 8),\n          child: Text(s.toUpperCase(), style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 0.5, color: palette.muted)),", "          padding: const EdgeInsets.fromLTRB(16, 6, 16, 8),\n          child: Text(s.toUpperCase(), style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 1, color: palette.signalDark)),", false], ["    return Padding(\n      padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),\n      child: Material(\n        color: Colors.transparent,\n        child: InkWell(\n          borderRadius: BorderRadius.circular(14),\n          onTap: onTap,\n          child: Container(\n            decoration: BoxDecoration(color: palette.card, borderRadius: BorderRadius.circular(14)),", "    return PressDown(child: Padding(\n      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),\n      child: Material(\n        color: Colors.transparent,\n        child: InkWell(\n          borderRadius: BorderRadius.circular(14),\n          onTap: onTap,\n          child: Container(\n            decoration: Premium.card(context),", false], ["                  decoration: BoxDecoration(color: isDark ? palette.signal.withValues(alpha: 0.12) : palette.signal, borderRadius: BorderRadius.circular(8)),", "                  decoration: isDark ? BoxDecoration(color: palette.signal.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8)) : Premium.goldRaised(radius: 8),", false], ["        ),\n      ),\n    );\n  }\n}\n\nconst _monthsEn", "        ),\n      ),\n    ));\n  }\n}\n\nconst _monthsEn", false], ["          margin: const EdgeInsets.fromLTRB(16, 14, 16, 24),", "          margin: const EdgeInsets.fromLTRB(16, 0, 16, 24),", false]]}, {"file": "apps/mobile/lib/features/home/home_screen.dart", "what": "Home: section icons raised without the white rim", "done": "                              decoration: Premium.round(context),\n                              clipBehavior: Clip.antiAlias,", "pairs": [["                              padding: const EdgeInsets.all(2),      // the white rim shows around the photo\n", "", false]]}, {"file": "apps/mobile/lib/features/cart/cart_screen.dart", "what": "Cart: Get a quotation is a raised button", "done": "Key('cart-get-quotation')", "pairs": [["child: SizedBox(width: double.infinity, child: OutlinedButton(onPressed: () => context.push('/quotations/new'), child: Text(qtr(context, 'get_quotation')))),", "child: PressDown(\n                          child: DecoratedBox(\n                            decoration: BoxDecoration(\n                              color: palette.card,\n                              borderRadius: BorderRadius.circular(999),\n                              boxShadow: const [BoxShadow(color: Color(0x1F0B3146), blurRadius: 8, offset: Offset(0, 4)), BoxShadow(color: Color(0x290B3146), blurRadius: 20, offset: Offset(0, 10))],\n                            ),\n                            child: SizedBox(\n                              width: double.infinity,\n                              child: OutlinedButton(\n                                key: const Key('cart-get-quotation'),\n                                style: OutlinedButton.styleFrom(side: BorderSide(color: palette.ink, width: 1.5), foregroundColor: palette.ink),\n                                onPressed: () => context.push('/quotations/new'),\n                                child: Text(qtr(context, 'get_quotation')),\n                              ),\n                            ),\n                          ),\n                        ),", false]]}, {"file": "apps/mobile/lib/widgets/product_card.dart", "what": "product cards (Home's Newest / My car, search, Recently viewed): raised cards lit from above", "done": "decoration: Premium.card(context, radius: 12),\n        child: Card(", "pairs": [["import '../core/theme.dart';\n", "import '../core/theme.dart';\nimport 'premium.dart';\n", false], ["      child: Padding(\n        padding: EdgeInsets.zero,\n        child: Card(\n      margin: EdgeInsets.zero,\n      color: palette.card,", "      child: Container(\n        decoration: Premium.card(context, radius: 12),\n        child: Card(\n      margin: EdgeInsets.zero,\n      color: Colors.transparent,\n      elevation: 0,\n      shadowColor: Colors.transparent,", false]]}, {"file": "apps/mobile/lib/widgets/brand_logo_marquee.dart", "what": "Home brand strip: a raised card with raised logo buttons", "done": "decoration: Premium.card(context, radius: 16),\n      padding: const EdgeInsets.symmetric(horizontal: 10),", "pairs": [["import '../core/theme.dart';\n", "import '../core/theme.dart';\nimport 'premium.dart';\n", false], ["        SizedBox(\n      height: _circleSize,\n      child: SingleChildScrollView(\n        controller: _scrollController,", "        Container(\n      decoration: Premium.card(context, radius: 16),\n      padding: const EdgeInsets.symmetric(horizontal: 10),\n      child: SizedBox(\n      height: _circleSize + 20,\n      child: SingleChildScrollView(\n        controller: _scrollController,\n        padding: const EdgeInsets.symmetric(vertical: 10),      // room for the logos' shadows", false], ["                  decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: palette.line)),", "                  decoration: Premium.round(context),", false], ["      ),\n        ),\n        const SizedBox(height: 12),\n      ],", "      ),\n        )),\n        const SizedBox(height: 12),\n      ],", false]]}, {"file": "apps/mobile/lib/widgets/home_banner.dart", "what": "Home banner: floats on a deep shadow with a soft shine", "done": "Premium 3D: the banner floats on a deep shadow", "pairs": [["      padding: const EdgeInsets.only(bottom: 16),\n      child: AspectRatio(\n        aspectRatio: _aspect,\n        child: ClipRRect(", "      padding: const EdgeInsets.only(bottom: 20),\n      child: AspectRatio(\n        aspectRatio: _aspect,\n        // Premium 3D: the banner floats on a deep shadow, with a soft shine across its top\n        child: DecoratedBox(\n        decoration: BoxDecoration(borderRadius: BorderRadius.circular(14), boxShadow: const [BoxShadow(color: Color(0x330B3146), blurRadius: 6, offset: Offset(0, 2)), BoxShadow(color: Color(0x590B3146), blurRadius: 26, offset: Offset(0, 12))]),\n        child: ClipRRect(", false], ["              if (count > 1) Positioned(left: 0, right: 0, bottom: 8, child: _dots(count)),", "              const Positioned.fill(child: IgnorePointer(child: DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.center, colors: [Color(0x38FFFFFF), Color(0x00FFFFFF)]))))),\n              if (count > 1) Positioned(left: 0, right: 0, bottom: 8, child: _dots(count)),", false], ["          ),\n        ),\n      ),\n    );\n  }\n}", "          ),\n        ),\n      )),\n    );\n  }\n}", false]]}]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-premium-3d-polish`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Then: buyer app: q, then flutter run --dart-define=API_BASE_URL=http://192.168.0.210:4000');
