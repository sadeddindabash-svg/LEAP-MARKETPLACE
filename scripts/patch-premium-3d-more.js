#!/usr/bin/env node
/**
 * Buyer app: style B "Premium 3D", step 2 (confirmed with the person via mockup):
 *  - Account, every box: the photo-and-name header, the tier card, Appearance, App lock, Log out and Delete account are raised cards;
 *    the footer is a glossy raised navy box (the rows and the three numbers were done in step 1);
 *  - Home: each section icon is a raised round button with a white rim that sinks when tapped; the Recently viewed cards are raised and sink too;
 *  - Cart: every part is a raised card, the − / + is raised gold, the summary is raised, the checkout bar floats over the list.
 * Light and dark mode. Run it after patch-premium-3d.
 *
 *   node scripts/patch-premium-3d-more.js            dry run
 *   node scripts/patch-premium-3d-more.js --write    applies it (each changed file is saved as <file>.before-premium-3d-more first)
 * Then: buyer app: q, then flutter run --dart-define=API_BASE_URL=http://192.168.0.210:4000   (No server change, no website change.)
 *
 * A file that is not as this patch expects is NOT changed (the whole patch stops; send that file). Windows (CRLF) line endings are handled.
 * Running it twice is harmless.
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"created": [], "anchored": [{"file": "apps/mobile/lib/widgets/premium.dart", "what": "the Premium 3D look: raised round buttons and raised boxes", "done": "class PremiumBox extends StatelessWidget", "pairs": [["  /// A small floating pill (a tab that is not chosen).\n", "  /// A raised round button (a section icon on Home): a white rim, lit from above.\n  static BoxDecoration round(BuildContext context) {\n    if (Theme.of(context).brightness == Brightness.dark) {\n      return BoxDecoration(\n        color: LeapPalette.of(context).card,\n        shape: BoxShape.circle,\n        border: Border.all(color: Colors.white.withValues(alpha: 0.08), width: 2),\n        boxShadow: const [BoxShadow(color: Color(0x66000000), blurRadius: 14, offset: Offset(0, 6))],\n      );\n    }\n    return BoxDecoration(\n      shape: BoxShape.circle,\n      gradient: const LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Colors.white, Color(0xFFEEF2F6)]),\n      border: Border.all(color: Colors.white, width: 2),\n      boxShadow: const [\n        BoxShadow(color: Color(0x1A0B3146), blurRadius: 5, offset: Offset(0, 3)),\n        BoxShadow(color: Color(0x290B3146), blurRadius: 18, spreadRadius: -2, offset: Offset(0, 10)),\n      ],\n    );\n  }\n\n  /// A small floating pill (a tab that is not chosen).\n", false], ["/// Makes its child sink a little while a finger is on it", "/// A box of a screen as a raised card (Account: the header, Appearance, App lock, Log out, Delete account). Taps and ink still work inside it.\nclass PremiumBox extends StatelessWidget {\n  final Widget child;\n  final double radius;\n  final EdgeInsetsGeometry margin;\n  const PremiumBox({super.key, required this.child, this.radius = 14, this.margin = const EdgeInsets.fromLTRB(16, 6, 16, 6)});\n\n  @override\n  Widget build(BuildContext context) => Padding(\n        padding: margin,\n        child: DecoratedBox(\n          decoration: Premium.card(context, radius: radius),\n          child: ClipRRect(borderRadius: BorderRadius.circular(radius), child: Material(type: MaterialType.transparency, child: child)),\n        ),\n      );\n}\n\n/// Makes its child sink a little while a finger is on it", false]]}, {"file": "apps/mobile/lib/features/account/account_screen.dart", "what": "Account: every box is raised (header, Appearance, App lock, Log out, Delete account)", "done": "slide('header', PremiumBox(radius: 18, child: _LoggedInHeader(", "pairs": [["            slide('header', _LoggedInHeader(user: auth.user!))\n          else\n            slide('header', _LoggedOutHeader()),", "            slide('header', PremiumBox(radius: 18, child: _LoggedInHeader(user: auth.user!)))\n          else\n            slide('header', PremiumBox(radius: 18, child: _LoggedOutHeader())),", false], ["          const Divider(height: 24),\n", "          const SizedBox(height: 14),\n", false], ["          const Divider(height: 1),\n          slide('appearance', const _ThemeSection()),", "          const SizedBox(height: 6),\n          slide('appearance', const PremiumBox(child: _ThemeSection())),", false], ["            slide('log-out', ListTile(", "            slide('log-out', PremiumBox(child: ListTile(", false], ["              onTap: () => context.read<AuthState>().logout(),\n            )),\n          if (auth.isLoggedIn)\n            slide('delete', ListTile(", "              onTap: () => context.read<AuthState>().logout(),\n            ))),\n          if (auth.isLoggedIn)\n            slide('delete', PremiumBox(child: ListTile(", false], ["              onTap: () => _confirmDeleteAccount(context),\n            )),\n          slide('footer'", "              onTap: () => _confirmDeleteAccount(context),\n            ))),\n          slide('footer'", false], ["    return Padding(\n      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),\n      child: Row(\n        children: [\n          Expanded(\n            child: Column(", "    return PremiumBox(child: Padding(\n      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),\n      child: Row(\n        children: [\n          Expanded(\n            child: Column(", false], ["            onChanged: (value) => _handleToggle(context, value),\n          ),\n        ],\n      ),\n    );", "            onChanged: (value) => _handleToggle(context, value),\n          ),\n        ],\n      ),\n    ));", false]]}, {"file": "apps/mobile/lib/features/account/loyalty_card.dart", "what": "Account tier card: raised", "done": "decoration: Premium.card(context),", "pairs": [["import '../../core/theme.dart';\n", "import '../../core/theme.dart';\nimport '../../widgets/premium.dart';\n", false], ["            decoration: BoxDecoration(color: palette.card, borderRadius: BorderRadius.circular(14), border: Border.all(color: palette.line)),", "            decoration: Premium.card(context),", false]]}, {"file": "apps/mobile/lib/features/account/site_pages.dart", "what": "Account footer: a glossy raised navy box", "done": "colors: [Color(0xFF0F2A3A), Color(0xFF1D4F6B)]", "pairs": [["decoration: BoxDecoration(color: const Color(0xFF0F2A3A), borderRadius: BorderRadius.circular(16)),", "decoration: BoxDecoration(gradient: const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFF0F2A3A), Color(0xFF1D4F6B)]), borderRadius: BorderRadius.circular(16), boxShadow: const [BoxShadow(color: Color(0x590B3146), blurRadius: 26, offset: Offset(0, 12))]),", false]]}, {"file": "apps/mobile/lib/features/home/home_screen.dart", "what": "Home: raised section icons that sink when tapped, raised Recently viewed cards", "done": "decoration: Premium.round(context),", "pairs": [["import '../../core/theme.dart';\n", "import '../../core/theme.dart';\nimport '../../widgets/premium.dart';\n", false], ["                return GridView.count(\n                  crossAxisCount: 4,", "                return GridView.count(\n                  clipBehavior: Clip.none,      // the icons' shadows show at the edges\n                  crossAxisCount: 4,", false], ["                      return GestureDetector(\n                        onTap: () => context.push('/category-browse/${c.id}'),", "                      return PressDown(child: GestureDetector(\n                        onTap: () => context.push('/category-browse/${c.id}'),", false], ["                              decoration: BoxDecoration(\n                                color: palette.chalk,\n                                shape: BoxShape.circle,\n                              ),\n                              clipBehavior: Clip.antiAlias,", "                              decoration: Premium.round(context),\n                              padding: const EdgeInsets.all(2),      // the white rim shows around the photo\n                              clipBehavior: Clip.antiAlias,", false], ["                                  ? CachedNetworkImage(imageUrl: ApiClient.resolveMediaUrl(c.photoUrl!),", "                                  ? ClipOval(child: CachedNetworkImage(imageUrl: ApiClient.resolveMediaUrl(c.photoUrl!),", false], ["errorWidget: (context, url, error) => Icon(_iconForCategory(c.id), color: palette.signal, size: 31))\n                                  : Icon(_iconForCategory(c.id), color: palette.signal, size: 31),", "errorWidget: (context, url, error) => Icon(_iconForCategory(c.id), color: palette.signal, size: 31)))\n                                  : Icon(_iconForCategory(c.id), color: palette.signal, size: 31),", false], ["                        ),\n                      );\n                    }),\n                    if (showMoreTile)", "                        ),\n                      ));\n                    }),\n                    if (showMoreTile)", false], ["                              decoration: const BoxDecoration(\n                                color: Colors.white,\n                                shape: BoxShape.circle,\n                              ),\n                              child: Icon(Icons.grid_view", "                              decoration: Premium.round(context),\n                              child: Icon(Icons.grid_view", false], ["                        height: productCardHeightFor(140),\n                        child: ListView.separated(\n                          scrollDirection: Axis.horizontal,", "                        height: productCardHeightFor(140) + 16,\n                        child: ListView.separated(\n                          clipBehavior: Clip.none,      // the cards' shadows show\n                          padding: const EdgeInsets.only(bottom: 16),\n                          scrollDirection: Axis.horizontal,", false], ["return SizedBox(width: 140, child: ProductCard(product: p, onTap: () => context.push('/product/${p.id}')));", "return PressDown(child: SizedBox(width: 140, child: ProductCard(product: p, onTap: () => context.push('/product/${p.id}'))));", false]]}, {"file": "apps/mobile/lib/features/cart/cart_screen.dart", "what": "Cart: raised part cards, raised gold − / + , raised summary and checkout bar", "done": "decoration: Premium.goldRaised(radius: 999),", "pairs": [["import '../../widgets/skeleton.dart';\n", "import '../../widgets/skeleton.dart';\nimport '../../widgets/premium.dart';\n", false], ["              decoration: BoxDecoration(\n                color: palette.card,\n                border: Border(top: BorderSide(color: palette.line)),\n              ),", "              // the checkout bar floats over the list\n              decoration: BoxDecoration(\n                color: palette.card,\n                boxShadow: const [BoxShadow(color: Color(0x290B3146), blurRadius: 20, offset: Offset(0, -6))],\n              ),", false], ["        Container(\n          decoration: BoxDecoration(\n            color: palette.card,\n            borderRadius: BorderRadius.circular(12),\n            border: Border.all(color: palette.line),\n          ),", "        Container(\n          decoration: Premium.card(context),", false], ["      margin: const EdgeInsets.only(bottom: 10),\n      padding: const EdgeInsets.all(12),\n      decoration: BoxDecoration(\n        color: palette.card,\n        borderRadius: BorderRadius.circular(12),\n        border: Border.all(color: palette.line),\n      ),", "      margin: const EdgeInsets.only(bottom: 12),\n      padding: const EdgeInsets.all(12),\n      decoration: Premium.card(context),", false], ["decoration: BoxDecoration(color: palette.card, borderRadius: BorderRadius.circular(999), border: Border.all(color: palette.line)),", "decoration: Premium.goldRaised(radius: 999),", false]]}]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-premium-3d-more`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Then: buyer app: q, then flutter run --dart-define=API_BASE_URL=http://192.168.0.210:4000');
