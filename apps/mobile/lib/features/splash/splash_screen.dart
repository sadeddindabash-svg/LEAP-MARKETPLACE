import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../widgets/leap_logo_animation.dart';

/// The animated opening screen: the Leap Auto Parts logo is drawn like an engraving (one steady pen draws "L", then "E", "A" and "P" as one
/// unbroken line), "AUTO PARTS" glides up as the "P" is finished, then the (R) (widgets/leap_logo_animation.dart, the same as the website's
/// animated logo). A short moment to see the finished logo, then Home: about 4 seconds in all.
///
/// It comes after the native splash (flutter_native_splash, in pubspec.yaml), which can only show a still picture: native splash (at once) ->
/// this screen -> /home. Its background is the native splash's colour, so there is no flash between the two.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  static const _holdFinished = Duration(milliseconds: 600);      // the finished logo stays this long before Home
  bool _leaving = false;

  void _finished() {
    Future.delayed(_holdFinished, () {
      if (!mounted || _leaving) return;
      _leaving = true;
      context.go('/home');
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF2CA50),
      body: Center(
        child: LayoutBuilder(
          builder: (context, constraints) => LeapLogoAnimation(
            size: math.min(constraints.maxWidth * 0.86, 380),
            showCircle: false,
            onFinished: _finished,
          ),
        ),
      ),
    );
  }
}
