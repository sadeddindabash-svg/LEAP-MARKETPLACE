import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/auth_state.dart';
import '../../core/language_state.dart';
import '../../core/hub_strings.dart';
import '../../core/theme.dart';
import '../../services/api_client.dart';

/// Faithful port of apps/hub-portal/src/LoginPage.jsx's own real
/// behavior: email/password, a real language-toggle button matching
/// the web app's own exact placement (top-right of the card), and the
/// exact same real role-rejection copy shown when a real, valid login
/// succeeds for an account that isn't hub_staff.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isSubmitting = false;
  String? _error;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    if (_emailController.text.trim().isEmpty || _passwordController.text.isEmpty) return;
    setState(() {
      _error = null;
      _isSubmitting = true;
    });
    final auth = context.read<AuthState>();
    final t = kHubStrings[context.read<LanguageState>().language]!;
    try {
      final success = await auth.login(_emailController.text.trim(), _passwordController.text);
      if (!mounted) return;
      if (!success) {
        setState(() {
          _error = t.login.noAccess;
          _isSubmitting = false;
        });
      }
      // On success, AuthState.notifyListeners() already fired -- the
      // real root widget's own auth.watch rebuilds to the queue
      // screen automatically. Nothing further to do here.
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _isSubmitting = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final lang = context.watch<LanguageState>();
    final t = kHubStrings[lang.language]!;

    return Scaffold(
      backgroundColor: HubColors.canvas,
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Container(
            width: 360,
            padding: const EdgeInsets.all(32),
            decoration: BoxDecoration(
              color: HubColors.card,
              border: Border.all(color: HubColors.line),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 34,
                            height: 34,
                            decoration: BoxDecoration(color: HubColors.signal, borderRadius: BorderRadius.circular(9)),
                            child: const Icon(Icons.inventory_2_outlined, color: Colors.white, size: 18),
                          ),
                          const SizedBox(width: 10),
                          Text(t.appName, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: HubColors.ink)),
                        ],
                      ),
                      OutlinedButton(
                        onPressed: () => lang.toggle(),
                        style: OutlinedButton.styleFrom(
                          side: const BorderSide(color: HubColors.line),
                          foregroundColor: HubColors.muted,
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          minimumSize: Size.zero,
                        ),
                        child: Text(lang.isChinese ? 'EN' : '中文', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Padding(
                    padding: const EdgeInsets.only(bottom: 24),
                    child: Text(t.login.subtitle, style: const TextStyle(fontSize: 13, color: HubColors.muted)),
                  ),
                  Text(t.login.email, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: HubColors.muted)),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _emailController,
                    keyboardType: TextInputType.emailAddress,
                    autofillHints: const [AutofillHints.email],
                  ),
                  const SizedBox(height: 16),
                  Text(t.login.password, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: HubColors.muted)),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _passwordController,
                    obscureText: true,
                    autofillHints: const [AutofillHints.password],
                    onSubmitted: (_) => _handleSubmit(),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 9),
                      decoration: BoxDecoration(color: HubColors.redBg, borderRadius: BorderRadius.circular(8)),
                      child: Text(_error!, style: const TextStyle(fontSize: 12.5, color: HubColors.red)),
                    ),
                  ],
                  const SizedBox(height: 8),
                  ElevatedButton(
                    onPressed: _isSubmitting ? null : _handleSubmit,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: _isSubmitting ? const Color(0xFFD1D5DB) : HubColors.signal,
                    ),
                    child: Text(_isSubmitting ? t.login.signingIn : t.login.signIn),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    t.login.restricted,
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 11.5, color: HubColors.muted),
                  ),
                ],
              ),
            ),
          ),
        ),
    );
  }
}
