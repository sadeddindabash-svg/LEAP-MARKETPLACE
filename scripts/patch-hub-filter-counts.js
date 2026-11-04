#!/usr/bin/env node
/**
 * Inspection hub: a number on each queue filter (hub portal and hub app, confirmed with the person via mockup), so the hub sees at once what is
 * waiting: All · Awaiting receipt (gold) · In progress (gold) · Shipped · Delivered · Flagged (red, open flags only). The numbers count every
 * shipment, whatever is typed in the search box, and refresh with the list. No server change.
 *
 *   node scripts/patch-hub-filter-counts.js            dry run
 *   node scripts/patch-hub-filter-counts.js --write    applies it (each changed file is saved as <file>.before-hub-filter-counts first)
 * Then: hub portal: Ctrl+F5. Hub app: q, then flutter run with your API address.
 *
 * A file that is not as this patch expects is NOT changed (the whole patch stops). Windows (CRLF) line endings are handled. Running it twice is harmless.
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"created":[],"anchored":[{"file":"apps/hub-portal/src/App.jsx","what":"hub portal: numbers on the queue filters","done":"function FilterCount(","pairs":[["function QueueScreen({ onOpenShipment }) {","// The number on a queue filter (how many shipments are in it): gold for work coming or at the hub, red for open flags, grey otherwise.\nconst FILTER_TONE = { awaiting_receipt: \"gold\", in_progress: \"gold\", flagged: \"red\" };\nfunction FilterCount({ n, tone, active }) {\n  if (!n) return null;\n  const colors = tone === \"red\" ? [C.red, \"#fff\"] : tone === \"gold\" ? [\"#F2A71B\", \"#241A05\"] : active ? [\"#fff\", C.ink] : [\"#EEF0F3\", C.ink];\n  return <span data-testid=\"filter-count\" style={{ ...body, minWidth: 19, height: 19, padding: \"0 5px\", boxSizing: \"border-box\", borderRadius: 10, display: \"inline-flex\", alignItems: \"center\", justifyContent: \"center\", fontSize: 10.5, fontWeight: 800, background: colors[0], color: colors[1] }}>{n}</span>;\n}\n\nfunction QueueScreen({ onOpenShipment }) {"],["  const filtered = shipments.filter((s) => {","  // the number on each filter: every shipment in it, whatever is typed in the search box\n  const inFilter = (s, id) => (id === \"all\" ? true : id === \"in_progress\" ? IN_PROGRESS_STATUSES.includes(s.status) : id === \"flagged\" ? FLAGGED_STATUSES.includes(s.status) && !s.resolvedAt : s.status === id);\n  const countOf = (id) => shipments.filter((s) => inFilter(s, id)).length;\n\n  const filtered = shipments.filter((s) => {"],["...body, padding: \"7px 13px\", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: \"pointer\", whiteSpace: \"nowrap\",","...body, display: \"inline-flex\", alignItems: \"center\", gap: 7, padding: \"7px 11px\", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: \"pointer\", whiteSpace: \"nowrap\","],[">{t.filters[id]}</button>",">{t.filters[id]}{loadState === \"ready\" && <FilterCount n={countOf(id)} tone={FILTER_TONE[id]} active={filter === id} />}</button>"]]},{"file":"apps/hub-mobile/lib/features/queue/queue_screen.dart","what":"hub app: numbers on the queue filter chips","done":"Widget _filterCount(","pairs":[["  List<ShipmentSummary> get _filtered {","  // the number on each filter chip: every shipment in it, whatever is typed in the search box\n  bool _inFilter(ShipmentSummary s, String id) {\n    if (id == 'all') return true;\n    if (id == 'in_progress') return _inProgressStatuses.contains(s.status);\n    if (id == 'flagged') return kFlaggedStatuses.contains(s.status) && s.resolvedAt == null;\n    return s.status == id;\n  }\n\n  int _countOf(String id) => _shipments.where((s) => _inFilter(s, id)).length;\n\n  // gold for work coming or at the hub, red for open flags, grey otherwise\n  Widget _filterCount(String id, bool active) {\n    final n = _countOf(id);\n    if (_loadState != _LoadState.ready || n == 0) return const SizedBox.shrink();\n    final Color bg; final Color fg;\n    if (id == 'flagged') { bg = HubColors.red; fg = Colors.white; }\n    else if (id == 'awaiting_receipt' || id == 'in_progress') { bg = const Color(0xFFF2A71B); fg = const Color(0xFF241A05); }\n    else if (active) { bg = Colors.white; fg = HubColors.ink; }\n    else { bg = const Color(0xFFEEF0F3); fg = HubColors.ink; }\n    return Container(\n      margin: const EdgeInsets.only(left: 6),\n      constraints: const BoxConstraints(minWidth: 19),\n      height: 19,\n      padding: const EdgeInsets.symmetric(horizontal: 5),\n      alignment: Alignment.center,\n      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(10)),\n      child: Text('$n', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: fg)),\n    );\n  }\n\n  List<ShipmentSummary> get _filtered {"],["label: Text(t.filters[id] ?? id),","label: Row(mainAxisSize: MainAxisSize.min, children: [Text(t.filters[id] ?? id), _filterCount(id, isActive)]),"]]}]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-hub-filter-counts`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Then: hub portal: Ctrl+F5. Hub app: q, then flutter run with your API address.');
