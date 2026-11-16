#!/usr/bin/env node
/**
 * Buyer app, "Shop by category" (confirmed with the person via mockup):
 *  - the main categories (side column) at 90%: the column 96 -> 86, the photo 53 -> 48, the name 11.5 -> 10.4; each one shorter (6 above and below);
 *  - the sub categories at 90%: the photo 52 -> 47 (6 from the card's edge), the name 14.5 -> 13; the arrow at the very end of the card;
 *  - 6 between the cards and between the two columns; the first card's top level with the chosen section's card.
 *
 *   node scripts/patch-app-shop-categories-tight.js            dry run
 *   node scripts/patch-app-shop-categories-tight.js --write    applies it (the changed file is saved as <file>.before-patch-app-shop-categories-tight first)
 * Then: buyer app: R (hot restart)
 */
const DATA = {"created": [], "replaced": [], "anchored": [{"file": "apps/mobile/lib/features/catalog/category_browse_screen.dart", "what": "buyer app, Shop by category: sections and parts at 90%, shorter sections, the arrow at the very end, smaller gaps, the two columns level at the top", "done": "the side column and the parts at 90%, each section shorter", "pairs": [["                SizedBox(\n                  width: 96,\n                  child: Container(\n                    color: LeapPalette.of(context).chalk,\n                    child: ListView.builder(\n                      itemCount: _categories!.length,", "                // Confirmed with the person via mockup: the side column and the parts at 90%, each section shorter, the parts' arrow at the very end,\n                // 6 between the cards and between the two columns, and the first part's top level with the chosen section's card.\n                SizedBox(\n                  width: 86,\n                  child: Container(\n                    color: LeapPalette.of(context).chalk,\n                    child: ListView.builder(\n                      padding: const EdgeInsets.only(top: 3),\n                      itemCount: _categories!.length,", false], ["padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),", "padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 7),", false], ["                                  width: 53,\n                                  height: 53,\n                                  margin: const EdgeInsets.only(bottom: 6),", "                                  width: 48,\n                                  height: 48,\n                                  margin: const EdgeInsets.only(bottom: 4),", false], ["errorWidget: (context, url, error) => Icon(Icons.category_outlined, size: 22, color: palette.muted))\n                                      : Icon(Icons.category_outlined, size: 22, color: selected ? palette.signal : palette.muted),", "errorWidget: (context, url, error) => Icon(Icons.category_outlined, size: 20, color: palette.muted))\n                                      : Icon(Icons.category_outlined, size: 20, color: selected ? palette.signal : palette.muted),", false], ["                                    fontSize: 11.5,\n                                    fontWeight: selected ? FontWeight.w700 : FontWeight.w500,", "                                    fontSize: 10.4,\n                                    fontWeight: selected ? FontWeight.w700 : FontWeight.w500,", false], ["                        padding: const EdgeInsets.all(12),\n                        itemCount: parts.length,\n                        separatorBuilder: (_, __) => const SizedBox(height: 10),", "                        padding: const EdgeInsetsDirectional.fromSTEB(6, 6, 12, 12),\n                        itemCount: parts.length,\n                        separatorBuilder: (_, __) => const SizedBox(height: 6),", false], ["                            child: ListTile(\n                              leading: ClipOval(\n                                child: part.photoUrl != null\n                                    ? CachedNetworkImage(\n                                        imageUrl: ApiClient.resolveMediaUrl(part.photoUrl!),\n                                        width: 52,\n                                        height: 52,\n                                        fit: BoxFit.cover,\n                                        errorWidget: (context, url, error) => Container(width: 52, height: 52, color: palette.chalk, child: Icon(Icons.build_outlined, size: 23, color: palette.muted)),\n                                      )\n                                    : Container(width: 52, height: 52, color: palette.chalk, child: Icon(Icons.build_outlined, size: 23, color: palette.muted)),\n                              ),\n                              title: Text(partLabel, style: TextStyle(fontSize: 14.5, color: palette.ink)),\n                              trailing: Icon(Icons.chevron_right, color: palette.muted),\n                              onTap: () => context.push(\n                                '/category/$_selectedCategoryId',\n                                extra: {'categoryName': categoryLabel, 'part': part.nameEn, 'partLabel': partLabel},\n                              ),\n                            ),", "                            // the photo 6 from the card's edge, the name with all the room, the arrow at the very end\n                            child: Material(\n                              type: MaterialType.transparency,\n                              child: InkWell(\n                                borderRadius: BorderRadius.circular(14),\n                                onTap: () => context.push(\n                                  '/category/$_selectedCategoryId',\n                                  extra: {'categoryName': categoryLabel, 'part': part.nameEn, 'partLabel': partLabel},\n                                ),\n                                child: Padding(\n                                  padding: const EdgeInsetsDirectional.fromSTEB(6, 6, 4, 6),\n                                  child: Row(\n                                    children: [\n                                      ClipOval(\n                                        child: part.photoUrl != null\n                                            ? CachedNetworkImage(\n                                                imageUrl: ApiClient.resolveMediaUrl(part.photoUrl!),\n                                                width: 47,\n                                                height: 47,\n                                                fit: BoxFit.cover,\n                                                errorWidget: (context, url, error) => Container(width: 47, height: 47, color: palette.chalk, child: Icon(Icons.build_outlined, size: 21, color: palette.muted)),\n                                              )\n                                            : Container(width: 47, height: 47, color: palette.chalk, child: Icon(Icons.build_outlined, size: 21, color: palette.muted)),\n                                      ),\n                                      const SizedBox(width: 9),\n                                      Expanded(child: Text(partLabel, style: TextStyle(fontSize: 13, height: 1.25, color: palette.ink))),\n                                      Icon(Icons.chevron_right, size: 20, color: palette.muted),\n                                    ],\n                                  ),\n                                ),\n                              ),\n                            ),", false]]}]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-patch-app-shop-categories-tight`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Then: buyer app: R (hot restart)');
