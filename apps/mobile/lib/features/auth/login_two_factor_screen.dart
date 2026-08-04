import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../core/app_strings.dart';
import '../../core/auth_state.dart';
import '../../core/push_state.dart';
import '../../services/api_client.dart';

/// Real second step of login (new) -- reached only after
/// login_screen.dart's own real password check already succeeded and
/// the backend signaled requiresTwoFactor. Takes a real, current
/// 6-digit code from the person's own authenticator app.
class LoginTwoFactorScreen extends StatefulWidget {
  final String userId;
  const LoginTwoFactorScreen({super.key, required this.userId});

  @override
  State<LoginTwoFactorScreen> createState() => _LoginTwoFactorScreenState();
}

class _LoginTwoFactorScreenState extends State<LoginTwoFactorScreen> {
  final _codeController = TextEditingController();
  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_codeController.text.trim().isEmpty) return;
    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });
    try {
      await context.read<AuthState>().verifyTwoFactorLogin(widget.userId, _codeController.text.trim());
      if (mounted) {
        PushState.initialize(context);
        context.go('/account');
      }
    } on ApiException catch (e) {
      setState(() => _errorMessage = e.message);
    } catch (e) {
      setState(() => _errorMessage = trRead(context, 'something_went_wrong'));
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = LeapPalette.of(context);
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(icon: const Icon(Icons.close), tooltip: 'Close', onPressed: () => context.pop()),
        title: const Text('Two-factor authentication'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: 12),
            Icon(Icons.shield_outlined, size: 40, color: palette.signal),
            const SizedBox(height: 16),
            Text(
              'Enter the 6-digit code from your authenticator app.',
              style: TextStyle(color: palette.muted, fontSize: 13),
            ),
            const SizedBox(height: 20),
            TextField(
              controller: _codeController,
              keyboardType: TextInputType.number,
              maxLength: 6,
              autofocus: true,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800, letterSpacing: 4),
              decoration: const InputDecoration(counterText: ''),
              onSubmitted: (_) => _submit(),
            ),
            if (_errorMessage != null) ...[
              const SizedBox(height: 12),
              Text(_errorMessage!, style: const TextStyle(color: Colors.red, fontSize: 12.5), textAlign: TextAlign.center),
            ],
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: _isSubmitting ? null : _submit,
              child: _isSubmitting
                  ? SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: palette.onSignal))
                  : const Text('Verify'),
            ),
          ],
        ),
      ),
    );
  }
}
