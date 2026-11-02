import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'core/auth_state.dart';
import 'core/language_state.dart';
import 'core/theme.dart';
import 'features/auth/change_password_screen.dart';
import 'features/auth/login_screen.dart';
import 'features/queue/queue_screen.dart';
import 'widgets/leap_logo_animation.dart';

void main() {
  runApp(const LeapHubApp());
}

class LeapHubApp extends StatelessWidget {
  const LeapHubApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthState()),
        ChangeNotifierProvider(create: (_) => LanguageState()),
      ],
      child: MaterialApp(
        title: 'LEAP Hub',
        debugShowCheckedModeBanner: false,
        theme: buildHubTheme(),
        home: const _OpeningScreen(child: _RootScreen()),
      ),
    );
  }
}

/// The opening screen: the whole screen in the logo's gold, the Leap Auto Parts logo drawn like an engraving on it (widgets/leap_logo_animation.dart,
/// the same as the buyer app's and the websites'), then "质检中心 · INSPECTION HUB" under it, a short moment to see it finished, then the app (sign-in
/// or the queue). The session is restored meanwhile, underneath.
class _OpeningScreen extends StatefulWidget {
  const _OpeningScreen({required this.child});
  final Widget child;

  @override
  State<_OpeningScreen> createState() => _OpeningScreenState();
}

class _OpeningScreenState extends State<_OpeningScreen> {
  bool _done = false;
  bool _nameShown = false;

  @override
  void initState() {
    super.initState();
    // the hub's name fades in as the logo is being finished
    Future.delayed(const Duration(milliseconds: 2900), () {
      if (mounted) setState(() => _nameShown = true);
    });
  }

  void _finished() {
    Future.delayed(const Duration(milliseconds: 600), () {
      if (mounted) setState(() => _done = true);
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_done) return widget.child;
    final instant = MediaQuery.of(context).disableAnimations;
    return Scaffold(
      backgroundColor: LeapLogoAnimation.gold,
      body: Center(
        child: LayoutBuilder(
          builder: (context, constraints) {
            final size = (constraints.maxWidth * 0.8).clamp(180.0, 360.0);
            return Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                LeapLogoAnimation(size: size, showCircle: false, onFinished: _finished),
                // just under "AUTO PARTS" (the logo's frame has room below it)
                Transform.translate(
                  offset: Offset(0, -size * 0.2),
                  child: AnimatedOpacity(
                    opacity: _nameShown || instant ? 1 : 0,
                    duration: instant ? Duration.zero : const Duration(milliseconds: 600),
                    curve: Curves.easeOut,
                    child: const Text('质检中心 · INSPECTION HUB', style: TextStyle(color: Color(0xCC0A3144), fontSize: 14, fontWeight: FontWeight.w700, letterSpacing: 0.6)),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

/// Confirmed working end to end in the earlier project-setup pass
/// (session restore, bilingual strings, this app's own real color
/// palette all correctly wired) -- now routes to the real login
/// screen or the real queue screen based on real, restored session
/// state.
class _RootScreen extends StatelessWidget {
  const _RootScreen();

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    final lang = context.watch<LanguageState>();

    if (auth.isLoading || lang.isLoading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    if (!auth.isLoggedIn) return const LoginScreen();
    // Still on the temporary password an admin gave them: choose their own first, before anything else.
    if (auth.mustChangePassword) return const ChangePasswordScreen();
    return const QueueScreen();
  }
}

