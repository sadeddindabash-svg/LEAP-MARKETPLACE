#!/usr/bin/env node
/**
 * Buyer app home (confirmed with the person via mockup): while the buyer scrolls down, the top bar (logo, "LEAP Auto Parts", Get a quote, support) slides up out of
 * sight and only the navy search bar stays at the top; scrolling up (even a little) or reaching the top brings it back. Only the home screen. Run after
 * patch-app-home-topbar.
 *
 *   node scripts/patch-app-home-hide-top.js            dry run
 *   node scripts/patch-app-home-hide-top.js --write    applies it (the changed file is saved as <file>.before-patch-app-home-hide-top first)
 * Then: buyer app: R (hot restart)
 */
const DATA = {"created": [], "replaced": [], "anchored": [{"file": "apps/mobile/lib/features/home/home_screen.dart", "what": "buyer app home: the top bar hides while scrolling down (the search bar stays) and comes back on the way up", "done": "class _TopBarReveal", "pairs": [["import 'package:flutter/material.dart';\n", "import 'package:flutter/material.dart';\nimport 'package:flutter/rendering.dart' show ScrollDirection;\n", false], ["class _HomeScreenState extends State<HomeScreen> {\n", "class _HomeScreenState extends State<HomeScreen> with SingleTickerProviderStateMixin {\n  // The top bar (logo, name, Get a quote, support): 1 = shown, 0 = hidden. It slides away while the buyer scrolls down and comes back on the way up or at the\n  // top of the page; the search bar under it always stays (confirmed with the person via mockup).\n  late final AnimationController _top = AnimationController(vsync: this, duration: const Duration(milliseconds: 220), value: 1);\n\n  bool _onUserScroll(UserScrollNotification n) {\n    if (n.depth != 0 || n.metrics.axis != Axis.vertical) return false;      // only the page itself (not the rows that slide sideways)\n    if (n.direction == ScrollDirection.reverse && n.metrics.pixels > 24) {\n      if (_top.value > 0 && _top.status != AnimationStatus.reverse) _top.reverse();\n    } else if (n.direction == ScrollDirection.forward || n.metrics.pixels <= 0) {\n      if (_top.value < 1 && _top.status != AnimationStatus.forward) _top.forward();\n    }\n    return false;\n  }\n\n  @override\n  void dispose() {\n    _top.dispose();\n    super.dispose();\n  }\n\n", false], ["    return Scaffold(\n      // Real, fixed app bar (new) -- matches the real Stitch reference\n      // design directly (a docked/fixed header, not scrolling away\n      // with the rest of the page). Also more idiomatic Flutter than\n      // the previous in-ListView Row.\n      appBar: AppBar(\n        automaticallyImplyLeading: false,\n        titleSpacing: 16,", "    // the page is built once; only the top bar follows the slide (_top)\n    return AnimatedBuilder(\n      animation: _top,\n      builder: (context, body) => Scaffold(\n      // The top bar slides away while scrolling down; the search bar (its bottom) always stays.\n      appBar: AppBar(\n        automaticallyImplyLeading: false,\n        titleSpacing: 16,\n        toolbarHeight: kToolbarHeight * _top.value,", false], ["        title: Row(\n          mainAxisAlignment: MainAxisAlignment.spaceBetween,", "        title: _TopBarReveal(shown: _top.value, child: Row(\n          mainAxisAlignment: MainAxisAlignment.spaceBetween,", false], ["        ),\n      ),\n      body: SafeArea(", "        )),\n      ),\n      body: body,\n      ),\n      child: NotificationListener<UserScrollNotification>(\n        onNotification: _onUserScroll,\n        child: SafeArea(", false], ["          ],\n          ),\n        ),\n      ),\n    );\n  }", "          ],\n          ),\n        ),\n      ),\n      ),\n    );\n  }", false], ["        ),\n      ),\n    ));\n  }\n}\n", "        ),\n      ),\n    ));\n  }\n}\n\n/// The top bar's content while it slides: drawn at its full height and cut to the part still shown, fading as it goes.\nclass _TopBarReveal extends StatelessWidget {\n  final double shown;\n  final Widget child;\n  const _TopBarReveal({required this.shown, required this.child});\n\n  @override\n  Widget build(BuildContext context) {\n    return ClipRect(\n      child: OverflowBox(\n        minHeight: kToolbarHeight,\n        maxHeight: kToolbarHeight,\n        alignment: Alignment.bottomCenter,\n        child: Opacity(opacity: shown.clamp(0.0, 1.0), child: Center(child: child)),\n      ),\n    );\n  }\n}\n", false]]}]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-patch-app-home-hide-top`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Then: buyer app: R (hot restart)');
