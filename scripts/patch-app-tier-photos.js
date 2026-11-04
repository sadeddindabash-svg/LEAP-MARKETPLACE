#!/usr/bin/env node
/**
 * Buyer app: the tier PHOTOS the admin uploads (admin portal, Settings -> Tiers Photos) show in the app too, the same as on the storefront.
 * A tier with a photo shows it in a circle; a tier without one keeps its icon. The same sizes as the website:
 *  - the tier card in Account: 55 (was 44);
 *  - My Tier: the current tier 70, in a gold ring (was 56); each tier in the list 45 (was 36).
 * Needs patch-app-tier-icons first (the storefront's tier icons). No server change: the server already sends each tier's photo.
 *
 *   node scripts/patch-app-tier-photos.js            dry run
 *   node scripts/patch-app-tier-photos.js --write    applies it (each changed file is saved as <file>.before-app-tier-photos first)
 * Then in the buyer app: q, then flutter run --dart-define=API_BASE_URL=http://192.168.0.210:4000
 *
 * A file that is not as this patch expects is NOT changed (the whole patch stops). Windows (CRLF) line endings are handled. Running it twice is harmless.
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"created":[],"anchored":[{"file":"apps/mobile/lib/features/account/loyalty_card.dart","what":"buyer app: tier photos (the badge, and the tier card at 55)","done":"final String? photoUrl;","pairs":[["import 'package:flutter/material.dart';\n","import 'package:flutter/material.dart';\nimport 'package:cached_network_image/cached_network_image.dart';\n"],["/// The round badge the storefront shows in the tier list: the icon on a 15% tint of the tier's colour.\nclass LoyaltyTierBadge extends StatelessWidget {\n  final String name;\n  final Color color;\n  final double size;\n  const LoyaltyTierBadge({super.key, required this.name, required this.color, this.size = 36});\n\n  @override\n  Widget build(BuildContext context) => Container(\n        width: size,\n        height: size,\n        alignment: Alignment.center,\n        decoration: BoxDecoration(color: color.withValues(alpha: 0.15), shape: BoxShape.circle),\n        child: LoyaltyTierIcon(name: name, color: color, size: size * 0.5),\n      );\n}\n","/// A tier's picture, as the storefront shows it (TierBadge): the photo the admin set (Settings -> Tiers Photos) in a circle, else the tier's icon\n/// on a 15% tint of its colour. A photo that cannot be loaded shows the icon.\nclass LoyaltyTierBadge extends StatelessWidget {\n  final String name;\n  final Color color;\n  final double size;\n  final String? photoUrl;\n  const LoyaltyTierBadge({super.key, required this.name, required this.color, this.size = 36, this.photoUrl});\n\n  Widget _icon() => Container(\n        width: size,\n        height: size,\n        alignment: Alignment.center,\n        decoration: BoxDecoration(color: color.withValues(alpha: 0.15), shape: BoxShape.circle),\n        child: LoyaltyTierIcon(name: name, color: color, size: size * 0.5),\n      );\n\n  @override\n  Widget build(BuildContext context) {\n    final url = photoUrl?.trim();\n    if (url == null || url.isEmpty) return _icon();\n    return ClipOval(\n      child: CachedNetworkImage(\n        imageUrl: ApiClient.resolveMediaUrl(url),\n        width: size,\n        height: size,\n        fit: BoxFit.cover,\n        placeholder: (_, __) => _icon(),\n        errorWidget: (_, __, ___) => _icon(),\n      ),\n    );\n  }\n}\n"],["                      Container(\n                        width: 44, height: 44,\n                        decoration: BoxDecoration(color: tierColor.withValues(alpha: 0.15), shape: BoxShape.circle),\n                        child: Center(child: LoyaltyTierIcon(name: currentTier['icon'] as String, color: tierColor, size: 22)),      // the storefront's icon\n                      ),\n","                      LoyaltyTierBadge(name: currentTier['icon'] as String, color: tierColor, photoUrl: currentTier['photoUrl'] as String?, size: 55),      // the admin's photo, else the icon (as on the storefront)\n"]]},{"file":"apps/mobile/lib/features/account/loyalty_detail_screen.dart","what":"buyer app: My Tier shows the tier photos (70 in a gold ring, 45 in the list)","done":"photoUrl: tier['photoUrl'] as String?","pairs":[["                  Container(\n                    width: 56, height: 56,\n                    decoration: BoxDecoration(color: resolveLoyaltyColor(currentTier['color'] as String, palette).withValues(alpha: 0.15), shape: BoxShape.circle),\n                    child: Center(child: LoyaltyTierIcon(name: currentTier['icon'] as String, color: resolveLoyaltyColor(currentTier['color'] as String, palette), size: 28)),\n                  ),\n","                  Container(      // the current tier in a gold ring, as on the storefront's My tier\n                    padding: const EdgeInsets.all(5),\n                    decoration: BoxDecoration(color: Colors.white, shape: BoxShape.circle, border: Border.all(color: const Color(0xFFF2A71B), width: 4)),\n                    child: LoyaltyTierBadge(name: currentTier['icon'] as String, color: resolveLoyaltyColor(currentTier['color'] as String, palette), photoUrl: currentTier['photoUrl'] as String?, size: 70),\n                  ),\n"],["                  LoyaltyTierBadge(name: tier['icon'] as String, color: isCurrent ? tierColor : palette.muted, size: 36),      // as on the storefront\n","                  LoyaltyTierBadge(name: tier['icon'] as String, color: isCurrent ? tierColor : palette.muted, photoUrl: tier['photoUrl'] as String?, size: 45),      // as on the storefront\n"]]}]};
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
