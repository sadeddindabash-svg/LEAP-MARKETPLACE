#!/usr/bin/env node
/**
 * Mobile apps, inside: the logo is drawn like an engraving when the screen opens, like in the portals: the buyer app's Home (top left, it was a
 * still picture) and the hub app's queue (a new small logo before the app's name in the top bar). Needs patch-logo-animation first.
 *
 *   node scripts/patch-app-logo-animation.js            dry run
 *   node scripts/patch-app-logo-animation.js --write    applies it (each changed file is saved as <file>.before-app-logo-animation first)
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored":[{"file":"apps/mobile/lib/features/home/home_screen.dart","what":"buyer app Home: the logo is drawn when it opens","done":"const LeapLogoAnimation(size: 32)","pairs":[["import '../../widgets/home_banner.dart';\n\n","import '../../widgets/home_banner.dart';\nimport '../../widgets/leap_logo_animation.dart';\n\n"],["              children: [\n                Image.asset('assets/images/leap_logo.png', height: 32, width: 32),\n                const SizedBox(width: 8),\n","              children: [\n                // the logo, drawn like an engraving when Home opens (the same as the opening screen, the portals and the website)\n                const LeapLogoAnimation(size: 32),\n                const SizedBox(width: 8),\n"]]},{"file":"apps/hub-mobile/lib/features/queue/queue_screen.dart","what":"hub app queue: the logo in the top bar, drawn when it opens","done":"const LeapLogoAnimation(size: 30)","pairs":[["import '../../services/api_client.dart';\nimport '../../widgets/status_badge.dart';\n","import '../../services/api_client.dart';\nimport '../../widgets/leap_logo_animation.dart';\nimport '../../widgets/status_badge.dart';\n"],["      appBar: AppBar(\n        title: Text(t.appName),\n        actions: [\n","      appBar: AppBar(\n        // the logo, drawn like an engraving when the queue opens (the same as the opening screen, the portals and the website), then the app's name\n        title: Row(mainAxisSize: MainAxisSize.min, children: [const LeapLogoAnimation(size: 30), const SizedBox(width: 10), Flexible(child: Text(t.appName, overflow: TextOverflow.ellipsis))]),\n        actions: [\n"]]}],"created":[]};
const once = (s, a) => s.split(a).length === 2;
const plan = [];
let problems = 0;
for (const e of DATA.anchored) {
  const p = path.join(root, e.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${e.file}: not found. Run this from D:\\LEAP-MARKETPLACE.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const c = (x) => (s.includes('\r\n') ? x.replace(/\r?\n/g, '\r\n') : x);
  if (s.includes(c(e.done))) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  let out = s;
  for (const [a0, b0] of e.pairs) { const a = c(a0), b = c(b0); if (!once(out, a)) { out = null; break; } out = out.replace(a, () => b); }
  if (out === null) { console.log(`REFUSED   ${e.file}: its text is not what this patch expects, so nothing was changed. Send this file.`); problems++; continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: out });
}
for (const e of DATA.created) {
  const p = path.join(root, e.file);
  if (!fs.existsSync(path.dirname(p))) { console.log(`MISSING   ${path.dirname(e.file)}: folder not found. Run this from D:\\LEAP-MARKETPLACE.`); problems++; continue; }
  if (fs.existsSync(p)) {
    const s = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
    if (s === e.text) { console.log(`already   ${e.file}: ${e.what}`); continue; }
    console.log(`REFUSED   ${e.file}: a different file with this name is already there, so nothing was changed. Send this file.`); problems++; continue;
  }
  plan.push({ file: e.file, what: e.what, before: null, after: e.text });
}
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) {
    const p = path.join(root, c.file);
    if (c.before !== null) fs.writeFileSync(`${p}.before-app-logo-animation`, c.before);
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. App: press R in the start-all window (or run start-all again). Website: Ctrl+F5.');
