#!/usr/bin/env node
/**
 * Removes "This isn't my parcel / I didn't receive it" (and the support request it opened) from the website order page and the buyer app.
 * Everything else about the delivery stays: the delivery code, "Received by", the delivery photos. The words stay in i18n.ts unused (harmless).
 * Run it after patch-delivery-code-box.
 *
 *   node scripts/patch-no-report-parcel.js            dry run
 *   node scripts/patch-no-report-parcel.js --write    applies it (each changed file is saved as <file>.before-no-report-parcel first)
 * Then: Ctrl+F5 on the website; buyer app: q, then flutter run --dart-define=API_BASE_URL=http://192.168.0.210:4000   (No server change.)
 *
 * A file that is not as this patch expects is NOT changed (the whole patch stops). Windows (CRLF) line endings are handled. Running it twice is harmless.
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"created": [], "anchored": [{"file": "apps/web-storefront/app/orders/[id]/page.tsx", "what": "website order page: \"This isn't my parcel / I didn't receive it\" removed", "done": "{(canCancelPart || isPartReturnable(order, so)) && (", "pairs": [["createSupportTicket, ", "", false], ["  const [report, setReport] = useState<{ state: \"idle\" | \"sending\" | \"sent\" | \"error\"; ticketId?: string }>({ state: \"idle\" });\n  const reportParcel = async () => {\n    if (!window.confirm(t(\"not_my_parcel_confirm\"))) return;\n    setReport({ state: \"sending\" });\n    try {\n      const ticket = await createSupportTicket(\n        { subject: `I didn't receive my parcel (order ${order.id})`, message: `Order ${order.id} shows as delivered, but I did not receive this parcel (or the delivery photo is not my parcel). Please check with the delivery company.`, orderId: order.id },\n        { token: who.token ?? undefined, guestEmail: who.guestEmail ?? undefined }\n      );\n      setReport({ state: \"sent\", ticketId: ticket.id });\n    } catch {\n      setReport({ state: \"error\" });\n    }\n  };\n", "", false], ["  const showReport = proof.length > 0;\n", "", false], ["{(showReport || canCancelPart || isPartReturnable(order, so)) && (", "{(canCancelPart || isPartReturnable(order, so)) && (", false], ["            {showReport && (report.state === \"sent\"\n              ? <p className=\"text-sm font-semibold text-[#1e6b34]\">{t(\"not_my_parcel_sent\")}{report.ticketId && who.token ? <> <Link href={`/support/${report.ticketId}`} className=\"underline\">{t(\"not_my_parcel_open\")}</Link></> : null}</p>\n              : <button type=\"button\" data-testid=\"not-my-parcel\" className=\"text-sm font-bold text-[#a12a21] hover:underline disabled:opacity-50\" disabled={report.state === \"sending\"} onClick={reportParcel}>{t(\"not_my_parcel\")}</button>)}\n            {showReport && report.state === \"error\" && <p className=\"mt-1 text-sm text-[#a12a21]\">{t(\"not_my_parcel_failed\")}</p>}\n", "", false]]}, {"file": "apps/mobile/lib/widgets/delivery_confirm.dart", "what": "buyer app: \"This isn't my parcel / I didn't receive it\" removed", "done": "///  * [DeliveryProofSummary]  who received it and \"confirmed with your code\".\n", "pairs": [["///  * [DeliveryProofSummary]  who received it, \"confirmed with your code\", and \"This isn't my parcel / I didn't receive it\",\n///                            which opens a support ticket for this order.\n", "///  * [DeliveryProofSummary]  who received it and \"confirmed with your code\".\n", false], ["import 'package:go_router/go_router.dart';\n", "", false], ["import '../core/auth_state.dart';\n", "", false], ["import '../services/api_client.dart';\n", "", false], ["  bool _sending = false;\n\n", "", false], ["        Align(\n          alignment: AlignmentDirectional.centerStart,\n          child: TextButton(\n            key: const Key('report-parcel'),\n            onPressed: _sending ? null : _report,\n            style: TextButton.styleFrom(padding: EdgeInsets.zero, foregroundColor: const Color(0xFFB42318)),\n            child: Text(ar ? 'ليست طردي / لم أستلمه' : \"This isn't my parcel / I didn't receive it\", style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),\n          ),\n        ),\n", "", false]], "block": {"from": "  Future<void> _report() async {", "to": "  @override\n  Widget build(BuildContext context) {\n    final ar = context.watch<LanguageState>().isArabic;\n    final palette = LeapPalette.of(context);\n    final receivedBy", "text": ""}}, {"file": "apps/web-storefront/app/deliveryCode.wiring.test.ts", "what": "website test: the button is gone", "optional": true, "done": "    expect(page).not.toContain('data-testid=\"not-my-parcel\"');\n", "pairs": [["    expect(page).toContain('data-testid=\"not-my-parcel\"');\n    expect(page).toContain(\"createSupportTicket(\");\n", "    expect(page).not.toContain('data-testid=\"not-my-parcel\"');\n", false]]}]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-no-report-parcel`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Then: Ctrl+F5 on the website; buyer app: q, then flutter run --dart-define=API_BASE_URL=http://192.168.0.210:4000');
