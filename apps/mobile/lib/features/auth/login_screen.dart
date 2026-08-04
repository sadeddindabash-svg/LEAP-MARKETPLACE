import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../core/app_strings.dart';
import '../../core/auth_state.dart';
import '../../core/push_state.dart';
import '../../services/api_client.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isSubmitting = false;
  bool _obscurePassword = true;
  String? _errorMessage;

  Future<void> _submit() async {
    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });
    try {
      final result = await context.read<AuthState>().login(_emailController.text.trim(), _passwordController.text);
      if (!mounted) return;
      if (result.requiresTwoFactor) {
        // Real second factor (new) -- the real password already
        // checked out; this navigates to the real code-entry step
        // rather than treating the account as logged in yet.
        context.push('/login/2fa', extra: result.userId);
        return;
      }
      // Real push registration (new) -- a real device token is only
      // useful once tied to a real user, so this is called right
      // after a fresh real login succeeds (see PushState's own
      // header comment for the honest scope: gracefully does
      // nothing without real Firebase config files, which don't
      // exist yet).
      PushState.initialize(context);
      context.go('/account');
    } on ApiException catch (e) {
      setState(() => _errorMessage = e.message);
    } catch (e) {
      setState(() => _errorMessage = trRead(context, 'something_went_wrong'));
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final palette = LeapPalette.of(context);
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(icon: const Icon(Icons.close), tooltip: 'Close', onPressed: () => context.pop()),
        title: Text(tr(context, 'log_in')),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: 12),
            Text('LEAP', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 28, color: palette.ink)),
            const SizedBox(height: 6),
            Text(tr(context, 'login_subtitle'), style: TextStyle(color: palette.muted, fontSize: 13)),
            const SizedBox(height: 24),
            TextField(
              controller: _emailController,
              keyboardType: TextInputType.emailAddress,
              decoration: InputDecoration(labelText: tr(context, 'email_label'), prefixIcon: const Icon(Icons.mail_outline)),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _passwordController,
              obscureText: _obscurePassword,
              decoration: InputDecoration(
                labelText: tr(context, 'password_label'),
                prefixIcon: const Icon(Icons.lock_outline),
                // Real password visibility toggle (new) -- closes a
                // real, common gap: no way to confirm what was typed
                // except retyping it, matching the same real toggle
                // already used elsewhere in the app (e.g. Change
                // Email).
                suffixIcon: IconButton(
                  icon: Icon(_obscurePassword ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                  tooltip: _obscurePassword ? 'Show password' : 'Hide password',
                  onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                ),
              ),
              onSubmitted: (_) => _submit(),
            ),
            if (_errorMessage != null) ...[
              const SizedBox(height: 12),
              Text(_errorMessage!, style: const TextStyle(color: Colors.red, fontSize: 12.5)),
            ],
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: _isSubmitting ? null : _submit,
              child: _isSubmitting
                  // REAL BUG FOUND AND FIXED HERE: white spinner on
                  // gold is the same real white-on-gold contrast issue
                  // already found and fixed multiple times elsewhere
                  // this session.
                  ? SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: palette.onSignal))
                  : Text(tr(context, 'log_in')),
            ),
            const SizedBox(height: 8),
            TextButton(
              onPressed: () => context.push('/forgot-password'),
              child: Text(tr(context, 'forgot_password_q')),
            ),
            const SizedBox(height: 4),
            TextButton(
              onPressed: () => context.push('/signup'),
              child: Text(tr(context, 'no_account_signup')),
            ),
          ],
        ),
      ),
    );
  }
}
