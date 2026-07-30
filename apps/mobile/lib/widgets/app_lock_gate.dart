import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/theme.dart';
import '../core/app_lock_state.dart';

/// Real gate wrapping the whole app (new) -- shows a real lock screen
/// requiring Face ID/fingerprint (or the device's own PIN/passcode,
/// see AppLockState's own header comment for why) before revealing
/// any real screen underneath, whenever the real setting is on.
/// Re-locks automatically on every real app resume from the
/// background via WidgetsBindingObserver -- a buyer switching away
/// and back shouldn't find the app still sitting open and unlocked.
class AppLockGate extends StatefulWidget {
  final Widget child;
  const AppLockGate({super.key, required this.child});

  @override
  State<AppLockGate> createState() => _AppLockGateState();
}

class _AppLockGateState extends State<AppLockGate> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused || state == AppLifecycleState.inactive) {
      // Real re-lock on real backgrounding (new) -- deliberately on
      // paused/inactive (leaving), not just checking on resume, so a
      // buyer can't glimpse the real, still-unlocked app in a real
      // app-switcher preview before re-authenticating.
      context.read<AppLockState>().relock();
    }
  }

  @override
  Widget build(BuildContext context) {
    final lockState = context.watch<AppLockState>();
    if (!lockState.isReady) {
      // Real, brief initial check (isDeviceSupported/reading the real
      // stored setting) -- genuinely near-instant on every real
      // platform, this only ever flashes for a moment.
      return const _BlankSplash();
    }
    if (lockState.isLocked) {
      return _LockScreen(onUnlock: () => lockState.unlock());
    }
    return widget.child;
  }
}

class _BlankSplash extends StatelessWidget {
  const _BlankSplash();

  @override
  Widget build(BuildContext context) {
    return const ColoredBox(color: Colors.white, child: SizedBox.expand());
  }
}

class _LockScreen extends StatelessWidget {
  final VoidCallback onUnlock;
  const _LockScreen({required this.onUnlock});

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
                  child: const Icon(Icons.lock_outline, size: 40, color: LeapColors.signal),
                ),
                const SizedBox(height: 24),
                Text(isAr ? 'التطبيق مقفل' : 'Leap is locked', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                const SizedBox(height: 8),
                Text(
                  isAr
                      ? 'افتح القفل باستخدام بصمة الوجه أو الإصبع أو رمز مرور جهازك.'
                      : 'Unlock with Face ID, fingerprint, or your device passcode.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 13, color: LeapColors.muted),
                ),
                const SizedBox(height: 24),
                ElevatedButton.icon(
                  onPressed: onUnlock,
                  icon: const Icon(Icons.fingerprint),
                  label: Text(isAr ? 'فتح القفل' : 'Unlock'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
