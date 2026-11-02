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

/// The opening screen: the Leap Auto Parts logo is drawn like an engraving (widgets/leap_logo_animation.dart, the same as the buyer app's and the
/// websites'), then a short moment to see it finished, then the app (sign-in or the queue). The session is restored meanwhile, underneath.
class _OpeningScreen extends StatefulWidget {
  const _OpeningScreen({required this.child});
  final Widget child;

  @override
  State<_OpeningScreen> createState() => _OpeningScreenState();
}

class _OpeningScreenState extends State<_OpeningScreen> {
  bool _done = false;

  void _finished() {
    Future.delayed(const Duration(milliseconds: 600), () {
      if (mounted) setState(() => _done = true);
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_done) return widget.child;
    return Scaffold(
      body: Center(
        child: LayoutBuilder(
          builder: (context, constraints) => LeapLogoAnimation(size: (constraints.maxWidth * 0.7).clamp(160.0, 340.0), onFinished: _finished),
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

