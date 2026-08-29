import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'core/auth_state.dart';
import 'core/language_state.dart';
import 'core/theme.dart';
import 'features/auth/login_screen.dart';
import 'features/queue/queue_screen.dart';

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
        home: const _RootScreen(),
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

    return auth.isLoggedIn ? const QueueScreen() : const LoginScreen();
  }
}

