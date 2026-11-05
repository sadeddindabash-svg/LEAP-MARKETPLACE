#!/usr/bin/env node
/**
 * Buyer app: style B "Premium 3D" (confirmed with the person via mockup), step 1: the app's theme + Account, Shop and Orders.
 *  - theme (every screen): every Card floats on a soft deep shadow; the gold buttons are raised and sink while pressed; the top bar casts a soft shadow;
 *  - Account: the list rows and the three numbers are raised cards lit from above, the gold icons are raised, a row sinks while pressed;
 *  - Shop: the chosen section rises out of the side column as a raised card; the parts are raised cards that sink while pressed;
 *  - Orders: the chosen tab is raised gold, the others float; the summary boxes and the orders are raised and sink while pressed.
 * Light and dark mode. The slide-in motion stays. Run it after patch-slide-in-pages.
 *
 *   node scripts/patch-premium-3d.js            dry run
 *   node scripts/patch-premium-3d.js --write    applies it (each changed file is saved as <file>.before-premium-3d first)
 * Then: buyer app: q, then flutter run --dart-define=API_BASE_URL=http://192.168.0.210:4000   (No server change, no website change.)
 *
 * A file that is not as this patch expects is NOT changed (the whole patch stops; send that file). Windows (CRLF) line endings are handled.
 * Running it twice is harmless.
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"created": [{"file": "apps/mobile/lib/widgets/premium.dart", "what": "buyer app: the Premium 3D look (raised cards, raised gold, press to sink)", "text": "import 'package:flutter/material.dart';\nimport '../core/theme.dart';\n\n/// Style B \"Premium 3D\" (confirmed with the person via mockup): cards lit from above (a light top edge, a soft deep shadow), raised gold, and a\n/// press that makes a card sink a little. Light and dark mode.\nclass Premium {\n  Premium._();\n\n  static const gold = Color(0xFFF9B317);\n\n  /// A raised card: white to a faint grey from top to bottom, a white top edge, a near shadow and a deep soft one.\n  static BoxDecoration card(BuildContext context, {double radius = 14}) {\n    if (Theme.of(context).brightness == Brightness.dark) {\n      final p = LeapPalette.of(context);\n      return BoxDecoration(\n        color: p.card,\n        borderRadius: BorderRadius.circular(radius),\n        border: Border.all(color: Colors.white.withValues(alpha: 0.06)),\n        boxShadow: const [BoxShadow(color: Color(0x66000000), blurRadius: 18, offset: Offset(0, 8))],\n      );\n    }\n    return BoxDecoration(\n      gradient: const LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Colors.white, Color(0xFFF7F9FB)]),\n      borderRadius: BorderRadius.circular(radius),\n      border: Border.all(color: Colors.white),\n      boxShadow: const [\n        BoxShadow(color: Color(0x140B3146), blurRadius: 4, offset: Offset(0, 2)),\n        BoxShadow(color: Color(0x290B3146), blurRadius: 22, spreadRadius: -4, offset: Offset(0, 10)),\n      ],\n    );\n  }\n\n  /// Raised gold (an icon tile, the chosen tab): a light-to-deep gold gradient and a warm shadow.\n  static BoxDecoration goldRaised({double radius = 9}) => BoxDecoration(\n        gradient: const LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xFFFFD567), gold, Color(0xFFE39F0C)], stops: [0, 0.55, 1]),\n        borderRadius: BorderRadius.circular(radius),\n        boxShadow: const [BoxShadow(color: Color(0x73E39F0C), blurRadius: 10, offset: Offset(0, 4))],\n      );\n\n  /// A small floating pill (a tab that is not chosen).\n  static BoxDecoration pill(BuildContext context, {double radius = 20}) {\n    final p = LeapPalette.of(context);\n    final dark = Theme.of(context).brightness == Brightness.dark;\n    return BoxDecoration(\n      color: p.card,\n      borderRadius: BorderRadius.circular(radius),\n      border: Border.all(color: dark ? p.line : const Color(0xFFEEF1F5)),\n      boxShadow: [BoxShadow(color: dark ? const Color(0x4D000000) : const Color(0x1A0B3146), blurRadius: 6, offset: const Offset(0, 2))],\n    );\n  }\n}\n\n/// Makes its child sink a little while a finger is on it (it does not take the tap: the InkWell or button inside still gets it).\nclass PressDown extends StatefulWidget {\n  final Widget child;\n  const PressDown({super.key, required this.child});\n\n  @override\n  State<PressDown> createState() => _PressDownState();\n}\n\nclass _PressDownState extends State<PressDown> {\n  bool _down = false;\n\n  void _set(bool v) {\n    if (_down != v && mounted) setState(() => _down = v);\n  }\n\n  @override\n  Widget build(BuildContext context) {\n    final d = Duration(milliseconds: MediaQuery.of(context).disableAnimations ? 0 : 120);\n    return Listener(\n      onPointerDown: (_) => _set(true),\n      onPointerUp: (_) => _set(false),\n      onPointerCancel: (_) => _set(false),\n      child: AnimatedSlide(\n        duration: d,\n        offset: Offset(0, _down ? 0.015 : 0),\n        child: AnimatedScale(duration: d, scale: _down ? 0.985 : 1, child: widget.child),\n      ),\n    );\n  }\n}\n"}], "anchored": [{"file": "apps/mobile/lib/core/theme.dart", "what": "the app's theme: cards float on a soft shadow, raised gold buttons that sink when pressed, the top bar casts a soft shadow", "done": "shadowColor: const WidgetStatePropertyAll(Color(0x99E39F0C))", "pairs": [["      elevatedButtonTheme: ElevatedButtonThemeData(\n        style: ElevatedButton.styleFrom(\n          backgroundColor: LeapColors.signal,\n          foregroundColor: LeapColors.onSignal,\n          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 20),\n          shape: pillShape,\n          textStyle: GoogleFonts.manrope(fontWeight: FontWeight.w700, fontSize: 15),\n        ),\n      ),", "      // Premium 3D (style B): every Card floats on a soft deep shadow\n      cardTheme: CardThemeData(\n        color: Colors.white,\n        surfaceTintColor: Colors.transparent,\n        elevation: 4,\n        shadowColor: const Color(0x400B3146),\n        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),\n      ),\n      elevatedButtonTheme: ElevatedButtonThemeData(\n        style: ElevatedButton.styleFrom(\n          backgroundColor: LeapColors.signal,\n          foregroundColor: LeapColors.onSignal,\n          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 20),\n          shape: pillShape,\n          textStyle: GoogleFonts.manrope(fontWeight: FontWeight.w700, fontSize: 15),\n        ).copyWith(\n          // raised gold: it sinks while pressed\n          elevation: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.pressed) ? 1.0 : 4.0),\n          shadowColor: const WidgetStatePropertyAll(Color(0x99E39F0C)),\n        ),\n      ),", false], ["      elevatedButtonTheme: ElevatedButtonThemeData(\n        style: ElevatedButton.styleFrom(\n          backgroundColor: LeapColorsDark.signal,\n          foregroundColor: LeapColorsDark.onSignal,\n          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 20),\n          shape: pillShape,\n          textStyle: GoogleFonts.manrope(fontWeight: FontWeight.w700, fontSize: 15),\n        ),\n      ),", "      // Premium 3D (style B): every Card floats on a soft deep shadow\n      cardTheme: CardThemeData(\n        color: LeapColorsDark.surface,\n        surfaceTintColor: Colors.transparent,\n        elevation: 4,\n        shadowColor: const Color(0x80000000),\n        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),\n      ),\n      elevatedButtonTheme: ElevatedButtonThemeData(\n        style: ElevatedButton.styleFrom(\n          backgroundColor: LeapColorsDark.signal,\n          foregroundColor: LeapColorsDark.onSignal,\n          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 20),\n          shape: pillShape,\n          textStyle: GoogleFonts.manrope(fontWeight: FontWeight.w700, fontSize: 15),\n        ).copyWith(\n          // raised gold: it sinks while pressed\n          elevation: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.pressed) ? 1.0 : 4.0),\n          shadowColor: const WidgetStatePropertyAll(Color(0x99E39F0C)),\n        ),\n      ),", false], ["        elevation: 0,\n        centerTitle: false,\n        titleTextStyle: GoogleFonts.manrope(fontSize: 18, fontWeight: FontWeight.w700, color: LeapColors.ink),", "        elevation: 2,\n        scrolledUnderElevation: 3,\n        shadowColor: const Color(0x2E0B3146),\n        surfaceTintColor: Colors.transparent,\n        centerTitle: false,\n        titleTextStyle: GoogleFonts.manrope(fontSize: 18, fontWeight: FontWeight.w700, color: LeapColors.ink),", false], ["        elevation: 0,\n        centerTitle: false,\n        titleTextStyle: GoogleFonts.manrope(fontSize: 18, fontWeight: FontWeight.w700, color: LeapColorsDark.onSurface),", "        elevation: 2,\n        scrolledUnderElevation: 3,\n        shadowColor: const Color(0x66000000),\n        surfaceTintColor: Colors.transparent,\n        centerTitle: false,\n        titleTextStyle: GoogleFonts.manrope(fontSize: 18, fontWeight: FontWeight.w700, color: LeapColorsDark.onSurface),", false]]}, {"file": "apps/mobile/lib/features/account/account_screen.dart", "what": "Account: raised cards and gold icons, rows sink when pressed", "done": "Premium.goldRaised(radius: 8)", "pairs": [["import '../../widgets/slide_in.dart';\n", "import '../../widgets/slide_in.dart';\nimport '../../widgets/premium.dart';\n", false], ["                        decoration: BoxDecoration(color: palette.card, borderRadius: BorderRadius.circular(14)),\n                        padding: const EdgeInsets.all(14),", "                        decoration: Premium.card(context),\n                        padding: const EdgeInsets.all(14),", false], ["                              decoration: BoxDecoration(\n                                color: isDark ? palette.signal.withValues(alpha: 0.12) : palette.signal,\n                                borderRadius: BorderRadius.circular(8),\n                              ),", "                              decoration: isDark ? BoxDecoration(color: palette.signal.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8)) : Premium.goldRaised(radius: 8),", false], ["  Widget build(BuildContext context) => SlideIn(index: index, child: child);", "  Widget build(BuildContext context) => SlideIn(index: index, child: PressDown(child: child));", false], ["      padding: const EdgeInsets.symmetric(vertical: 14),\n      decoration: BoxDecoration(color: palette.card, borderRadius: BorderRadius.circular(12), border: Border.all(color: palette.line)),", "      padding: const EdgeInsets.symmetric(vertical: 14),\n      decoration: Premium.card(context, radius: 12),", false]]}, {"file": "apps/mobile/lib/features/catalog/category_browse_screen.dart", "what": "Shop: the chosen section rises, raised part cards", "done": "margin: selected ? const EdgeInsets.symmetric(horizontal: 4, vertical: 3)", "pairs": [["import '../../widgets/slide_in.dart';\n", "import '../../widgets/slide_in.dart';\nimport '../../widgets/premium.dart';\n", false], ["                          child: Container(\n                            padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),\n                            decoration: BoxDecoration(\n                              color: selected ? palette.card : Colors.transparent,\n                              border: Border(left: BorderSide(color: selected ? palette.signal : Colors.transparent, width: 3)),\n                            ),", "                          child: Container(\n                            padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),\n                            // the chosen section rises out of the side column as a raised card\n                            margin: selected ? const EdgeInsets.symmetric(horizontal: 4, vertical: 3) : EdgeInsets.zero,\n                            decoration: selected ? Premium.card(context, radius: 12) : const BoxDecoration(),", false], ["                        separatorBuilder: (_, __) => const SizedBox(height: 8),", "                        separatorBuilder: (_, __) => const SizedBox(height: 10),", false], ["                          return SlideIn(index: i, child: Container(\n                            decoration: BoxDecoration(color: palette.chalk, borderRadius: BorderRadius.circular(10), border: Border.all(color: palette.line)),", "                          return SlideIn(index: i, child: PressDown(child: Container(\n                            decoration: Premium.card(context),", false], ["                            ),\n                          ));\n                        },\n                      ));", "                            ),\n                          )));\n                        },\n                      ));", false]]}, {"file": "apps/mobile/lib/features/orders/orders_screen.dart", "what": "Orders: raised gold tab, floating tabs, raised summary and order cards", "done": "Premium.goldRaised(radius: 20)", "pairs": [["import '../../widgets/slide_in.dart';\n", "import '../../widgets/slide_in.dart';\nimport '../../widgets/premium.dart';\n", false], ["                      decoration: BoxDecoration(\n                        color: selected ? palette.signal : palette.card,\n                        borderRadius: BorderRadius.circular(20),\n                        border: Border.all(color: selected ? palette.signal : palette.line),\n                      ),", "                      decoration: selected ? Premium.goldRaised(radius: 20) : Premium.pill(context),", false], ["decoration: BoxDecoration(color: palette.card, border: Border.all(color: palette.line), borderRadius: BorderRadius.circular(12)),", "decoration: Premium.card(context, radius: 12),", true], ["                    itemBuilder: (context, i) => SlideIn(index: i, child: Builder(builder: (context) {", "                    itemBuilder: (context, i) => SlideIn(index: i, child: PressDown(child: Builder(builder: (context) {", false], ["                      );\n                    })),\n                  ));", "                      );\n                    }))),\n                  ));", false]]}]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-premium-3d`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Then: buyer app: q, then flutter run --dart-define=API_BASE_URL=http://192.168.0.210:4000');
