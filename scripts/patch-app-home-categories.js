#!/usr/bin/env node
/**
 * Buyer app home (confirmed with the person via mockup):
 *  - "Shop by category" becomes "Categories" / "الأقسام", in two rows of five (up to 10 categories, or 9 and the gold "All" when there are more); icons 48 px;
 *  - beside "LEAP Auto Parts" (idea C): a gold "Get a quote" / "اطلب عرض سعر" button with its words, and support as a navy round button with a headset.
 *
 *   node scripts/patch-app-home-categories.js            dry run
 *   node scripts/patch-app-home-categories.js --write    applies it (the changed file is saved as <file>.before-patch-app-home-categories first)
 * Then: buyer app: R (hot restart)
 */
const DATA = {"created": [], "replaced": [], "anchored": [{"file": "apps/mobile/lib/features/home/home_screen.dart", "what": "buyer app home: \"Categories\" in two rows of five; at the top a gold \"Get a quote\" button and a navy support headset", "done": "crossAxisCount: 5, mainAxisSpacing: 10", "pairs": [["            Row(\n              children: [\n                // the logo, drawn like an engraving when Home opens (the same as the opening screen, the portals and the website)\n                const LeapLogoAnimation(size: 32),\n                const SizedBox(width: 8),\n                Text(\n                  isAr ? 'ليب لقطع السيارات' : 'LEAP Auto Parts',\n                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: palette.ink),\n                ),\n              ],\n            ),\n            Row(\n              children: [\n                IconButton(icon: Icon(Icons.request_quote_outlined, color: palette.signal), tooltip: isAr ? 'اطلب عرض سعر' : 'Get a quotation', onPressed: () => context.push('/quotations/new')),\n                IconButton(icon: Icon(Icons.chat_bubble_outline, color: palette.signal), tooltip: tr(context, 'support_label'), onPressed: () => context.push('/support')),\n              ],\n            ),", "            Flexible(\n              child: Row(\n                children: [\n                  // the logo, drawn like an engraving when Home opens (the same as the opening screen, the portals and the website)\n                  const LeapLogoAnimation(size: 32),\n                  const SizedBox(width: 8),\n                  Flexible(\n                    child: Text(\n                      isAr ? 'ليب لقطع السيارات' : 'LEAP Auto Parts',\n                      maxLines: 2,\n                      overflow: TextOverflow.ellipsis,\n                      style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15, height: 1.15, color: palette.ink),\n                    ),\n                  ),\n                ],\n              ),\n            ),\n            // Confirmed with the person via mockup (idea C): a gold \"Get a quote\" button with its words, and support as a navy round button with a headset.\n            Row(\n              mainAxisSize: MainAxisSize.min,\n              children: [\n                Tooltip(\n                  message: isAr ? 'اطلب عرض سعر' : 'Get a quotation',\n                  child: InkWell(\n                    borderRadius: BorderRadius.circular(99),\n                    onTap: () => context.push('/quotations/new'),\n                    child: Container(\n                      height: 36,\n                      padding: const EdgeInsets.symmetric(horizontal: 11),\n                      decoration: Premium.goldRaised(radius: 99),\n                      child: Row(\n                        mainAxisSize: MainAxisSize.min,\n                        children: [\n                          const Icon(Icons.task_outlined, size: 17, color: Color(0xFF0B3146)),\n                          const SizedBox(width: 5),\n                          Text(isAr ? 'اطلب عرض سعر' : 'Get a quote', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF0B3146))),\n                        ],\n                      ),\n                    ),\n                  ),\n                ),\n                const SizedBox(width: 8),\n                Tooltip(\n                  message: tr(context, 'support_label'),\n                  child: InkWell(\n                    customBorder: const CircleBorder(),\n                    onTap: () => context.push('/support'),\n                    child: Container(\n                      width: 36,\n                      height: 36,\n                      decoration: Premium.navyRaised(radius: 18),\n                      child: Icon(Icons.headset_mic_outlined, size: 19, color: palette.signal),\n                    ),\n                  ),\n                ),\n              ],\n            ),", false], ["            Text(tr(context, 'shop_by_category'), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),", "            Text(isAr ? 'الأقسام' : 'Categories', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),", false], ["                final visibleCategories = categories.take(7).toList();\n                final showMoreTile = categories.length > 7;\n                return GridView.count(\n                  clipBehavior: Clip.none,      // the icons' shadows show at the edges\n                  crossAxisCount: 4,\n                  shrinkWrap: true,\n                  physics: const NeverScrollableScrollPhysics(),\n                  mainAxisSpacing: 12,\n                  crossAxisSpacing: 12,\n                  children: [", "                // Confirmed with the person via mockup: two rows of five -- up to 10 categories, or 9 and the gold \"All\" when there are more than 10.\n                final showMoreTile = categories.length > 10;\n                final visibleCategories = categories.take(showMoreTile ? 9 : 10).toList();\n                return GridView(\n                  clipBehavior: Clip.none,      // the icons' shadows show at the edges\n                  shrinkWrap: true,\n                  physics: const NeverScrollableScrollPhysics(),\n                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 5, mainAxisSpacing: 10, crossAxisSpacing: 8, mainAxisExtent: 80),\n                  children: [", false], ["                            Container(\n                              width: 52,\n                              height: 52,\n                              decoration: Premium.round(context),", "                            Container(\n                              width: 48,\n                              height: 48,\n                              decoration: Premium.round(context),", false], ["errorWidget: (context, url, error) => Icon(_iconForCategory(c.id), color: palette.signal, size: 31)))\n                                  : Icon(_iconForCategory(c.id), color: palette.signal, size: 31),\n                            ),\n                            const SizedBox(height: 6),\n                            Text(label, style: const TextStyle(fontSize: 10), textAlign: TextAlign.center),", "errorWidget: (context, url, error) => Icon(_iconForCategory(c.id), color: palette.signal, size: 28)))\n                                  : Icon(_iconForCategory(c.id), color: palette.signal, size: 28),\n                            ),\n                            const SizedBox(height: 5),\n                            Text(label, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 10, height: 1.2), textAlign: TextAlign.center, textScaler: TextScaler.noScaling),", false], ["                            Container(\n                              width: 52,\n                              height: 52,\n                              // All sections: a raised gold button with a navy arrow (light and dark mode)\n                              decoration: Premium.goldRaised(radius: 26),\n                              child: const Icon(Icons.arrow_forward_rounded, color: Color(0xFF0B3146), size: 26),\n                            ),\n                            const SizedBox(height: 6),\n                            Text(isAr ? 'الكل' : 'All', style: const TextStyle(fontSize: 10), textAlign: TextAlign.center),", "                            Container(\n                              width: 48,\n                              height: 48,\n                              // All sections: a raised gold button with a navy arrow (light and dark mode)\n                              decoration: Premium.goldRaised(radius: 24),\n                              child: const Icon(Icons.arrow_forward_rounded, color: Color(0xFF0B3146), size: 24),\n                            ),\n                            const SizedBox(height: 5),\n                            Text(isAr ? 'الكل' : 'All', maxLines: 1, style: const TextStyle(fontSize: 10, height: 1.2), textAlign: TextAlign.center, textScaler: TextScaler.noScaling),", false]]}]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-patch-app-home-categories`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Then: buyer app: R (hot restart)');
