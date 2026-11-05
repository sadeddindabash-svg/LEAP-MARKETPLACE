#!/usr/bin/env node
/**
 * Buyer app, Account: the list (My garage, Addresses, Wishlist ... Two-factor sign-in) comes in one row after another, idea B "Slide from the side"
 * (confirmed with the person via mockup): each row slides in from the start side (from the right in Arabic) and fades in, 0.055 s after the one before,
 * 0.45 s each, every time the Account screen opens. The profile, numbers and tier card at the top stay as they are. Reduce motion: no movement.
 *
 *   node scripts/patch-account-slide-in.js            dry run
 *   node scripts/patch-account-slide-in.js --write    applies it (the changed file is saved as <file>.before-account-slide-in first)
 * Then: buyer app: q, then flutter run --dart-define=API_BASE_URL=http://192.168.0.210:4000   (No server change, no website change.)
 *
 * A file that is not as this patch expects is NOT changed. Windows (CRLF) line endings are handled. Running it twice is harmless.
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"created": [], "anchored": [{"file": "apps/mobile/lib/features/account/account_screen.dart", "what": "buyer app Account: the list rows slide in one after another", "done": "class _SlideInRow extends StatefulWidget", "pairs": [["                return Padding(\n                  padding: const EdgeInsets.only(bottom: 8),\n                  child: Material(\n", "                return _SlideInRow(\n                  index: rows.indexOf(r),\n                  child: Padding(\n                  padding: const EdgeInsets.only(bottom: 8),\n                  child: Material(\n", false], ["                    ),\n                  ),\n                );\n              }).toList(),\n", "                    ),\n                  ),\n                ));\n              }).toList(),\n", false]], "block": {"from": "class _ProfileStat extends StatefulWidget {", "to": "class _ProfileStat extends StatefulWidget {", "text": "/// The account list comes in one row after another (idea B, confirmed with the person via mockup): each row slides in from the start side\n/// (from the right in Arabic) and fades in, about 0.055 s after the one before it, every time the Account screen opens.\n/// A phone set to reduce motion shows the rows at once.\nclass _SlideInRow extends StatefulWidget {\n  final int index;\n  final Widget child;\n  const _SlideInRow({required this.index, required this.child});\n\n  @override\n  State<_SlideInRow> createState() => _SlideInRowState();\n}\n\nclass _SlideInRowState extends State<_SlideInRow> with SingleTickerProviderStateMixin {\n  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 450));\n  late final Animation<double> _t = CurvedAnimation(parent: _c, curve: const Cubic(0.2, 0.8, 0.2, 1));\n  Timer? _wait;\n  bool _started = false;\n\n  @override\n  void didChangeDependencies() {\n    super.didChangeDependencies();\n    if (_started) return;\n    _started = true;\n    if (MediaQuery.of(context).disableAnimations) {\n      _c.value = 1;\n    } else {\n      _wait = Timer(Duration(milliseconds: 55 * widget.index), () { if (mounted) _c.forward(); });\n    }\n  }\n\n  @override\n  void dispose() {\n    _wait?.cancel();\n    _c.dispose();\n    super.dispose();\n  }\n\n  @override\n  Widget build(BuildContext context) {\n    final from = Directionality.of(context) == TextDirection.rtl ? 40.0 : -40.0;\n    return AnimatedBuilder(\n      animation: _t,\n      child: widget.child,\n      builder: (context, child) => Opacity(\n        opacity: _t.value.clamp(0.0, 1.0),\n        child: Transform.translate(offset: Offset(from * (1 - _t.value), 0), child: child),\n      ),\n    );\n  }\n}\n\n", "includeTo": false}}]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-account-slide-in`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Then: buyer app: q, then flutter run --dart-define=API_BASE_URL=http://192.168.0.210:4000');
