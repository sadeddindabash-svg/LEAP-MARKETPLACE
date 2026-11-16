#!/usr/bin/env node
/**
 * Who wrote a message, by colour, in every conversation: Leap golden yellow, supplier navy blue, hub red, buyer green.
 *   Admin (return conversations, support tickets, supplier messages), supplier portal (returns, messages), hub portal (conversations
 *   with Leap), website (support tickets). Includes patch-leap-gold-messages: run this one whether or not that one was run.
 *   node scripts/patch-message-colors.js            dry run
 *   node scripts/patch-message-colors.js --write    applies it
 */
const STAGES = [{"created": [], "replaced": [], "anchored": [{"file": "apps/admin-dashboard/src/App.jsx", "what": "admin return conversations: Leap's messages in gold", "done": "background: m.senderRole === \"admin\" ? C.signal : C.canvas, color: m.senderRole === \"admin\" ? C.onSignal : C.ink }}>", "pairs": [["background: m.senderRole === \"admin\" ? C.torqueBg : C.canvas }}>", "background: m.senderRole === \"admin\" ? C.signal : C.canvas, color: m.senderRole === \"admin\" ? C.onSignal : C.ink }}>", false]]}, {"file": "apps/supplier-portal/src/App.jsx", "what": "supplier return conversation: Leap's messages in gold (the buyer's request in blue); supplier messages: Leap's messages in gold, the supplier's own in white", "done": "background: m.senderRole === \"supplier\" ? \"#fff\" : m.senderRole === \"hub\" ? C.redBg : m.senderRole === \"buyer\" ? C.torqueBg : C.signal, color: m.senderRole === \"admin\" ? C.onSignal : C.ink, border: m.senderRole === \"supplier\" ? `1px solid ${C.line}` : \"none\", borderRadius: 8, padding: \"8px 10px\" }}>", "pairs": [["background: m.senderRole === \"supplier\" ? \"#fff\" : m.senderRole === \"hub\" ? C.redBg : m.senderRole === \"buyer\" ? C.amberBg : C.torqueBg, borderRadius: 8, padding: \"8px 10px\" }}>", "background: m.senderRole === \"supplier\" ? \"#fff\" : m.senderRole === \"hub\" ? C.redBg : m.senderRole === \"buyer\" ? C.torqueBg : C.signal, color: m.senderRole === \"admin\" ? C.onSignal : C.ink, border: m.senderRole === \"supplier\" ? `1px solid ${C.line}` : \"none\", borderRadius: 8, padding: \"8px 10px\" }}>", false], ["background: isMe ? C.signal : \"#fff\", color: isMe ? C.onSignal : C.ink, border: isMe ? \"none\" : `1px solid ${C.line}` }}>", "background: isMe ? \"#fff\" : C.signal, color: isMe ? C.ink : C.onSignal, border: isMe ? `1px solid ${C.line}` : \"none\" }}>", false]]}, {"file": "apps/hub-portal/src/HubConversations.jsx", "what": "hub conversations: Leap's messages in gold", "done": "background: m.senderRole === \"hub\" ? C.canvas : C.gold, color: m.senderRole === \"hub\" ? C.ink : C.onGold }}>", "pairs": [["background: m.senderRole === \"hub\" ? C.canvas : C.torqueBg }}>", "background: m.senderRole === \"hub\" ? C.canvas : C.gold, color: m.senderRole === \"hub\" ? C.ink : C.onGold }}>", false]]}, {"file": "apps/web-storefront/app/support/[id]/page.tsx", "what": "website support: Leap's replies in gold", "done": "${msg.senderRole === \"buyer\" ? \"bg-navy text-white\" : \"bg-signal text-on-signal\"}", "pairs": [["${msg.senderRole === \"buyer\" ? \"bg-navy text-white\" : \"border border-line bg-white text-ink\"}", "${msg.senderRole === \"buyer\" ? \"bg-navy text-white\" : \"bg-signal text-on-signal\"}", false]]}]},{"created": [], "replaced": [], "anchored": [{"file": "apps/admin-dashboard/src/App.jsx", "what": "message colours: Leap gold, supplier navy, hub red, buyer green; return conversations: each sender's colour; return conversations: the name line in the bubble; support tickets: the buyer in green; supplier messages: the supplier in navy", "done": "// Who wrote a message, by colour, everywhere (patch-message-colors): Leap golden yellow, supplier navy blue, hub red, buyer green.", "pairs": [["const RETURN_REASON_LABELS = {", "// Who wrote a message, by colour, everywhere (patch-message-colors): Leap golden yellow, supplier navy blue, hub red, buyer green.\nconst MSG_COLORS = {\n  admin: { bg: \"#F9B317\", fg: \"#0B3146\", sub: \"rgba(11,49,70,0.72)\" },\n  supplier: { bg: \"#0B3146\", fg: \"#FFFFFF\", sub: \"rgba(255,255,255,0.78)\" },\n  hub: { bg: \"#C0362C\", fg: \"#FFFFFF\", sub: \"rgba(255,255,255,0.8)\" },\n  buyer: { bg: \"#1E9D6B\", fg: \"#FFFFFF\", sub: \"rgba(255,255,255,0.8)\" },\n  other: { bg: \"#F5F6F8\", fg: \"#14171C\", sub: \"#636B78\" },\n};\nconst msgColor = (role) => MSG_COLORS[role] || MSG_COLORS.other;\nconst RETURN_REASON_LABELS = {", false], ["background: m.senderRole === \"admin\" ? C.signal : C.canvas, color: m.senderRole === \"admin\" ? C.onSignal : C.ink }}>", "background: msgColor(m.senderRole).bg, color: msgColor(m.senderRole).fg }}>", false], ["<div style={{ fontWeight: 800, fontSize: 10.5, color: C.muted, marginBottom: 2 }}>{({ admin: \"Leap (sent by us)\"", "<div style={{ fontWeight: 800, fontSize: 10.5, color: msgColor(m.senderRole).sub, marginBottom: 2 }}>{({ admin: \"Leap (sent by us)\"", false], ["                    background: m.senderRole === \"admin\" ? C.signal : C.canvas,\n                    color: m.senderRole === \"admin\" ? C.onSignal : C.ink,\n                  }}>{m.message}</div>", "                    background: msgColor(m.senderRole).bg,\n                    color: msgColor(m.senderRole).fg,\n                  }}>{m.message}</div>", false], ["background: isMe ? C.signal : \"#fff\", color: isMe ? C.onSignal : C.ink, border: isMe ? \"none\" : `1px solid ${C.line}` }}>", "background: msgColor(isMe ? \"admin\" : \"supplier\").bg, color: msgColor(isMe ? \"admin\" : \"supplier\").fg, border: \"none\" }}>", false]]}, {"file": "apps/supplier-portal/src/App.jsx", "what": "message colours: Leap gold, supplier navy, hub red, buyer green; returns conversation: each sender's colour; returns conversation: the name line; messages: the supplier in navy, Leap in gold", "done": "// Who wrote a message, by colour, everywhere (patch-message-colors): Leap golden yellow, supplier navy blue, hub red, buyer green.", "pairs": [["// Who wrote a message in the supplier's conversation", "// Who wrote a message, by colour, everywhere (patch-message-colors): Leap golden yellow, supplier navy blue, hub red, buyer green.\nconst MSG_COLORS = {\n  admin: { bg: \"#F9B317\", fg: \"#0B3146\", sub: \"rgba(11,49,70,0.72)\" },\n  supplier: { bg: \"#0B3146\", fg: \"#FFFFFF\", sub: \"rgba(255,255,255,0.78)\" },\n  hub: { bg: \"#C0362C\", fg: \"#FFFFFF\", sub: \"rgba(255,255,255,0.8)\" },\n  buyer: { bg: \"#1E9D6B\", fg: \"#FFFFFF\", sub: \"rgba(255,255,255,0.8)\" },\n  other: { bg: \"#F5F6F8\", fg: \"#14171C\", sub: \"#636B78\" },\n};\nconst msgColor = (role) => MSG_COLORS[role] || MSG_COLORS.other;\n// Who wrote a message in the supplier's conversation", false], ["background: m.senderRole === \"supplier\" ? \"#fff\" : m.senderRole === \"hub\" ? C.redBg : m.senderRole === \"buyer\" ? C.torqueBg : C.signal, color: m.senderRole === \"admin\" ? C.onSignal : C.ink, border: m.senderRole === \"supplier\" ? `1px solid ${C.line}` : \"none\", borderRadius: 8, padding: \"8px 10px\" }}>", "background: msgColor(m.senderRole).bg, color: msgColor(m.senderRole).fg, border: \"none\", borderRadius: 8, padding: \"8px 10px\" }}>", false], ["<div style={{ fontSize: 10.5, fontWeight: 800, color: C.muted, marginBottom: 2 }}>{(SUPPLIER_THREAD_WHO[lang] || SUPPLIER_THREAD_WHO.en)[m.senderRole]", "<div style={{ fontSize: 10.5, fontWeight: 800, color: msgColor(m.senderRole).sub, marginBottom: 2 }}>{(SUPPLIER_THREAD_WHO[lang] || SUPPLIER_THREAD_WHO.en)[m.senderRole]", false], ["background: isMe ? \"#fff\" : C.signal, color: isMe ? C.ink : C.onSignal, border: isMe ? `1px solid ${C.line}` : \"none\" }}>", "background: msgColor(isMe ? \"supplier\" : \"admin\").bg, color: msgColor(isMe ? \"supplier\" : \"admin\").fg, border: \"none\" }}>", false]]}, {"file": "apps/hub-portal/src/HubConversations.jsx", "what": "hub conversations: the hub in red, Leap in gold; hub conversations: the name line", "done": "background: m.senderRole === \"hub\" ? \"#C0362C\" : C.gold, color: m.senderRole === \"hub\" ? \"#FFFFFF\" : C.onGold }}>", "pairs": [["background: m.senderRole === \"hub\" ? C.canvas : C.gold, color: m.senderRole === \"hub\" ? C.ink : C.onGold }}>", "background: m.senderRole === \"hub\" ? \"#C0362C\" : C.gold, color: m.senderRole === \"hub\" ? \"#FFFFFF\" : C.onGold }}>", false], ["<div style={{ fontSize: 10.5, fontWeight: 800, color: C.muted, marginBottom: 2 }}>{m.senderRole === \"hub\" ? x.you : x.leap}", "<div style={{ fontSize: 10.5, fontWeight: 800, color: m.senderRole === \"hub\" ? \"rgba(255,255,255,0.8)\" : \"rgba(11,49,70,0.72)\", marginBottom: 2 }}>{m.senderRole === \"hub\" ? x.you : x.leap}", false]]}, {"file": "apps/web-storefront/app/support/[id]/page.tsx", "what": "website support: the buyer in green, Leap in gold", "done": "${msg.senderRole === \"buyer\" ? \"bg-gauge text-white\" : \"bg-signal text-on-signal\"}", "pairs": [["${msg.senderRole === \"buyer\" ? \"bg-navy text-white\" : \"bg-signal text-on-signal\"}", "${msg.senderRole === \"buyer\" ? \"bg-gauge text-white\" : \"bg-signal text-on-signal\"}", false]]}]}];
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const NAME = 'patch-message-colors';
const overlay = new Map();      // file -> text after the stages so far (LF)
const original = new Map();     // file -> the text on disk before (null = new file)
const eolOf = new Map();
const notes = [];
let problems = 0;
const once = (s, a) => s.split(a).length === 2;
const disk = (file) => { const p = path.join(root, file); return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null; };
const current = (file) => {
  if (overlay.has(file)) return overlay.get(file);
  const s = disk(file);
  if (s === null) return null;
  if (!original.has(file)) { original.set(file, s); eolOf.set(file, s.includes('\r\n') ? '\r\n' : '\n'); }
  return s.replace(/\r\n/g, '\n');
};
const put = (file, text) => { if (!original.has(file)) { const s = disk(file); original.set(file, s); eolOf.set(file, s && s.includes('\r\n') ? '\r\n' : '\n'); } overlay.set(file, text); };

