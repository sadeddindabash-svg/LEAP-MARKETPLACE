#!/usr/bin/env node
/**
 * Mobile apps: the animated logo is the opening (splash) screen again: the logo is drawn like an engraving, then the app opens (the buyer app: Home;
 * the hub app: sign-in or the queue). There is no still start-up picture any more, so the screen uses the app's own background with the round gold
 * logo. Needs patch-logo-animation first (and replaces patch-no-splash).
 *
 *   node scripts/patch-logo-splash.js            dry run
 *   node scripts/patch-logo-splash.js --write    applies it (each changed file is saved as <file>.before-logo-splash first)
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored":[{"file":"apps/mobile/lib/app.dart","what":"buyer app: opens on the animated logo, then Home","done":"GoRoute(path: '/splash', builder: (context, state) => const SplashScreen()),","pairs":[["import 'services/api_client.dart';\nimport 'features/home/home_screen.dart';\n","import 'services/api_client.dart';\nimport 'features/splash/splash_screen.dart';\nimport 'features/home/home_screen.dart';\n"],["final GoRouter appRouter = GoRouter(\n  // The app opens straight on Home (no opening screen).\n  initialLocation: '/home',\n  routes: [\n","final GoRouter appRouter = GoRouter(\n  initialLocation: '/splash',\n  routes: [\n"],["  routes: [\n    ShellRoute(\n","  routes: [\n    GoRoute(path: '/splash', builder: (context, state) => const SplashScreen()),\n    ShellRoute(\n"]]},{"file":"apps/mobile/lib/features/splash/splash_screen.dart","what":"buyer app: the opening screen, round gold logo on the app's background","done":"math.min(constraints.maxWidth * 0.7, 320)","pairs":[["import 'dart:math' as math;\n\nimport 'package:flutter/material.dart';\nimport 'package:go_router/go_router.dart';\n\nimport '../../widgets/leap_logo_animation.dart';\n\n/// The animated opening screen: the Leap Auto Parts logo is drawn like an engraving (one steady pen draws \"L\", then \"E\", \"A\" and \"P\" as one\n/// unbroken line), \"AUTO PARTS\" glides up as the \"P\" is finished, then the (R) (widgets/leap_logo_animation.dart, the same as the website's\n/// animated logo). A short moment to see the finished logo, then Home: about 4 seconds in all.\n///\n/// It comes after the native splash (flutter_native_splash, in pubspec.yaml), which can only show a still picture: native splash (at once) ->\n/// this screen -> /home. Its background is the native splash's colour, so there is no flash between the two.\nclass SplashScreen extends StatefulWidget {\n  const SplashScreen({super.key});\n\n  @override\n  State<SplashScreen> createState() => _SplashScreenState();\n}\n\nclass _SplashScreenState extends State<SplashScreen> {\n  static const _holdFinished = Duration(milliseconds: 600);      // the finished logo stays this long before Home\n  bool _leaving = false;\n\n  void _finished() {\n    Future.delayed(_holdFinished, () {\n      if (!mounted || _leaving) return;\n      _leaving = true;\n      context.go('/home');\n    });\n  }\n\n  @override\n  Widget build(BuildContext context) {\n    return Scaffold(\n      backgroundColor: const Color(0xFFF2CA50),\n      body: Center(\n        child: LayoutBuilder(\n          builder: (context, constraints) => LeapLogoAnimation(\n            size: math.min(constraints.maxWidth * 0.86, 380),\n            showCircle: false,\n            onFinished: _finished,\n          ),\n        ),\n      ),\n    );\n  }\n}\n","import 'dart:math' as math;\n\nimport 'package:flutter/material.dart';\nimport 'package:go_router/go_router.dart';\n\nimport '../../widgets/leap_logo_animation.dart';\n\n/// The animated opening screen: the Leap Auto Parts logo is drawn like an engraving (one steady pen draws \"L\", then \"E\", \"A\" and \"P\" as one\n/// unbroken line), \"AUTO PARTS\" glides up as the \"P\" is finished, then the (R) (widgets/leap_logo_animation.dart, the same as the website's\n/// animated logo). A short moment to see the finished logo, then Home: about 4 seconds in all.\n///\n/// It is the app's only opening screen (there is no still start-up picture any more): the app opens -> this screen -> /home. It uses the app's own\n/// background (light or dark) with the round gold logo.\nclass SplashScreen extends StatefulWidget {\n  const SplashScreen({super.key});\n\n  @override\n  State<SplashScreen> createState() => _SplashScreenState();\n}\n\nclass _SplashScreenState extends State<SplashScreen> {\n  static const _holdFinished = Duration(milliseconds: 600);      // the finished logo stays this long before Home\n  bool _leaving = false;\n\n  void _finished() {\n    Future.delayed(_holdFinished, () {\n      if (!mounted || _leaving) return;\n      _leaving = true;\n      context.go('/home');\n    });\n  }\n\n  @override\n  Widget build(BuildContext context) {\n    return Scaffold(\n      body: Center(\n        child: LayoutBuilder(\n          builder: (context, constraints) => LeapLogoAnimation(\n            size: math.min(constraints.maxWidth * 0.7, 320),\n            onFinished: _finished,\n          ),\n        ),\n      ),\n    );\n  }\n}\n"]]},{"file":"apps/hub-mobile/lib/main.dart","what":"hub app: opens on the animated logo, then sign-in or the queue","done":"home: const _OpeningScreen(child: _RootScreen()),","pairs":[["import 'features/queue/queue_screen.dart';\n\n","import 'features/queue/queue_screen.dart';\nimport 'widgets/leap_logo_animation.dart';\n\n"],["        theme: buildHubTheme(),\n        home: const _RootScreen(),\n      ),\n","        theme: buildHubTheme(),\n        home: const _OpeningScreen(child: _RootScreen()),\n      ),\n    );\n  }\n}\n\n/// The opening screen: the Leap Auto Parts logo is drawn like an engraving (widgets/leap_logo_animation.dart, the same as the buyer app's and the\n/// websites'), then a short moment to see it finished, then the app (sign-in or the queue). The session is restored meanwhile, underneath.\nclass _OpeningScreen extends StatefulWidget {\n  const _OpeningScreen({required this.child});\n  final Widget child;\n\n  @override\n  State<_OpeningScreen> createState() => _OpeningScreenState();\n}\n\nclass _OpeningScreenState extends State<_OpeningScreen> {\n  bool _done = false;\n\n  void _finished() {\n    Future.delayed(const Duration(milliseconds: 600), () {\n      if (mounted) setState(() => _done = true);\n    });\n  }\n\n  @override\n  Widget build(BuildContext context) {\n    if (_done) return widget.child;\n    return Scaffold(\n      body: Center(\n        child: LayoutBuilder(\n          builder: (context, constraints) => LeapLogoAnimation(size: (constraints.maxWidth * 0.7).clamp(160.0, 340.0), onFinished: _finished),\n        ),\n      ),\n"]]}],"created":[]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-logo-splash`, c.before);
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. App: press R in the start-all window (or run start-all again). Website: Ctrl+F5.');
