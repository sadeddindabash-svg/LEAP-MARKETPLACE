#!/usr/bin/env node
/**
 * App, Home: tapping Newest or My Car glides the page until the buttons sit just under the search bar;
 * the Active vehicle box in LEAP's navy 3D style (option B). Confirmed with the person via mockups.
 *   node scripts/patch-my-car-scroll.js            dry run
 *   node scripts/patch-my-car-scroll.js --write    applies it
 */
const DATA = {"created": [], "replaced": [], "anchored": [{"file": "apps/mobile/lib/features/home/home_screen.dart", "what": "App, Home: Newest / My Car glide the page up to just under the search bar; the Active vehicle box in navy 3D (option B)", "done": "_scrollToFilters()", "pairs": [["  String _feedFilter = 'newest'; // 'newest' | 'my_car'\n", "  String _feedFilter = 'newest'; // 'newest' | 'my_car'\n  // the Newest / My Car buttons: tapping one glides the page until they sit just under the search bar (patch-my-car-scroll)\n  final GlobalKey _filterKey = GlobalKey();\n", false], ["  void _setFilter(String filter) {\n    if (_feedFilter == filter) return;\n", "  void _scrollToFilters() {\n    final ctx = _filterKey.currentContext;\n    if (ctx == null) return;\n    Scrollable.ensureVisible(ctx, duration: const Duration(milliseconds: 450), curve: Curves.easeOutCubic, alignment: 0);\n  }\n\n  void _setFilter(String filter) {\n    _scrollToFilters();\n    if (_feedFilter == filter) return;\n", false], ["            // 4. Filter: Newest / My car\n            Row(\n              children: [", "            // 4. Filter: Newest / My car\n            Row(\n              key: _filterKey,\n              children: [", false], ["                    if (_feedFilter == 'my_car' && firstVehicle != null)\n                      Container(\n                        margin: const EdgeInsets.only(bottom: 12),\n                        padding: const EdgeInsets.all(12),\n                        decoration: BoxDecoration(\n                          color: palette.card,\n                          borderRadius: BorderRadius.circular(8),\n                          border: Border(left: BorderSide(color: palette.signal, width: 4)),\n                        ),\n                        child: Row(\n                          mainAxisAlignment: MainAxisAlignment.spaceBetween,\n                          children: [\n                            Column(\n                              crossAxisAlignment: CrossAxisAlignment.start,\n                              children: [\n                                Text(\n                                  isAr ? 'المركبة النشطة' : 'ACTIVE VEHICLE',\n                                  style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: palette.signalDark, letterSpacing: 1),\n                                ),\n                                const SizedBox(height: 2),\n                                Text('${firstVehicle.labelFor(isAr)} · ${firstVehicle.subLabel}', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: palette.ink)),\n                              ],\n                            ),\n                            Icon(Icons.check_circle, color: palette.signal),\n                          ],\n                        ),\n                      ),\n", "                    if (_feedFilter == 'my_car' && firstVehicle != null)\n                      // Active vehicle in LEAP's navy 3D style (patch-my-car-scroll, confirmed with the person via mockup, option B):\n                      // a navy gradient with a shine across the top, a deep shadow, a 3D gold car tile and a green 3D tick.\n                      Container(\n                        margin: const EdgeInsets.only(bottom: 12),\n                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 13),\n                        decoration: Premium.navyRaised(radius: 16),\n                        foregroundDecoration: Premium.gloss(radius: 16),\n                        child: Row(\n                          children: [\n                            Container(\n                              width: 42,\n                              height: 42,\n                              decoration: Premium.goldRaised(radius: 11),\n                              child: const Icon(Icons.directions_car_rounded, size: 24, color: Color(0xFF0B3146)),\n                            ),\n                            const SizedBox(width: 12),\n                            Expanded(\n                              child: Column(\n                                crossAxisAlignment: CrossAxisAlignment.start,\n                                children: [\n                                  Text(\n                                    isAr ? 'المركبة النشطة' : 'ACTIVE VEHICLE',\n                                    style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFFF2C14A), letterSpacing: 1),\n                                  ),\n                                  const SizedBox(height: 2),\n                                  Text('${firstVehicle.labelFor(isAr)} · ${firstVehicle.subLabel}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: Colors.white)),\n                                ],\n                              ),\n                            ),\n                            const SizedBox(width: 10),\n                            Container(\n                              width: 26,\n                              height: 26,\n                              decoration: const BoxDecoration(\n                                shape: BoxShape.circle,\n                                gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xFF34C38A), Color(0xFF0F8A5F)]),\n                                boxShadow: [BoxShadow(color: Color(0x730F8A5F), blurRadius: 8, offset: Offset(0, 3))],\n                              ),\n                              child: const Icon(Icons.check_rounded, size: 17, color: Colors.white),\n                            ),\n                          ],\n                        ),\n                      ),\n", false]]}]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-patch-my-car-scroll`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Then in the app window press R.');
