#!/usr/bin/env node
/**
 * Messages from Leap are always golden yellow, so they are easy to recognise: the admin's return conversations, the supplier portal
 * (returns and messages: the supplier's own messages turn white), the hub's conversations, and the website's support tickets.
 * Run AFTER patch-returns-conversations.
 *   node scripts/patch-leap-gold-messages.js            dry run
 *   node scripts/patch-leap-gold-messages.js --write    applies it
 */
const DATA = {"created": [], "replaced": [], "anchored": [{"file": "apps/admin-dashboard/src/App.jsx", "what": "admin return conversations: Leap's messages in gold", "done": "background: m.senderRole === \"admin\" ? C.signal : C.canvas, color: m.senderRole === \"admin\" ? C.onSignal : C.ink }}>", "pairs": [["background: m.senderRole === \"admin\" ? C.torqueBg : C.canvas }}>", "background: m.senderRole === \"admin\" ? C.signal : C.canvas, color: m.senderRole === \"admin\" ? C.onSignal : C.ink }}>", false]]}, {"file": "apps/supplier-portal/src/App.jsx", "what": "supplier return conversation: Leap's messages in gold (the buyer's request in blue); supplier messages: Leap's messages in gold, the supplier's own in white", "done": "background: m.senderRole === \"supplier\" ? \"#fff\" : m.senderRole === \"hub\" ? C.redBg : m.senderRole === \"buyer\" ? C.torqueBg : C.signal, color: m.senderRole === \"admin\" ? C.onSignal : C.ink, border: m.senderRole === \"supplier\" ? `1px solid ${C.line}` : \"none\", borderRadius: 8, padding: \"8px 10px\" }}>", "pairs": [["background: m.senderRole === \"supplier\" ? \"#fff\" : m.senderRole === \"hub\" ? C.redBg : m.senderRole === \"buyer\" ? C.amberBg : C.torqueBg, borderRadius: 8, padding: \"8px 10px\" }}>", "background: m.senderRole === \"supplier\" ? \"#fff\" : m.senderRole === \"hub\" ? C.redBg : m.senderRole === \"buyer\" ? C.torqueBg : C.signal, color: m.senderRole === \"admin\" ? C.onSignal : C.ink, border: m.senderRole === \"supplier\" ? `1px solid ${C.line}` : \"none\", borderRadius: 8, padding: \"8px 10px\" }}>", false], ["background: isMe ? C.signal : \"#fff\", color: isMe ? C.onSignal : C.ink, border: isMe ? \"none\" : `1px solid ${C.line}` }}>", "background: isMe ? \"#fff\" : C.signal, color: isMe ? C.ink : C.onSignal, border: isMe ? `1px solid ${C.line}` : \"none\" }}>", false]]}, {"file": "apps/hub-portal/src/HubConversations.jsx", "what": "hub conversations: Leap's messages in gold", "done": "background: m.senderRole === \"hub\" ? C.canvas : C.gold, color: m.senderRole === \"hub\" ? C.ink : C.onGold }}>", "pairs": [["background: m.senderRole === \"hub\" ? C.canvas : C.torqueBg }}>", "background: m.senderRole === \"hub\" ? C.canvas : C.gold, color: m.senderRole === \"hub\" ? C.ink : C.onGold }}>", false]]}, {"file": "apps/web-storefront/app/support/[id]/page.tsx", "what": "website support: Leap's replies in gold", "done": "${msg.senderRole === \"buyer\" ? \"bg-navy text-white\" : \"bg-signal text-on-signal\"}", "pairs": [["${msg.senderRole === \"buyer\" ? \"bg-navy text-white\" : \"border border-line bg-white text-ink\"}", "${msg.senderRole === \"buyer\" ? \"bg-navy text-white\" : \"bg-signal text-on-signal\"}", false]]}]};
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
    for (const [re, rep, min] of e.regex || []) { const r = new RegExp(re, 'g'); const n = (out.match(r) || []).length; if (n < min) return { why: `this part was not found: "${re.replace(/\\/g, '').slice(0, 70)}"` }; out = out.replace(r, rep); }
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-patch-leap-gold-messages`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log("\nDone. Refresh the admin, the supplier portal, the hub portal and the website with Ctrl+F5 (no API restart needed).");
