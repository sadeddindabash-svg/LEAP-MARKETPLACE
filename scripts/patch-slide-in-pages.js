#!/usr/bin/env node
/**
 * Buyer app: the slide-in motion (idea B, confirmed with the person via mockup) on three screens. Each part slides in from the start side (from the right
 * in Arabic) and fades in, 0.055 s after the one before, 0.45 s each:
 *  - Account: the whole screen, top to bottom (photo and name, numbers, tier card, heading, the list, Appearance, App lock, Log out, Delete, footer);
 *  - Shop: the sections down the side when Shop opens, and the parts every time a section is chosen;
 *  - Orders: the tabs, then the summary and the orders on every tab (All, To ship, Shipped, Delivered, Returns).
 * Rows reached by scrolling just appear (nothing slides again while scrolling). A phone set to reduce motion shows everything at once.
 * Run it after patch-account-slide-in.
 *
 *   node scripts/patch-slide-in-pages.js            dry run
 *   node scripts/patch-slide-in-pages.js --write    applies it (each changed file is saved as <file>.before-slide-in-pages first)
 * Then: buyer app: q, then flutter run --dart-define=API_BASE_URL=http://192.168.0.210:4000   (No server change, no website change.)
 *
 * A file that is not as this patch expects is NOT changed (the whole patch stops; send that file). Windows (CRLF) line endings are handled.
 * Running it twice is harmless.
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"created": [{"file": "apps/mobile/lib/widgets/slide_in.dart", "what": "buyer app: the slide-in motion (idea B), shared by Account, Shop and Orders", "text": "import 'dart:async';\nimport 'package:flutter/material.dart';\n\n/// Where a group of [SlideIn]s starts counting from (a screen, or one list: Shop's parts, one Orders tab). Give it a new key to play its list again\n/// (another section, another tab). A [SlideIn] built more than [SlideInScope.window] after its scope opened (a row reached by scrolling) just appears,\n/// so nothing slides again while scrolling.\nclass SlideInScope extends StatefulWidget {\n  final Widget child;\n  const SlideInScope({super.key, required this.child});\n\n  static const window = Duration(milliseconds: 1200);\n\n  static DateTime? startOf(BuildContext context) => context.dependOnInheritedWidgetOfExactType<_SlideInStart>()?.start;\n\n  @override\n  State<SlideInScope> createState() => _SlideInScopeState();\n}\n\nclass _SlideInScopeState extends State<SlideInScope> {\n  final DateTime _start = DateTime.now();\n\n  @override\n  Widget build(BuildContext context) => _SlideInStart(start: _start, child: widget.child);\n}\n\nclass _SlideInStart extends InheritedWidget {\n  final DateTime start;\n  const _SlideInStart({required this.start, required super.child});\n\n  @override\n  bool updateShouldNotify(_SlideInStart old) => old.start != start;\n}\n\n/// Slide in from the side, idea B (confirmed with the person via mockup): from the start side (from the right in Arabic), fading in, 0.45 s,\n/// [index] x 0.055 s after its scope opened. A phone set to reduce motion shows it at once.\nclass SlideIn extends StatefulWidget {\n  final int index;\n  final Widget child;\n  const SlideIn({super.key, required this.index, required this.child});\n\n  @override\n  State<SlideIn> createState() => _SlideInState();\n}\n\nclass _SlideInState extends State<SlideIn> with SingleTickerProviderStateMixin {\n  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 450));\n  late final Animation<double> _t = CurvedAnimation(parent: _c, curve: const Cubic(0.2, 0.8, 0.2, 1));\n  Timer? _wait;\n  bool _started = false;\n\n  @override\n  void didChangeDependencies() {\n    super.didChangeDependencies();\n    if (_started) return;\n    _started = true;\n    final start = SlideInScope.startOf(context);\n    final elapsed = start == null ? 0 : DateTime.now().difference(start).inMilliseconds;\n    if (MediaQuery.of(context).disableAnimations || elapsed > SlideInScope.window.inMilliseconds) {\n      _c.value = 1;\n      return;\n    }\n    final wait = 55 * widget.index - elapsed;\n    if (wait <= 0) {\n      _c.forward();\n    } else {\n      _wait = Timer(Duration(milliseconds: wait), () { if (mounted) _c.forward(); });\n    }\n  }\n\n  @override\n  void dispose() {\n    _wait?.cancel();\n    _c.dispose();\n    super.dispose();\n  }\n\n  @override\n  Widget build(BuildContext context) {\n    final from = Directionality.of(context) == TextDirection.rtl ? 40.0 : -40.0;\n    return AnimatedBuilder(\n      animation: _t,\n      child: widget.child,\n      builder: (context, child) => Opacity(\n        opacity: _t.value.clamp(0.0, 1.0),\n        child: Transform.translate(offset: Offset(from * (1 - _t.value), 0), child: child),\n      ),\n    );\n  }\n}\n"}], "anchored": [{"file": "apps/mobile/lib/features/account/account_screen.dart", "what": "Account: every part of the screen slides in", "done": "Widget slide(String key, Widget child) => SlideIn(", "pairs": [["import '../../widgets/theme_reveal.dart';\n", "import '../../widgets/theme_reveal.dart';\nimport '../../widgets/slide_in.dart';\n", false], ["    final auth = context.watch<AuthState>();\n\n    final rows = [", "    final auth = context.watch<AuthState>();\n    // every part of the screen slides in, one after another from the top (idea B)\n    var seq = 0;\n    Widget slide(String key, Widget child) => SlideIn(key: ValueKey('account-$key'), index: seq++, child: child);\n\n    final rows = [", false], ["      body: ListView(\n        children: [\n          if (auth.isLoading)", "      body: SlideInScope(child: ListView(\n        children: [\n          if (auth.isLoading)", false], ["            _LoggedInHeader(user: auth.user!)\n          else\n            _LoggedOutHeader(),", "            slide('header', _LoggedInHeader(user: auth.user!))\n          else\n            slide('header', _LoggedOutHeader()),", false], ["          if (auth.isLoggedIn && _vehicleCount != null)\n            Padding(\n              padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),", "          if (auth.isLoggedIn && _vehicleCount != null)\n            slide('numbers', Padding(\n              padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),", false], ["                ],\n              ),\n            ),\n          if (auth.isLoggedIn) const LoyaltyCard(),\n          const Divider(height: 24),\n          Padding(\n            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),", "                ],\n              ),\n            )),\n          if (auth.isLoggedIn) slide('tier', const LoyaltyCard()),\n          const Divider(height: 24),\n          slide('heading', Padding(\n            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),", false], ["              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: LeapPalette.of(context).signalDark, letterSpacing: 1),\n            ),\n          ),\n", "              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: LeapPalette.of(context).signalDark, letterSpacing: 1),\n            ),\n          )),\n", false], ["                  index: rows.indexOf(r),\n", "                  index: seq++,\n", false], ["          const _ThemeSection(),\n          if (auth.isLoggedIn) const _AppLockSection(),\n          if (auth.isLoggedIn)\n            ListTile(", "          slide('appearance', const _ThemeSection()),\n          if (auth.isLoggedIn) slide('app-lock', const _AppLockSection()),\n          if (auth.isLoggedIn)\n            slide('log-out', ListTile(", false], ["              onTap: () => context.read<AuthState>().logout(),\n            ),\n          if (auth.isLoggedIn)\n            ListTile(", "              onTap: () => context.read<AuthState>().logout(),\n            )),\n          if (auth.isLoggedIn)\n            slide('delete', ListTile(", false], ["              onTap: () => _confirmDeleteAccount(context),\n            ),\n          const SiteFooterSection(),", "              onTap: () => _confirmDeleteAccount(context),\n            )),\n          slide('footer', const SiteFooterSection()),", false], ["(admin Settings)\n        ],\n      ),\n    );\n  }", "(admin Settings)\n        ],\n      )),\n    );\n  }", false]], "block": {"from": "/// The account list comes in one row after another", "to": "class _ProfileStat extends StatefulWidget {", "text": "/// One row of the account list: it slides in with the rest of the screen (see SlideIn in widgets/slide_in.dart).\nclass _SlideInRow extends StatelessWidget {\n  final int index;\n  final Widget child;\n  const _SlideInRow({required this.index, required this.child});\n\n  @override\n  Widget build(BuildContext context) => SlideIn(index: index, child: child);\n}\n\n"}}, {"file": "apps/mobile/lib/features/catalog/category_browse_screen.dart", "what": "Shop: the sections slide in, and the parts on every section", "done": "SlideInScope(key: ValueKey(_selectedCategoryId)", "pairs": [["import '../../core/theme.dart';\n", "import '../../core/theme.dart';\nimport '../../widgets/slide_in.dart';\n", false], ["          : Row(\n              children: [\n                // Real sidebar", "          : SlideInScope(child: Row(\n              children: [\n                // Real sidebar", false], ["                        return InkWell(\n                          onTap: () => _selectCategory(c.id),", "                        return SlideIn(index: i, child: InkWell(\n                          onTap: () => _selectCategory(c.id),", false], ["                          ),\n                        );\n                      },\n                    ),\n                  ),\n                ),\n                VerticalDivider(", "                          ),\n                        ));\n                      },\n                    ),\n                  ),\n                ),\n                VerticalDivider(", false], ["                      return ListView.separated(\n                        padding: const EdgeInsets.all(12),", "                      // the parts slide in again every time a section is chosen\n                      return SlideInScope(key: ValueKey(_selectedCategoryId), child: ListView.separated(\n                        padding: const EdgeInsets.all(12),", false], ["                          return Container(\n                            decoration: BoxDecoration(color: palette.chalk, borderRadius: BorderRadius.circular(10), border: Border.all(color: palette.line)),", "                          return SlideIn(index: i, child: Container(\n                            decoration: BoxDecoration(color: palette.chalk, borderRadius: BorderRadius.circular(10), border: Border.all(color: palette.line)),", false], ["                            ),\n                          );\n                        },\n                      );\n                    },\n                  ),\n                ),\n              ],\n            ),\n    );", "                            ),\n                          ));\n                        },\n                      ));\n                    },\n                  ),\n                ),\n              ],\n            )),\n    );", false]]}, {"file": "apps/mobile/lib/features/orders/orders_screen.dart", "what": "Orders: the tabs slide in, and the summary and orders on every tab", "done": "SlideInScope(key: ValueKey(_selectedTab)", "pairs": [["import '../../widgets/skeleton.dart';\n", "import '../../widgets/skeleton.dart';\nimport '../../widgets/slide_in.dart';\n", false], ["      body: Column(\n        children: [\n          SizedBox(\n            height: 56,", "      body: SlideInScope(child: Column(\n        children: [\n          SizedBox(\n            height: 56,", false], ["                return Padding(\n                  padding: const EdgeInsets.only(right: 8),\n                  child: InkWell(\n                    onTap: () => _selectTab(t.key),", "                return SlideIn(index: kOrderTabs.indexOf(t), child: Padding(\n                  padding: const EdgeInsets.only(right: 8),\n                  child: InkWell(\n                    onTap: () => _selectTab(t.key),", false], ["                  ),\n                );\n              }).toList(),\n            ),\n          ),\n          Divider(height: 1", "                  ),\n                ));\n              }).toList(),\n            ),\n          ),\n          Divider(height: 1", false], ["                  return ListView.separated(\n                    physics: const AlwaysScrollableScrollPhysics(),\n                    padding: const EdgeInsets.all(16),", "                  // the summary and the orders slide in again on every tab (All, To ship, Shipped, Delivered, Returns)\n                  return SlideInScope(key: ValueKey(_selectedTab), child: ListView.separated(\n                    physics: const AlwaysScrollableScrollPhysics(),\n                    padding: const EdgeInsets.all(16),", false], ["                    itemBuilder: (context, i) {\n                      if (_selectedTab == 'all' && i == 0) {", "                    itemBuilder: (context, i) => SlideIn(index: i, child: Builder(builder: (context) {\n                      if (_selectedTab == 'all' && i == 0) {", false], ["                      );\n                    },\n                  );\n                },\n              ),\n            ),\n          ),\n        ],\n      ),\n    );\n  }\n}", "                      );\n                    })),\n                  ));\n                },\n              ),\n            ),\n          ),\n        ],\n      )),\n    );\n  }\n}", false]]}]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-slide-in-pages`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Then: buyer app: q, then flutter run --dart-define=API_BASE_URL=http://192.168.0.210:4000');
