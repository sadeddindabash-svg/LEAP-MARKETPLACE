#!/usr/bin/env node
/**
 * Buyer app, My orders: premium order cards (A + C, confirmed with the person via mockup), as short as they can be, without seller names:
 *  - a navy header: the order number, the date (gold) and the status pill (gold on its way, green delivered, red cancelled);
 *  - up to 3 photos of the parts ("+2 more"), the total in gold with the number of parts, and a 4-step progress bar (gold; green once delivered).
 * Server: the orders list also sends each order's number of parts and up to 3 photos (no migration). The whole card opens the order, as before.
 *
 *   node scripts/patch-order-cards.js            dry run
 *   node scripts/patch-order-cards.js --write    applies it (each changed file is saved as <file>.before-patch-order-cards first)
 * Then: API: restart it (no migration) · buyer app: R
 *
 * A file that is not as this patch expects is NOT changed. Windows (CRLF) line endings are handled. Running it twice is harmless.
 */
const DATA = {"created": [], "anchored": [{"file": "services/api/src/modules/order/routes.js", "what": "server: each order in the list says how many parts it has and sends up to 3 of their photos", "done": "for the buyer's order cards: how many, and the first 3 photos", "pairs": [["    const withDisplayStatus = await Promise.all(rows.map(async (o) => {", "    // The parts of each order, for the buyer's order cards: how many, and the first 3 photos (each part's first photo). One query for all the orders.\n    const partsByOrder = {};\n    if (orderIds.length > 0) {\n      const { rows: lineRows } = await db.query(\n        `SELECT so.order_id, oli.quantity,\n                (SELECT pi.url FROM product_images pi WHERE pi.product_id = oli.product_id ORDER BY pi.sort_order LIMIT 1) AS photo\n         FROM order_line_items oli JOIN supplier_sub_orders so ON so.id = oli.sub_order_id\n         WHERE so.order_id = ANY($1::text[]) ORDER BY so.order_id, oli.id`,\n        [orderIds]\n      );\n      for (const l of lineRows) {\n        const e = partsByOrder[l.order_id] || (partsByOrder[l.order_id] = { lineCount: 0, itemCount: 0, photos: [] });\n        e.lineCount += 1;\n        e.itemCount += Number(l.quantity) || 0;\n        if (e.photos.length < 3) e.photos.push(l.photo || null);\n      }\n    }\n\n    const withDisplayStatus = await Promise.all(rows.map(async (o) => {", false], ["        placedAt: o.placed_at,\n        supplierNames: isAdmin", "        placedAt: o.placed_at,\n        // the order card: how many parts (lines and pieces) and up to 3 photos\n        lineCount: (partsByOrder[o.id] || {}).lineCount || 0,\n        itemCount: (partsByOrder[o.id] || {}).itemCount || 0,\n        photos: (partsByOrder[o.id] || {}).photos || [],\n        supplierNames: isAdmin", false]]}, {"file": "apps/mobile/lib/features/orders/orders_screen.dart", "what": "app, My orders: the premium card (navy header with number, date and status; the parts' photos; the total in gold with the number of parts; the progress bar); no seller names", "done": "class _OrderCard extends StatelessWidget", "pairs": [["import '../../core/theme.dart';\n", "import 'package:cached_network_image/cached_network_image.dart';\nimport '../../core/theme.dart';\n", false], ["class _AnimatedCountText extends StatelessWidget {", "/// A premium order card (confirmed with the person via mockup, A + C, kept as short as it can be): a navy header with the order number, the date and the\n/// status; under it up to 3 photos of the parts (\"+2 more\"), the total in gold with the number of parts, and a 4-step progress bar (gold; green once\n/// delivered). The whole card opens the order. No seller names.\nclass _OrderCard extends StatelessWidget {\n  final Map<String, dynamic> order;\n  final String status;\n  const _OrderCard({required this.order, required this.status});\n\n  static const _stages = ['pending', 'preparing', 'shipped', 'delivered'];\n  static const _monthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];\n  static const _monthsAr = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];\n\n  Widget _thumb(String? url, LeapPalette p) => Container(\n        width: 34,\n        height: 34,\n        clipBehavior: Clip.antiAlias,\n        decoration: BoxDecoration(\n          color: p.chalk,\n          borderRadius: BorderRadius.circular(9),\n          border: Border.all(color: p.card, width: 2),\n          boxShadow: const [BoxShadow(color: Color(0x260B3146), blurRadius: 6, offset: Offset(0, 2))],\n        ),\n        child: url == null || url.isEmpty\n            ? Icon(Icons.settings_outlined, size: 16, color: p.muted)\n            : CachedNetworkImage(imageUrl: ApiClient.resolveMediaUrl(url), fit: BoxFit.cover, errorWidget: (context, u, e) => Icon(Icons.settings_outlined, size: 16, color: p.muted)),\n      );\n\n  @override\n  Widget build(BuildContext context) {\n    final palette = LeapPalette.of(context);\n    final isAr = context.watch<LanguageState>().isArabic;\n    final o = order;\n    final delivered = status == 'delivered';\n    final cancelled = status == 'cancelled';\n    final step = _stages.indexOf(status); // -1: cancelled (no bar)\n    final photos = ((o['photos'] as List?) ?? const []).map((x) => x as String?).toList();\n    final lineCount = (o['lineCount'] as num?)?.toInt() ?? photos.length;\n    final itemCount = (o['itemCount'] as num?)?.toInt() ?? 0;\n    final more = lineCount - photos.length;\n    final placed = DateTime.tryParse('${o['placedAt']}')?.toLocal();\n    final date = placed == null ? null : '${placed.day} ${(isAr ? _monthsAr : _monthsEn)[placed.month - 1]} ${placed.year}';\n    final pill = cancelled\n        ? const [Color(0xFFEF5350), Color(0xFFC62828)]\n        : delivered\n            ? const [Color(0xFF34C785), Color(0xFF0F6B49)]\n            : const [Color(0xFFFFD567), Color(0xFFE39F0C)];\n    final bar = delivered ? const [Color(0xFF34C785), Color(0xFF0F6B49)] : const [Color(0xFFFFD567), Color(0xFFE39F0C)];\n    return Container(\n      margin: const EdgeInsets.only(bottom: 8),\n      clipBehavior: Clip.antiAlias,\n      decoration: Premium.card(context, radius: 14),\n      child: Material(\n        type: MaterialType.transparency,\n        child: InkWell(\n          onTap: () => context.push('/orders/${o['id']}'),\n          child: Column(\n            crossAxisAlignment: CrossAxisAlignment.stretch,\n            children: [\n              // the navy header: number, date, status\n              Container(\n                padding: const EdgeInsetsDirectional.fromSTEB(12, 7, 10, 7),\n                decoration: const BoxDecoration(gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFF0B3146), Color(0xFF215A78)])),\n                child: Row(\n                  children: [\n                    Expanded(\n                      child: Column(\n                        crossAxisAlignment: CrossAxisAlignment.start,\n                        children: [\n                          Text('${o['id']}', textDirection: TextDirection.ltr, style: const TextStyle(fontFamily: 'monospace', fontWeight: FontWeight.w800, fontSize: 13, letterSpacing: 0.5, color: Colors.white)),\n                          if (date != null) Text(date, style: const TextStyle(color: Color(0xFFF9D77A), fontSize: 10.5)),\n                        ],\n                      ),\n                    ),\n                    Container(\n                      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),\n                      decoration: BoxDecoration(borderRadius: BorderRadius.circular(12), gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: pill)),\n                      child: Text(\n                        trStatus(context, status).toUpperCase(),\n                        style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w900, letterSpacing: 0.3, color: cancelled || delivered ? Colors.white : const Color(0xFF0B3146)),\n                      ),\n                    ),\n                  ],\n                ),\n              ),\n              Padding(\n                padding: const EdgeInsetsDirectional.fromSTEB(12, 8, 6, 8),\n                child: Column(\n                  crossAxisAlignment: CrossAxisAlignment.stretch,\n                  children: [\n                    Row(\n                      children: [\n                        for (var k = 0; k < photos.length; k++)\n                          Align(widthFactor: k < photos.length - 1 ? 0.78 : 1, alignment: AlignmentDirectional.centerStart, child: _thumb(photos[k], palette)),\n                        if (more > 0)\n                          Padding(\n                            padding: const EdgeInsetsDirectional.only(start: 6),\n                            child: Text('+$more ${isAr ? 'أخرى' : 'more'}', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: palette.muted)),\n                          ),\n                        const SizedBox(width: 8),\n                        Expanded(\n                          child: Column(\n                            crossAxisAlignment: CrossAxisAlignment.end,\n                            children: [\n                              FittedBox(\n                                fit: BoxFit.scaleDown,\n                                alignment: AlignmentDirectional.centerEnd,\n                                child: Text(formatPrice(context, (o['total'] as num).toDouble()), style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: Color(0xFFC98A00))),\n                              ),\n                              if (itemCount > 0)\n                                Text(isAr ? '$itemCount قطع' : '$itemCount ${itemCount == 1 ? 'part' : 'parts'}', style: TextStyle(fontSize: 10.5, color: palette.muted)),\n                            ],\n                          ),\n                        ),\n                        const Icon(Icons.chevron_right, color: Color(0xFFC98A00)),\n                      ],\n                    ),\n                    // the 4 steps: placed, preparing, shipped, delivered (the status pill above names the current one)\n                    if (!cancelled) ...[\n                      const SizedBox(height: 7),\n                      Padding(\n                        padding: const EdgeInsetsDirectional.only(end: 6),\n                        child: Row(\n                          children: [\n                            for (var k = 0; k < 4; k++) ...[\n                              if (k > 0) const SizedBox(width: 4),\n                              Expanded(\n                                child: Container(\n                                  height: 4,\n                                  decoration: BoxDecoration(\n                                    borderRadius: BorderRadius.circular(2),\n                                    color: k <= step ? null : palette.line,\n                                    gradient: k <= step ? LinearGradient(colors: bar) : null,\n                                  ),\n                                ),\n                              ),\n                            ],\n                          ],\n                        ),\n                      ),\n                    ],\n                  ],\n                ),\n              ),\n            ],\n          ),\n        ),\n      ),\n    );\n  }\n}\n\nclass _AnimatedCountText extends StatelessWidget {", false], ["import '../../widgets/plate_chip.dart';\n", "", "maybe"]], "block": {"from": "                      // Real supplier names (new) -- closes a real gap:", "to": "                    }))),", "text": "                      // the premium card (A + C): navy header, the parts' photos, the total and the progress; no seller names\n                      return _OrderCard(order: o, status: displayStatus);\n"}}]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-patch-order-cards`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Then:\n  API:       restart it (Ctrl+C, then npm run dev; no migration)\n  buyer app: R (hot restart) in flutter run');