STAGES.forEach((DATA, n) => {
  for (const e of DATA.created) {
    const s = current(e.file);
    if (s !== null) {
      if (s === e.text) { notes.push(`already   ${e.file}`); continue; }
      console.log(`REFUSED   ${e.file}: a different file with this name is already there, so nothing was changed. Send this file.`); problems++; continue;
    }
    if (!fs.existsSync(path.dirname(path.dirname(path.join(root, e.file))))) { console.log(`MISSING   ${e.file}: folder not found. Run this from D:\\LEAP-MARKETPLACE.`); problems++; continue; }
    put(e.file, e.text); notes.push(`create    ${e.file}: ${e.what}`);
  }
  for (const e of DATA.anchored) {
    const s = current(e.file);
    if (s === null) { if (e.optional) continue; console.log(`MISSING   ${e.file}: not found. Run this from D:\\LEAP-MARKETPLACE.`); problems++; continue; }
    const later = STAGES.slice(n + 1).flatMap((d) => d.anchored.filter((x) => x.file === e.file).map((x) => x.done));
    if (s.includes(e.done) || later.some((d) => s.includes(d))) { notes.push(`already   ${e.file} (part ${n + 1})`); continue; }
    let out = s; let why = null;
    for (const [a, b] of e.pairs) { if (!once(out, a)) { why = `this part was not found: "${a.split('\n').find((l) => l.trim()).trim().slice(0, 90)}"`; break; } out = out.replace(a, () => b); }
    if (!why && e.block) {
      const i = out.indexOf(e.block.from); const j = i < 0 ? -1 : out.indexOf(e.block.to, i);
      if (i < 0 || j < 0) why = `the part starting "${e.block.from.trim().slice(0, 60)}" was not found`;
      else out = out.slice(0, i) + e.block.text + out.slice(j);
    }
    if (why) { if (e.optional) { notes.push(`skipped   ${e.file}: a test file not as expected, left as it is`); continue; } console.log(`REFUSED   ${e.file}: ${why}, so nothing was changed. Send this file.`); problems++; continue; }
    put(e.file, out); notes.push(`change    ${e.file}: ${e.what}`);
  }
});
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const l of notes) console.log(write ? l.replace(/^create {4}/, 'created   ').replace(/^change {4}/, 'patched   ') : l.replace(/^create {4}|^change {4}/, 'would     '));
if (!overlay.size) { console.log('\nEverything is already in.'); process.exit(0); }
if (write) {
  for (const [file, text] of overlay) {
    const p = path.join(root, file);
    const before = original.get(file);
    if (before !== null && before !== undefined) fs.writeFileSync(`${p}.before-${NAME}`, before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, text.replace(/\n/g, eolOf.get(file) || '\n'));
  }
  console.log('\nDone. Refresh the admin, the supplier portal, the hub portal and the website with Ctrl+F5 (no API restart needed).');
} else console.log('\nDry run only. Add --write to apply.');
