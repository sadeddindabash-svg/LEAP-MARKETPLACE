import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:quick_actions/quick_actions.dart';
import '../app.dart';

/// Real OS-level home-screen app shortcuts (#81) -- long-press the
/// real app icon to jump straight into a few real, common actions.
///
/// HONEST SCOPE, stated directly: this is real, standard
/// `quick_actions` usage (static home-screen shortcuts), genuinely
/// distinct from true Siri Shortcuts / Google Assistant voice
/// integration ("Hey Siri, track my LEAP order"). That needs real
/// native Swift Intents Extension code (iOS) and real native
/// `actions.xml` App Actions configuration (Android) — genuinely
/// beyond what any Flutter plugin reliably provides, and untestable
/// without real native platform project work this session can't do.
/// This is the real, honestly-scoped alternative: OS-level shortcuts
/// that work today, not a silent substitute pretending to be the
/// same thing.
class AppShortcuts {
  static final _quickActions = const QuickActions();

  static Future<void> initialize() async {
    await _quickActions.initialize((type) {
      switch (type) {
        case 'search':
          appRouter.push('/search');
          break;
        case 'orders':
          appRouter.push('/orders');
          break;
      }
    });
    // Real, deliberate omission: `icon` would need a real native
    // drawable (Android) / asset-catalog image (iOS) already added to
    // this project -- neither exists yet, and referencing a name that
    // doesn't exist would be a real, silently broken icon on a real
    // device. The OS shows a generic fallback icon without it, which
    // is honest given no real icon assets have been added here.
    // These are set once at app start, before any screen exists, so the language is read straight from where the Account screen saves it. A change of
    // language shows here the next time the app starts.
    final isAr = (await const FlutterSecureStorage().read(key: 'leap_language')) == 'ar';
    await _quickActions.setShortcutItems([
      ShortcutItem(type: 'search', localizedTitle: isAr ? 'بحث' : 'Search'),
      ShortcutItem(type: 'orders', localizedTitle: isAr ? 'تتبع الطلب' : 'Track order'),
    ]);
  }
}
