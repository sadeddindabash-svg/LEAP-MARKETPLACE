#!/usr/bin/env node
/**
 * Buyer app: the loyalty tier icons are the SAME as on the storefront (award, diamond, crown, star, medal: the website's own outline shapes,
 * drawn in the app), on the tier card in Account and on the My Tier screen. In the My Tier list each tier now has the round tinted badge,
 * as on the website. Names, colours and discounts are unchanged (they come from the admin's Loyalty tiers, as before).
 *
 *   node scripts/patch-app-tier-icons.js            dry run
 *   node scripts/patch-app-tier-icons.js --write    applies it (each changed file is saved as <file>.before-app-tier-icons first)
 * Then in the buyer app: q, then flutter run --dart-define=API_BASE_URL=http://192.168.0.210:4000   (No server change.)
 *
 * A file that is not as this patch expects is NOT changed (the whole patch stops). Windows (CRLF) line endings are handled. Running it twice is harmless.
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"created":[],"anchored":[{"file":"apps/mobile/lib/features/account/loyalty_card.dart","what":"buyer app: the tier card uses the storefront's tier icons","done":"class LoyaltyTierIcon extends StatelessWidget","pairs":[["                        child: Icon(resolveLoyaltyIcon(currentTier['icon'] as String), color: tierColor, size: 22),\n","                        child: Center(child: LoyaltyTierIcon(name: currentTier['icon'] as String, color: tierColor, size: 22)),      // the storefront's icon\n"],["IconData resolveLoyaltyIcon(String name) {\n","/// The tier icons, drawn exactly as the storefront draws them (apps/web-storefront/components/LoyaltyCard.tsx, TierBadge): the same five\n/// outline shapes on a 24 x 24 grid, a 1.8 line with round ends, so the app and the website show the same tier icon.\nclass LoyaltyTierIcon extends StatelessWidget {\n  final String name;      // award, diamond, crown, star; anything else is the medal (as on the website)\n  final Color color;\n  final double size;\n  const LoyaltyTierIcon({super.key, required this.name, required this.color, this.size = 22});\n\n  @override\n  Widget build(BuildContext context) => SizedBox(width: size, height: size, child: CustomPaint(painter: _TierIconPainter(name, color)));\n}\n\n/// The round badge the storefront shows in the tier list: the icon on a 15% tint of the tier's colour.\nclass LoyaltyTierBadge extends StatelessWidget {\n  final String name;\n  final Color color;\n  final double size;\n  const LoyaltyTierBadge({super.key, required this.name, required this.color, this.size = 36});\n\n  @override\n  Widget build(BuildContext context) => Container(\n        width: size,\n        height: size,\n        alignment: Alignment.center,\n        decoration: BoxDecoration(color: color.withValues(alpha: 0.15), shape: BoxShape.circle),\n        child: LoyaltyTierIcon(name: name, color: color, size: size * 0.5),\n      );\n}\n\nclass _TierIconPainter extends CustomPainter {\n  final String name;\n  final Color color;\n  _TierIconPainter(this.name, this.color);\n\n  Path _poly(List<double> xy, {bool close = false}) {\n    final p = Path()..moveTo(xy[0], xy[1]);\n    for (var i = 2; i < xy.length; i += 2) {\n      p.lineTo(xy[i], xy[i + 1]);\n    }\n    if (close) p.close();\n    return p;\n  }\n\n  @override\n  void paint(Canvas canvas, Size size) {\n    canvas.scale(size.width / 24, size.height / 24);\n    final paint = Paint()\n      ..color = color\n      ..style = PaintingStyle.stroke\n      ..strokeWidth = 1.8\n      ..strokeCap = StrokeCap.round\n      ..strokeJoin = StrokeJoin.round;\n    switch (name) {\n      case 'award':\n        canvas.drawCircle(const Offset(12, 9), 5, paint);\n        canvas.drawPath(_poly([8.5, 13.5, 7, 21, 12, 18, 17, 21, 15.5, 13.5]), paint);\n        break;\n      case 'diamond':\n        canvas.drawPath(_poly([6, 4, 18, 4, 22, 10, 12, 21, 2, 10], close: true), paint);\n        canvas.drawPath(_poly([2, 10, 22, 10]), paint);\n        break;\n      case 'crown':\n        canvas.drawPath(_poly([3, 8, 7, 12, 12, 5, 17, 12, 21, 8, 19, 19, 5, 19], close: true), paint);\n        break;\n      case 'star':\n        canvas.drawPath(_poly([12, 3, 14.7, 8.6, 20.8, 9.5, 16.4, 13.8, 17.4, 19.9, 12, 17, 6.6, 19.9, 7.6, 13.8, 3.2, 9.5, 9.3, 8.6], close: true), paint);\n        break;\n      default:      // medal\n        canvas.drawCircle(const Offset(12, 9), 6, paint);\n        canvas.drawPath(_poly([8.5, 14.5, 7, 21, 12, 18.5, 17, 21, 15.5, 14.5]), paint);\n    }\n  }\n\n  @override\n  bool shouldRepaint(_TierIconPainter old) => old.name != name || old.color != color;\n}\n\nIconData resolveLoyaltyIcon(String name) {\n"]]},{"file":"apps/mobile/lib/features/account/loyalty_detail_screen.dart","what":"buyer app: My Tier uses the storefront's tier icons and badges","done":"LoyaltyTierBadge(name:","pairs":[["                    child: Icon(resolveLoyaltyIcon(currentTier['icon'] as String), color: resolveLoyaltyColor(currentTier['color'] as String, palette), size: 28),\n","                    child: Center(child: LoyaltyTierIcon(name: currentTier['icon'] as String, color: resolveLoyaltyColor(currentTier['color'] as String, palette), size: 28)),\n"],["                  Icon(resolveLoyaltyIcon(tier['icon'] as String), color: isCurrent ? tierColor : palette.muted, size: 20),\n","                  LoyaltyTierBadge(name: tier['icon'] as String, color: isCurrent ? tierColor : palette.muted, size: 36),      // as on the storefront\n"]]}]};
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
    if (!n.includes(e.done) && (e.pairs.some(([a]) => !once(n, a)) || (e.block && (!n.includes(e.block.from) || !n.includes(e.block.to))))) { console.log(`skipped   ${e.file}: not as expected, left as it is (${e.what})`); continue; }
  }
  edit(e.file, e.what, e.done, (s) => {
    let out = s;
    for (const [a, b, all] of e.pairs) { if (all) { if (!out.includes(a)) return { why: `this part was not found: "${a.split('\n').find((l) => l.trim()).trim().slice(0, 90)}"` }; out = out.split(a).join(b); continue; } if (!once(out, a)) return { why: `this part was not found: "${a.split('\n').find((l) => l.trim()).trim().slice(0, 90)}"` }; out = out.replace(a, () => b); }
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-hub-portal-redesign`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Then in the buyer app: q, then flutter run --dart-define=API_BASE_URL=http://192.168.0.210:4000');
