#!/usr/bin/env node
/**
 * App, Home: the Active vehicle box built exactly like Shopping for (same height, text place and slanted photo panel with the car's real photo), in navy 3D.
 * Run after patch-my-car-scroll.
 *   node scripts/patch-active-vehicle-navy.js            dry run
 *   node scripts/patch-active-vehicle-navy.js --write    applies it
 */
const DATA = {"created": [], "replaced": [], "anchored": [{"file": "apps/mobile/lib/features/home/home_screen.dart", "what": "App, Home: Active vehicle built like Shopping for (car photo in the slanted panel), in navy 3D", "done": "class _ActiveVehicleCard", "pairs": [["                    if (_feedFilter == 'my_car' && firstVehicle != null)\n                      // Active vehicle in LEAP's navy 3D style (patch-my-car-scroll, confirmed with the person via mockup, option B):\n                      // a navy gradient with a shine across the top, a deep shadow, a 3D gold car tile and a green 3D tick.\n                      Container(\n                        margin: const EdgeInsets.only(bottom: 12),\n                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 13),\n                        decoration: Premium.navyRaised(radius: 16),\n                        foregroundDecoration: Premium.gloss(radius: 16),\n                        child: Row(\n                          children: [\n                            Container(\n                              width: 42,\n                              height: 42,\n                              decoration: Premium.goldRaised(radius: 11),\n                              child: const Icon(Icons.directions_car_rounded, size: 24, color: Color(0xFF0B3146)),\n                            ),\n                            const SizedBox(width: 12),\n                            Expanded(\n                              child: Column(\n                                crossAxisAlignment: CrossAxisAlignment.start,\n                                children: [\n                                  Text(\n                                    isAr ? 'المركبة النشطة' : 'ACTIVE VEHICLE',\n                                    style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFFF2C14A), letterSpacing: 1),\n                                  ),\n                                  const SizedBox(height: 2),\n                                  Text('${firstVehicle.labelFor(isAr)} · ${firstVehicle.subLabel}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: Colors.white)),\n                                ],\n                              ),\n                            ),\n                            const SizedBox(width: 10),\n                            Container(\n                              width: 26,\n                              height: 26,\n                              decoration: const BoxDecoration(\n                                shape: BoxShape.circle,\n                                gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xFF34C38A), Color(0xFF0F8A5F)]),\n                                boxShadow: [BoxShadow(color: Color(0x730F8A5F), blurRadius: 8, offset: Offset(0, 3))],\n                              ),\n                              child: const Icon(Icons.check_rounded, size: 17, color: Colors.white),\n                            ),\n                          ],\n                        ),\n                      ),\n", "                    if (_feedFilter == 'my_car' && firstVehicle != null)\n                      // Active vehicle: built exactly like \"Shopping for\" (same height, text place, slanted photo panel with the car's real photo), in navy 3D\n                      // (patch-active-vehicle-navy, confirmed with the person via mockup)\n                      _ActiveVehicleCard(vehicle: firstVehicle, isAr: isAr),\n", false], ["class _FilterChip extends StatelessWidget {", "/// \"Active vehicle\" on Home with My Car on: the same shape as the Shopping for card, in LEAP navy (a navy gradient, a shine across the top, a deep\n/// shadow), with the car's real photo in the slanted panel (Vehicle.heroPhotoUrl), or a car icon when it has none (patch-active-vehicle-navy).\nclass _ActiveVehicleCard extends StatelessWidget {\n  final Vehicle vehicle;\n  final bool isAr;\n  const _ActiveVehicleCard({required this.vehicle, required this.isAr});\n\n  @override\n  Widget build(BuildContext context) {\n    final photo = vehicle.heroPhotoUrl;\n    const icon = Icon(Icons.directions_car, size: 20, color: Color(0xB3FFFFFF));\n    return Container(\n      margin: const EdgeInsets.only(bottom: 12),\n      height: 76,\n      clipBehavior: Clip.antiAlias,\n      decoration: Premium.navyRaised(radius: 12),\n      foregroundDecoration: Premium.gloss(radius: 12),\n      child: Stack(\n        children: [\n          Positioned.fill(\n            child: FractionallySizedBox(\n              widthFactor: 0.315,\n              alignment: isAr ? Alignment.centerLeft : Alignment.centerRight,\n              child: ClipPath(\n                clipper: _DiagonalClipper(mirrored: isAr),\n                child: Container(\n                  decoration: const BoxDecoration(\n                    gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFF1F5574), Color(0xFF2D6F92)]),\n                  ),\n                  child: Center(\n                    child: Container(\n                      width: 75,\n                      height: 75,\n                      padding: const EdgeInsets.all(5),\n                      child: photo != null\n                          ? CachedNetworkImage(\n                              imageUrl: ApiClient.resolveMediaUrl(photo),\n                              fit: BoxFit.contain,\n                              fadeInDuration: const Duration(milliseconds: 300),\n                              errorWidget: (context, url, error) => icon,\n                            )\n                          : icon,\n                    ),\n                  ),\n                ),\n              ),\n            ),\n          ),\n          Positioned(\n            left: isAr ? 100 : 14,\n            right: isAr ? 8 : 100,\n            top: 14,\n            child: Directionality(\n              textDirection: isAr ? TextDirection.rtl : TextDirection.ltr,\n              child: Column(\n                crossAxisAlignment: CrossAxisAlignment.start,\n                mainAxisSize: MainAxisSize.min,\n                children: [\n                  Text(isAr ? 'المركبة النشطة' : 'ACTIVE VEHICLE', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: 1, color: Color(0xFFF2C14A))),\n                  const SizedBox(height: 4),\n                  Text(\n                    '${vehicle.labelFor(isAr)} · ${vehicle.subLabel}',\n                    maxLines: 2,\n                    overflow: TextOverflow.ellipsis,\n                    style: const TextStyle(fontFamily: 'monospace', fontWeight: FontWeight.w700, fontSize: 10.5, letterSpacing: 0.6, color: Colors.white),\n                  ),\n                ],\n              ),\n            ),\n          ),\n        ],\n      ),\n    );\n  }\n}\n\nclass _FilterChip extends StatelessWidget {", false]]}]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-patch-active-vehicle-navy`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Then in the app window press R.');
