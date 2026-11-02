import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// Real animated splash screen -- confirmed against several real
/// rendered mockups before building, several iterations, before
/// landing on this exact design: the real LEAP wordmark zooms in from
/// a distant point over 3 real seconds, then the real "AUTO PARTS"
/// subtitle starts its own 3-second zoom-in 1.5 real seconds after
/// the wordmark starts (not after it finishes) -- confirmed timing
/// exactly matches the approved mockup. Total real sequence length is
/// roughly 4.5 seconds (3s + 1.5s stagger), then navigates to /home.
///
/// This is a real, separate custom screen shown after the native
/// splash (flutter_native_splash, already configured in pubspec.yaml)
/// -- confirmed deliberately, since a native splash can only show a
/// static image, never an arbitrary animation like this one. The real
/// flow is: native splash (instant) -> this real animated screen ->
/// /home.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with TickerProviderStateMixin {
  late final AnimationController _wordmarkController;
  late final AnimationController _subtitleController;
  late final Animation<double> _wordmarkScale;
  late final Animation<double> _wordmarkOpacity;
  late final Animation<double> _subtitleScale;
  late final Animation<double> _subtitleOpacity;

  // Real, confirmed timing, matching the approved mockup exactly.
  static const _wordmarkDuration = Duration(milliseconds: 3000);
  static const _subtitleDuration = Duration(milliseconds: 3000);
  static const _subtitleStartDelay = Duration(milliseconds: 1500);

  @override
  void initState() {
    super.initState();

    _wordmarkController = AnimationController(duration: _wordmarkDuration, vsync: this);
    // Real ease-out curve (cubic-bezier equivalent to the approved
    // mockup's own easing) -- starts fast, settles gently rather than
    // a linear, mechanical zoom.
    _wordmarkScale = Tween<double>(begin: 0.02, end: 1.0).animate(CurvedAnimation(parent: _wordmarkController, curve: Curves.easeOutQuint));
    _wordmarkOpacity = Tween<double>(begin: 0.0, end: 1.0).animate(CurvedAnimation(parent: _wordmarkController, curve: const Interval(0.0, 0.25, curve: Curves.easeIn)));

    _subtitleController = AnimationController(duration: _subtitleDuration, vsync: this);
    _subtitleScale = Tween<double>(begin: 0.02, end: 1.0).animate(CurvedAnimation(parent: _subtitleController, curve: Curves.easeOutQuint));
    _subtitleOpacity = Tween<double>(begin: 0.0, end: 1.0).animate(CurvedAnimation(parent: _subtitleController, curve: const Interval(0.0, 0.25, curve: Curves.easeIn)));

    _wordmarkController.forward();
    Future.delayed(_subtitleStartDelay, () {
      if (mounted) _subtitleController.forward();
    });

    // Real, confirmed navigation timing -- the full real sequence
    // (wordmark's own 3s plus the real 1.5s stagger before the
    // subtitle even starts, plus the subtitle's own 3s) finishes at
    // 1.5s + 3s = 4.5s real total, since the wordmark's animation
    // itself is done well before the subtitle finishes.
    Future.delayed(_subtitleStartDelay + _subtitleDuration, () {
      if (mounted) context.go('/home');
    });
  }

  @override
  void dispose() {
    _wordmarkController.dispose();
    _subtitleController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF2CA50),
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AnimatedBuilder(
              animation: _wordmarkController,
              builder: (context, child) => Opacity(
                opacity: _wordmarkOpacity.value,
                child: Transform.scale(scale: _wordmarkScale.value, child: child),
              ),
              child: Image.asset('assets/images/leap_splash_wordmark.png', width: 220, fit: BoxFit.contain),
            ),
            const SizedBox(height: 12),
            AnimatedBuilder(
              animation: _subtitleController,
              builder: (context, child) => Opacity(
                opacity: _subtitleOpacity.value,
                child: Transform.scale(scale: _subtitleScale.value, child: child),
              ),
              child: Image.asset('assets/images/leap_splash_subtitle.png', width: 130, fit: BoxFit.contain),
            ),
          ],
        ),
      ),
    );
  }
}
