#!/usr/bin/env node
/**
 * Share a comparison (confirmed with the person via mockup):
 *  - website, every screen: the Share button sits beside the Compare tab, never in the navy title box ("⇪ Share" on a phone, "⇪ Share comparison" on bigger screens);
 *  - buyer app, Compare parts: a share icon at the top and a gold Share button beside the title; both open the phone's share sheet with the
 *    website link of this comparison (/compare?ids=...). English and Arabic.
 *
 *   node scripts/patch-compare-share.js            dry run
 *   node scripts/patch-compare-share.js --write    applies it (each changed file is saved as <file>.before-compare-share first)
 * Then: Ctrl+F5 on the website; buyer app: q, then
 *   flutter run --dart-define=API_BASE_URL=http://192.168.0.210:4000 --dart-define=STOREFRONT_URL=http://192.168.0.210:3000
 * (STOREFRONT_URL is the website address the shared link opens; without it the link points to localhost.)   No server change.
 *
 * A file that is not as this patch expects is NOT changed (the whole patch stops). Windows (CRLF) line endings are handled. Running it twice is harmless.
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"created": [], "anchored": [{"file": "apps/web-storefront/components/CompareActions.tsx", "what": "website: Share sits beside the Compare tab on every screen, never in the navy title box", "done": "setSlot(document.getElementById(\"compare-tab-actions\")); }, []);", "pairs": [["  // a phone: beside the Wishlist tabs; a computer: in the navy box at the top\n", "  // on every screen: beside the Compare tab (never in the navy title box at the top)\n", false], ["  useEffect(() => { const phone = typeof window.matchMedia === \"function\" && window.matchMedia(\"(max-width: 767px)\").matches; setSlot((phone && document.getElementById(\"compare-tab-actions\")) || document.getElementById(\"account-header-actions\")); }, []);\n", "  useEffect(() => { setSlot(document.getElementById(\"compare-tab-actions\")); }, []);\n", false], ["strokeLinejoin=\"round\" className=\"md:hidden\"><path d=\"M4 12v7", "strokeLinejoin=\"round\"><path d=\"M4 12v7", "maybe"], ["/** \"Share comparison\": in the navy box at the top of the page when the account menu is there, otherwise above the table (the Wishlist tabs lead back to the saved parts). */", "/** \"Share comparison\": beside the Compare tab on every screen (phone, tablet, computer), never in the navy title box. */", "maybe"]]}, {"file": "apps/web-storefront/app/compare/page.tsx", "what": "website compare page: the place beside the Compare tab is there on every screen", "done": "<div id=\"compare-tab-actions\" className=\"contents\" />", "pairs": [["<div id=\"compare-tab-actions\" className=\"contents md:hidden\" />", "<div id=\"compare-tab-actions\" className=\"contents\" />", false]]}, {"file": "apps/mobile/lib/features/catalog/product_comparison_screen.dart", "what": "buyer app Compare parts: a share icon at the top and a Share button beside the title", "done": "Key('compare-share')", "pairs": [["import 'package:cached_network_image/cached_network_image.dart';\n", "import 'package:cached_network_image/cached_network_image.dart';\nimport 'package:share_plus/share_plus.dart';\n", false], ["import '../../core/theme.dart';\n", "import '../../core/theme.dart';\nimport '../../core/config/app_config.dart';\n", false], ["  static const _dash = '—';\n", "  static const _dash = '—';\n  static const _gold = Color(0xFFF9B317);\n\n  /// Shares the website link of this comparison (/compare?ids=a,b), so whoever opens it sees the same parts; the phone's share sheet opens.\n  static Future<void> _share(List<Product> list, String title) async {\n    final ids = list.map((p) => Uri.encodeComponent(p.id)).join(',');\n    try {\n      await Share.share('$title — ${AppConfig.storefrontUrl}/compare?ids=$ids');\n    } catch (_) {\n      // the buyer closed the share sheet\n    }\n  }\n", false], ["      appBar: AppBar(title: Text(title)),\n", "      appBar: AppBar(\n        title: Text(title),\n        actions: [\n          if (list.length >= 2) IconButton(key: const Key('compare-share-icon'), icon: const Icon(Icons.share_outlined), tooltip: isAr ? 'مشاركة' : 'Share', onPressed: () => _share(list, title)),\n        ],\n      ),\n", false], ["              child: Text(title, style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: navy)),\n", "              child: Row(\n                children: [\n                  Expanded(child: Text(title, style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: navy))),\n                  if (list.length >= 2)\n                    FilledButton.icon(\n                      key: const Key('compare-share'),\n                      onPressed: () => _share(list, title),\n                      style: FilledButton.styleFrom(backgroundColor: _gold, foregroundColor: const Color(0xFF1C1300), minimumSize: const Size(0, 40), padding: const EdgeInsets.symmetric(horizontal: 14), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)), textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800)),\n                      icon: const Icon(Icons.share, size: 16),\n                      label: Text(isAr ? 'مشاركة' : 'Share'),\n                    ),\n                ],\n              ),\n", false]]}]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-compare-share`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Then: Ctrl+F5 on the website; buyer app: q, then flutter run --dart-define=API_BASE_URL=http://192.168.0.210:4000 --dart-define=STOREFRONT_URL=http://192.168.0.210:3000');
