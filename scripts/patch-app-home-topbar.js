#!/usr/bin/env node
/**
 * Buyer app home, the top bar (confirmed with the person via mockup): the gold "Get a quote" button is smaller (30 instead of 36 high) and so is the support
 * button (32); the logo goes from 32 to 38 and "LEAP Auto Parts" / "ليب لقطع السيارات" from 15 to 17, always on ONE line (a little smaller on a narrow
 * phone, never two lines, never cut). Run after patch-app-home-categories.
 *
 *   node scripts/patch-app-home-topbar.js            dry run
 *   node scripts/patch-app-home-topbar.js --write    applies it (the changed file is saved as <file>.before-patch-app-home-topbar first)
 * Then: buyer app: R (hot restart)
 */
const DATA = {"created": [], "replaced": [], "anchored": [{"file": "apps/mobile/lib/features/home/home_screen.dart", "what": "buyer app home top bar: a smaller \"Get a quote\" and support button, a bigger logo, the name on one line", "done": "const LeapLogoAnimation(size: 38),", "pairs": [["                  const LeapLogoAnimation(size: 32),\n                  const SizedBox(width: 8),\n                  Flexible(\n                    child: Text(\n                      isAr ? 'ليب لقطع السيارات' : 'LEAP Auto Parts',\n                      maxLines: 2,\n                      overflow: TextOverflow.ellipsis,\n                      style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15, height: 1.15, color: palette.ink),\n                    ),\n                  ),", "                  const LeapLogoAnimation(size: 38),\n                  const SizedBox(width: 8),\n                  // the name on ONE line, filling the space it has: 17 px, a little smaller on a narrow phone (never two lines, never cut)\n                  Flexible(\n                    child: FittedBox(\n                      fit: BoxFit.scaleDown,\n                      alignment: AlignmentDirectional.centerStart,\n                      child: Text(\n                        isAr ? 'ليب لقطع السيارات' : 'LEAP Auto Parts',\n                        maxLines: 1,\n                        style: TextStyle(fontWeight: FontWeight.w800, fontSize: 17, height: 1.15, color: palette.ink),\n                      ),\n                    ),\n                  ),", false], ["            // Confirmed with the person via mockup (idea C): a gold \"Get a quote\" button with its words, and support as a navy round button with a headset.\n            Row(", "            const SizedBox(width: 8),\n            // Confirmed with the person via mockup (idea C): a gold \"Get a quote\" button with its words, and support as a navy round button with a headset (both smaller).\n            Row(", false], ["                      height: 36,\n                      padding: const EdgeInsets.symmetric(horizontal: 11),\n                      decoration: Premium.goldRaised(radius: 99),\n                      child: Row(\n                        mainAxisSize: MainAxisSize.min,\n                        children: [\n                          const Icon(Icons.task_outlined, size: 17, color: Color(0xFF0B3146)),\n                          const SizedBox(width: 5),\n                          Text(isAr ? 'اطلب عرض سعر' : 'Get a quote', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF0B3146))),", "                      height: 30,\n                      padding: const EdgeInsets.symmetric(horizontal: 8),\n                      decoration: Premium.goldRaised(radius: 99),\n                      child: Row(\n                        mainAxisSize: MainAxisSize.min,\n                        children: [\n                          const Icon(Icons.task_outlined, size: 15, color: Color(0xFF0B3146)),\n                          const SizedBox(width: 4),\n                          Text(isAr ? 'اطلب عرض سعر' : 'Get a quote', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF0B3146))),", false], ["                      width: 36,\n                      height: 36,\n                      decoration: Premium.navyRaised(radius: 18),\n                      child: Icon(Icons.headset_mic_outlined, size: 19, color: palette.signal),", "                      width: 32,\n                      height: 32,\n                      decoration: Premium.navyRaised(radius: 16),\n                      child: Icon(Icons.headset_mic_outlined, size: 17, color: palette.signal),", false]]}]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-patch-app-home-topbar`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Then: buyer app: R (hot restart)');
