#!/usr/bin/env node
/**
 * Phone notifications (confirmed with the person via mockup, choice A):
 *   order notifications: high priority, sound, full text on the lock screen, a banner over any app; inside LEAP a gold strip with View
 *   price drops and back-in-stock alerts: quiet (an icon in the top bar and the list, no banner)
 *   tapping a notification opens the order or product; order numbers stay together in Arabic
 *   node scripts/patch-push-banners.js            dry run
 *   node scripts/patch-push-banners.js --write    applies it
 */
const DATA = {"created": [{"file": "apps/mobile/lib/core/push_banner.dart", "what": "App: the gold strip at the top while LEAP is open, and opening the right screen from a notification", "text": "import 'dart:async';\nimport 'package:flutter/material.dart';\nimport 'package:firebase_messaging/firebase_messaging.dart';\nimport '../app.dart' show appRouter;\n\n/// Opens what a notification points to (the same places as the Notifications list) (patch-push-banners).\nvoid openPushLink(Map<String, dynamic> data) {\n  final type = (data['linkType'] as String?) ?? '';\n  final id = (data['linkId'] as String?) ?? '';\n  String path = '/notifications';\n  if (type == 'order' && id.isNotEmpty) {\n    path = '/orders/$id';\n  } else if (type == 'ticket' && id.isNotEmpty) {\n    path = '/support/$id';\n  } else if (type == 'product' && id.isNotEmpty) {\n    path = '/product/$id';\n  } else if (type == 'saved_search') {\n    path = '/saved-searches';\n  } else if (type == 'promo_code') {\n    path = '/referrals';\n  }\n  try {\n    appRouter.push(path);\n  } catch (err) {\n    debugPrint('[push] could not open $path: $err');\n  }\n}\n\n/// The gold strip at the top while LEAP is open (confirmed with the person via mockup): order notifications only,\n/// for 5 seconds; \"View\" opens the order. Price drops and back-in-stock alerts stay quiet (choice A).\nclass PushBanner {\n  static OverlayEntry? _entry;\n  static Timer? _timer;\n\n  static void show(RemoteMessage message) {\n    final n = message.notification;\n    if (n == null) return;\n    final overlay = appRouter.routerDelegate.navigatorKey.currentState?.overlay;\n    if (overlay == null) return;\n    hide();\n    _entry = OverlayEntry(\n      builder: (context) => _Strip(\n        title: n.title ?? '',\n        body: n.body,\n        onView: () {\n          hide();\n          openPushLink(message.data);\n        },\n        onClose: hide,\n      ),\n    );\n    overlay.insert(_entry!);\n    _timer = Timer(const Duration(seconds: 5), hide);\n  }\n\n  static void hide() {\n    _timer?.cancel();\n    _timer = null;\n    _entry?.remove();\n    _entry = null;\n  }\n}\n\nclass _Strip extends StatelessWidget {\n  final String title;\n  final String? body;\n  final VoidCallback onView;\n  final VoidCallback onClose;\n  const _Strip({required this.title, required this.body, required this.onView, required this.onClose});\n\n  @override\n  Widget build(BuildContext context) {\n    final dark = Theme.of(context).brightness == Brightness.dark;\n    final isAr = Directionality.of(context) == TextDirection.rtl;\n    const gold = Color(0xFFC9A24A);\n    const navy = Color(0xFF0B3146);\n    final card = dark ? const Color(0xFF171C24) : Colors.white;\n    final ink = dark ? const Color(0xFFE7EBF1) : const Color(0xFF16202C);\n    final muted = dark ? const Color(0xFF98A2B3) : const Color(0xFF667085);\n    return Positioned(\n      top: 0,\n      left: 0,\n      right: 0,\n      child: SafeArea(\n        child: TweenAnimationBuilder<double>(\n          tween: Tween(begin: -1, end: 0),\n          duration: const Duration(milliseconds: 260),\n          curve: Curves.easeOut,\n          builder: (context, v, child) => FractionalTranslation(translation: Offset(0, v), child: child),\n          child: Padding(\n            padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),\n            child: Dismissible(\n              key: const ValueKey('push-strip'),\n              direction: DismissDirection.up,\n              onDismissed: (_) => onClose(),\n              child: Material(\n                color: card,\n                elevation: 8,\n                shadowColor: Colors.black38,\n                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14), side: const BorderSide(color: gold, width: 1.5)),\n                child: InkWell(\n                  borderRadius: BorderRadius.circular(14),\n                  onTap: onView,\n                  child: Padding(\n                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),\n                    child: Row(\n                      children: [\n                        Container(\n                          width: 30,\n                          height: 30,\n                          alignment: Alignment.center,\n                          decoration: BoxDecoration(color: navy, borderRadius: BorderRadius.circular(8), border: Border.all(color: gold, width: 1.2)),\n                          child: const Text('L', style: TextStyle(color: gold, fontWeight: FontWeight.w800, fontSize: 14)),\n                        ),\n                        const SizedBox(width: 10),\n                        Expanded(\n                          child: Column(\n                            mainAxisSize: MainAxisSize.min,\n                            crossAxisAlignment: CrossAxisAlignment.start,\n                            children: [\n                              Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: ink)),\n                              if (body != null && body!.isNotEmpty)\n                                Text(body!, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, color: muted)),\n                            ],\n                          ),\n                        ),\n                        const SizedBox(width: 8),\n                        Text(isAr ? 'عرض' : 'View', style: const TextStyle(fontWeight: FontWeight.w700, color: gold, fontSize: 13.5)),\n                      ],\n                    ),\n                  ),\n                ),\n              ),\n            ),\n          ),\n        ),\n      ),\n    );\n  }\n}\n"}], "replaced": [], "anchored": [{"file": "services/api/src/modules/push/client.js", "what": "API: order notifications high priority, sound, shown on the lock screen and as a banner; price drops quiet (choice A); order numbers kept together in Arabic", "done": "'apns-priority'", "pairs": [["  const admin = require('firebase-admin');\n  getFirebaseApp();", "  // Arabic text: keep codes such as LP-10482 together, left to right (patch-push-banners)\n  const isolateCodes = (t) => (typeof t === 'string' && /[\\u0600-\\u06FF]/.test(t) ? t.replace(/[A-Z]{2,}-[A-Z0-9-]+/g, (m) => `\\u2066${m}\\u2069`) : t);\n  title = isolateCodes(title);\n  body = isolateCodes(body);\n  // orders: wake the phone, banner, sound, full text on the lock screen; updates (price drops, back in stock): quiet (confirmed with the person via mockup, choice A)\n  const channel = channelIdForType(type);\n  const loud = channel === 'orders';\n  const androidNotification = loud ? { channelId: channel, visibility: 'public', defaultSound: true } : { channelId: channel, visibility: 'private' };\n\n  const admin = require('firebase-admin');\n  getFirebaseApp();", false], ["          android: { notification: { channelId: channelIdForType(type) } },\n          data: { linkType: linkType || '', linkId: linkId || '' },", "          android: { priority: loud ? 'high' : 'normal', notification: androidNotification },\n          apns: { headers: { 'apns-priority': loud ? '10' : '5' }, payload: { aps: loud ? { sound: 'default', 'interruption-level': 'active' } : { 'interruption-level': 'passive' } } },\n          // `channel` tells the app whether to show its own gold strip while it is open (orders only)\n          data: { linkType: linkType || '', linkId: linkId || '', channel },", false]]}, {"file": "apps/mobile/lib/core/push_state.dart", "what": "App: the gold strip while LEAP is open (orders only); tapping a notification opens the right order or product", "done": "PushBanner.show", "pairs": [["import '../services/api_client.dart';\n", "import '../services/api_client.dart';\nimport 'push_banner.dart';\n", false], ["      messaging.onTokenRefresh.listen((newToken) => _registerToken(authToken, newToken));\n", "      messaging.onTokenRefresh.listen((newToken) => _registerToken(authToken, newToken));\n      // While LEAP is open: no system banner on iPhone (Android shows none by itself); LEAP shows its own gold strip instead, for orders only (patch-push-banners)\n      await messaging.setForegroundNotificationPresentationOptions(alert: false, badge: true, sound: false);\n      FirebaseMessaging.onMessage.listen((message) {\n        if (message.data['channel'] != 'updates') PushBanner.show(message);\n      });\n      // A notification tapped on the lock screen or in the notification bar opens what it is about\n      FirebaseMessaging.onMessageOpenedApp.listen((message) => openPushLink(message.data));\n      final opened = await messaging.getInitialMessage();\n      if (opened != null) openPushLink(opened.data);\n", false]]}]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-patch-push-banners`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Then: API window: cd services\\api ; npm run dev   |   app: press q, then flutter run (a new file was added). Notifications arrive only after Firebase is set up (guide: Phase 11b).');
