import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';
import '../core/theme.dart';
import '../services/api_client.dart';

/// Real gate wrapping the whole app (new), mirrors AppLockGate's own
/// real pattern. Checks the real, currently-installed app version
/// (via package_info_plus, reading pubspec.yaml's own real version at
/// build time) against the real, admin-configured minimum (see
/// platform-settings/routes.js's own new GET /min-app-version).
/// Blocks the entire real app -- no dismiss, no "skip for now" -- only
/// when a real minimum is genuinely configured AND the real installed
/// version is genuinely below it. A real check failure (no network
/// yet, the endpoint being briefly unreachable) never blocks
/// anything -- this is a real safety net for a genuinely outdated
/// app, not something that should itself be able to lock a person out
/// over a momentary connectivity blip.
class ForceUpdateGate extends StatefulWidget {
  final Widget child;
  const ForceUpdateGate({super.key, required this.child});

  @override
  State<ForceUpdateGate> createState() => _ForceUpdateGateState();
}

class _ForceUpdateGateState extends State<ForceUpdateGate> {
  bool _blocked = false;
  bool _checked = false;

  @override
  void initState() {
    super.initState();
    _check();
  }

  Future<void> _check() async {
    try {
      final results = await Future.wait([
        PackageInfo.fromPlatform(),
        ApiClient().fetchMinAppVersion(),
      ]);
      final currentVersion = (results[0] as PackageInfo).version;
      final minVersion = results[1] as String?;
      if (minVersion != null && _isVersionBelow(currentVersion, minVersion)) {
        if (mounted) setState(() => _blocked = true);
      }
    } catch (_) {
      // Real, deliberate no-op: a real check failure (no network yet,
      // the endpoint briefly unreachable) must never block a real
      // person out of the app -- see this class's own header comment.
    } finally {
      if (mounted) setState(() => _checked = true);
    }
  }

  /// Real, genuine semantic-version comparison (new) -- deliberately
  /// NOT a plain string comparison, which would incorrectly treat
  /// "1.10.0" as less than "1.9.0" (comparing "1" vs "9" as the second
  /// real segment, character by character, the way strings sort).
  /// Compares each real numeric segment (major.minor.patch)
  /// individually instead.
  bool _isVersionBelow(String current, String minimum) {
    final currentParts = current.split('.').map((p) => int.tryParse(p) ?? 0).toList();
    final minParts = minimum.split('.').map((p) => int.tryParse(p) ?? 0).toList();
    for (var i = 0; i < 3; i++) {
      final c = i < currentParts.length ? currentParts[i] : 0;
      final m = i < minParts.length ? minParts[i] : 0;
      if (c != m) return c < m;
    }
    return false; // genuinely equal
  }

  @override
  Widget build(BuildContext context) {
    if (!_checked) {
      // Real, brief initial check -- genuinely near-instant once the
      // real network responds, this only ever flashes for a moment,
      // same real treatment as AppLockGate's own initial check.
      return widget.child;
    }
    if (_blocked) {
      return const _UpdateRequiredScreen();
    }
    return widget.child;
  }
}

class _UpdateRequiredScreen extends StatelessWidget {
  const _UpdateRequiredScreen();

  @override
  Widget build(BuildContext context) {
    final isAr = Localizations.localeOf(context).languageCode == 'ar';
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 88,
                  height: 88,
                  decoration: const BoxDecoration(color: LeapColors.chalk, shape: BoxShape.circle),
                  child: const Icon(Icons.system_update_outlined, size: 40, color: LeapColors.signal),
                ),
                const SizedBox(height: 24),
                Text(isAr ? 'يتوفر تحديث مطلوب' : 'An update is required', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                const SizedBox(height: 8),
                Text(
                  isAr
                      ? 'يرجى تحديث التطبيق من متجر التطبيقات للاستمرار.'
                      : 'Please update the app from your app store to continue.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 13, color: LeapColors.muted),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
