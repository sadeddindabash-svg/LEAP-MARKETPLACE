#!/usr/bin/env node
/**
 * What the BUYER sees about a part the inspection hub found a problem with (patch-buyer-fault-tracking).
 *   Tracking: after "Received at hub": "Our inspection team is checking this part" -> "Our inspection found a problem..." -> "We are sending you
 *   a new part at no charge: order LP-...-R1" / "Your refund of $X is being processed" -> "Refunded $X" / "This case is closed" (or "no problem
 *   found" when it was a false alarm). Such a part is never shown as "delayed".
 *   Order page and tracking page (website): a box saying the same, with a link to the replacement order.
 *   Never shown to the buyer: the return to the supplier, the supplier, the hub's notes, who pays.
 *   node scripts/patch-buyer-fault-tracking.js            dry run
 *   node scripts/patch-buyer-fault-tracking.js --write    applies it
 */
const DATA = {"created": [{"file": "services/api/src/modules/tracking/faultStory.js", "what": "new: what the buyer is told about a part the hub found a problem with", "text": "/**\n * What the BUYER is told about a part the hub found a problem with (patch-buyer-fault-tracking): plain steps for the tracking timeline and one\n * outcome for the order page. Never the supplier, the hub's notes, the return to the supplier or who pays.\n *   checking     the hub flagged it; Leap is deciding\n *   problem      Leap confirmed the fault; a refund or a replacement is being arranged\n *   replaced     a free replacement order was created (replacementOrderId)\n *   refunding / refunded   the refund (refundAmount, USD)\n *   closed       the case was closed by hand\n * A flag that turned out to be nothing (\"continue processing\") gives \"no problem found\" and no outcome: the normal steps carry on.\n */\nconst L = {\n  checking: { en: 'Our inspection team is checking this part', ar: 'يقوم فريق الفحص لدينا بفحص هذه القطعة' },\n  noProblem: { en: 'Inspection complete: no problem found. Your part continues on its way', ar: 'اكتمل الفحص: لا توجد أي مشكلة، وتواصل قطعتك طريقها إليك' },\n  problem: { en: 'Our inspection found a problem with this part. We will replace it or refund you', ar: 'وجد الفحص مشكلة في هذه القطعة. سنستبدلها أو نعيد لك المبلغ' },\n  replaced: (id) => ({ en: `We are sending you a new part at no charge: order ${id}`, ar: `سنرسل لك قطعة جديدة مجانًا: الطلب ${id}` }),\n  refunding: (a) => ({ en: `Your refund of $${a} is being processed`, ar: `جارٍ معالجة استرداد ${a}$` }),\n  refunded: (a) => ({ en: `Refunded $${a}`, ar: `تم استرداد ${a}$` }),\n  closed: { en: 'This case is closed', ar: 'تم إغلاق هذه الحالة' },\n};\nconst money = (n) => Number(n || 0).toFixed(2);\n\nasync function faultStory(q, subOrderId, shipment, lang = 'en') {\n  const language = lang === 'ar' ? 'ar' : 'en';\n  const milestones = [];\n  if (!shipment) return { milestones, outcome: null };\n  const { rows: flags } = await q.query(\"SELECT created_at FROM hub_shipment_events WHERE shipment_id = $1 AND step = 'flagged' ORDER BY created_at ASC LIMIT 1\", [shipment.id]);\n  const { rows: [fc] } = await q.query('SELECT * FROM fault_cases WHERE sub_order_id = $1 ORDER BY created_at DESC LIMIT 1', [subOrderId]);\n  if (!flags.length && !fc) return { milestones, outcome: null };\n  const push = (time, text, kind) => { if (time) milestones.push({ time, description: text[language], kind, location: null, source: 'leap' }); };\n  if (flags.length) push(flags[0].created_at, L.checking, 'inspection_check');\n  if (!fc) {\n    if (shipment.resolution === 'continue_processing') { push(shipment.resolved_at, L.noProblem, 'inspection_ok'); return { milestones, outcome: null }; }\n    if (shipment.resolved_at) { push(shipment.resolved_at, L.closed, 'case_closed'); return { milestones, outcome: { state: 'closed' } }; }\n    return { milestones, outcome: { state: 'checking' } };\n  }\n  push(fc.created_at, L.problem, 'problem_found');\n  const after = (t) => { const base = new Date(fc.created_at).getTime() + 1000; const v = t ? new Date(t).getTime() : base; return new Date(Math.max(v, base)).toISOString(); };      // always after \"problem found\"\n  if (fc.outcome === 'replacement' && fc.replacement_order_id) {\n    push(after(fc.replacement_created_at || fc.updated_at), L.replaced(fc.replacement_order_id), 'replaced');\n    return { milestones, outcome: { state: 'replaced', replacementOrderId: fc.replacement_order_id } };\n  }\n  if (fc.outcome === 'refund') {\n    const amount = money(fc.refund_amount);\n    if (fc.refunded_at || fc.refund_status === 'issued') {\n      push(after(fc.refunded_at || fc.updated_at), L.refunded(amount), 'refunded');\n      return { milestones, outcome: { state: 'refunded', refundAmount: Number(amount) } };\n    }\n    push(after(fc.updated_at), L.refunding(amount), 'refunding');\n    return { milestones, outcome: { state: 'refunding', refundAmount: Number(amount) } };\n  }\n  if (fc.status === 'completed') { push(after(fc.completed_at || fc.updated_at), L.closed, 'case_closed'); return { milestones, outcome: { state: 'closed' } }; }\n  return { milestones, outcome: { state: 'problem' } };\n}\n\nmodule.exports = { faultStory };\n"}, {"file": "apps/web-storefront/components/FaultOutcome.tsx", "what": "new: the box that says what happened to a part the hub found a problem with", "text": "\"use client\";\n\nimport Link from \"@/components/LocLink\";\nimport { useLang } from \"@/components/LangProvider\";\nimport type { FaultOutcome } from \"@/lib/api\";\n\n// What happened to a part the inspection hub found a problem with (patch-buyer-fault-tracking): shown on the order page and the tracking page,\n// so the buyer is not left with a part that seems stuck at \"Received at hub\".\nconst TEXT = {\n  en: {\n    checking: \"Our inspection team is checking this part. We will tell you as soon as we know more.\",\n    problem: \"Our inspection found a problem with this part. We are arranging a replacement or a refund.\",\n    replaced: \"Replaced: we are sending you a new part at no charge.\",\n    replacedLink: \"Follow order\",\n    refunding: (a: string) => `Your refund of $${a} is being processed.`,\n    refunded: (a: string) => `Refunded $${a}. It can take a few days to appear with your bank.`,\n    closed: \"This case is closed.\",\n  },\n  ar: {\n    checking: \"يقوم فريق الفحص لدينا بفحص هذه القطعة، وسنبلغك فور معرفة المزيد.\",\n    problem: \"وجد الفحص مشكلة في هذه القطعة. نعمل على ترتيب استبدالها أو إعادة المبلغ.\",\n    replaced: \"تم الاستبدال: سنرسل لك قطعة جديدة مجانًا.\",\n    replacedLink: \"تابع الطلب\",\n    refunding: (a: string) => `جارٍ معالجة استرداد ${a}$.`,\n    refunded: (a: string) => `تم استرداد ${a}$. قد يستغرق ظهوره لدى البنك بضعة أيام.`,\n    closed: \"تم إغلاق هذه الحالة.\",\n  },\n};\n\nexport default function FaultOutcomeBox({ outcome, query = \"\" }: { outcome?: FaultOutcome | null; query?: string }) {\n  const lang = useLang();\n  if (!outcome) return null;\n  const x = TEXT[lang === \"ar\" ? \"ar\" : \"en\"];\n  const done = outcome.state === \"replaced\" || outcome.state === \"refunded\" || outcome.state === \"closed\";\n  const amount = Number(outcome.refundAmount || 0).toFixed(2);\n  const text = outcome.state === \"checking\" ? x.checking\n    : outcome.state === \"problem\" ? x.problem\n    : outcome.state === \"replaced\" ? x.replaced\n    : outcome.state === \"refunding\" ? x.refunding(amount)\n    : outcome.state === \"refunded\" ? x.refunded(amount)\n    : x.closed;\n  return (\n    <div data-testid=\"fault-outcome\" role=\"status\" className={`mt-4 rounded-[12px] border p-3.5 text-sm font-semibold ${done ? \"border-[#b9e4cc] bg-[#e8f7ef] text-[#0f6b49]\" : \"border-[#f3d27a] bg-[#fdf3d8] text-[#7a4e00]\"}`}>\n      <p>{text}</p>\n      {outcome.state === \"replaced\" && outcome.replacementOrderId && (\n        <p className=\"mt-2\">\n          <Link href={`/orders/${encodeURIComponent(outcome.replacementOrderId)}${query}`} className=\"font-bold text-navy underline underline-offset-4\">\n            {x.replacedLink} <span className=\"font-plate\" dir=\"ltr\">{outcome.replacementOrderId}</span>\n          </Link>\n        </p>\n      )}\n    </div>\n  );\n}\n"}], "replaced": [], "anchored": [{"file": "services/api/src/modules/tracking/liveTracking.js", "what": "tracking: the buyer is told what happened to a part the hub found a problem with; tracking: a part being handled is not 'delayed', and the outcome is sent; tracking: the outcome", "done": "      // patch-buyer-fault-tracking: checking -> problem found -> replaced / refunded / closed, in plain words (never the return to the supplier)", "pairs": [["      if (shipment.delivered_at) {\n        hubMilestones.push({", "      // patch-buyer-fault-tracking: checking -> problem found -> replaced / refunded / closed, in plain words (never the return to the supplier)\n      const story = await require('./faultStory').faultStory(db, so.id, shipment, language);\n      hubMilestones.push(...story.milestones);\n      so.faultOutcome = story.outcome;\n      if (shipment.delivered_at) {\n        hubMilestones.push({", false], ["    const isDelayed = shipment?.status !== 'delivered' && daysSinceLastUpdate !== null && daysSinceLastUpdate >= 5;", "    const isDelayed = !so.faultOutcome && shipment?.status !== 'delivered' && daysSinceLastUpdate !== null && daysSinceLastUpdate >= 5;      // a part being checked, replaced or refunded is not \"delayed\"", false], ["      supplierTrackingNumber: so.supplier_tracking_number,\n      hubTrackingNumber: hubTrackingNumber || null,\n      timeline,", "      supplierTrackingNumber: so.supplier_tracking_number,\n      hubTrackingNumber: hubTrackingNumber || null,\n      faultOutcome: so.faultOutcome || null,      // checking / problem / replaced (replacementOrderId) / refunding / refunded (refundAmount) / closed\n      timeline,", false]]}, {"file": "services/api/src/modules/order/routes.js", "what": "order page: what happened to a part the hub found a problem with", "done": "        // patch-buyer-fault-tracking: checking / problem / replaced (replacementOrderId) / refunding / refunded / closed, for the buyer's order page", "pairs": [["        hubShipment,\n        // Can this part still be returned?", "        hubShipment,\n        // patch-buyer-fault-tracking: checking / problem / replaced (replacementOrderId) / refunding / refunded / closed, for the buyer's order page\n        faultOutcome: shipmentRows.length ? (await require('../tracking/faultStory').faultStory(db, so.id, shipmentRows[0])).outcome : null,\n        // Can this part still be returned?", false]]}, {"file": "apps/web-storefront/lib/api.ts", "what": "website: what happened to a part the hub found a problem with; website: the tracking carries it too", "done": "// patch-buyer-fault-tracking: a part the inspection hub found a problem with", "pairs": [["export interface SupplierSubOrder {\n  subOrderId: number;", "// patch-buyer-fault-tracking: a part the inspection hub found a problem with\nexport interface FaultOutcome { state: \"checking\" | \"problem\" | \"replaced\" | \"refunding\" | \"refunded\" | \"closed\"; replacementOrderId?: string; refundAmount?: number }\n\nexport interface SupplierSubOrder {\n  faultOutcome?: FaultOutcome | null;\n  subOrderId: number;", false], ["export interface SubOrderTracking { subOrderId: number; supplierTrackingNumber: string | null; hubTrackingNumber: string | null; timeline: TrackingStep[]; isDelayed: boolean }", "export interface SubOrderTracking { subOrderId: number; supplierTrackingNumber: string | null; hubTrackingNumber: string | null; timeline: TrackingStep[]; isDelayed: boolean; faultOutcome?: FaultOutcome | null }", false]]}, {"file": "apps/web-storefront/app/orders/[id]/page.tsx", "what": "order page: the box; order page: under the part's steps", "done": "import FaultOutcomeBox from \"@/components/FaultOutcome\";      // patch-buyer-fault-tracking", "pairs": [["import StatusTimeline from \"@/components/StatusTimeline\";", "import StatusTimeline from \"@/components/StatusTimeline\";\nimport FaultOutcomeBox from \"@/components/FaultOutcome\";      // patch-buyer-fault-tracking", false], ["      <StatusTimeline status={subOrderStage(so)} lang={lang} />", "      <StatusTimeline status={subOrderStage(so)} lang={lang} />\n      <FaultOutcomeBox outcome={so.faultOutcome} query={who.guestEmail ? `?guestEmail=${encodeURIComponent(who.guestEmail)}` : \"\"} />", false]]}, {"file": "apps/web-storefront/app/orders/[id]/tracking/page.tsx", "what": "tracking page: the box; tracking page: above the steps", "done": "import FaultOutcomeBox from \"@/components/FaultOutcome\";      // patch-buyer-fault-tracking", "pairs": [["import { formatDate } from \"@/lib/orders\";", "import { formatDate } from \"@/lib/orders\";\nimport FaultOutcomeBox from \"@/components/FaultOutcome\";      // patch-buyer-fault-tracking", false], ["              {so.isDelayed && <p role=\"status\"", "              {so.faultOutcome && <div className=\"mb-3 [&>div]:mt-0\"><FaultOutcomeBox outcome={so.faultOutcome} query={guestEmail ? `?guestEmail=${encodeURIComponent(guestEmail)}` : \"\"} /></div>}\n              {so.isDelayed && <p role=\"status\"", false]]}]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-patch-buyer-fault-tracking`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log("\nDone. Then restart the API (cd services\\api ; npm run dev, one API window) and refresh the website with Ctrl+F5. No migration.");
