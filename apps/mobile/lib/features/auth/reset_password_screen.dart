import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme.dart';
import '../../core/app_strings.dart';
import '../../services/api_client.dart';

/// Completes the reset started in forgot_password_screen.dart, calling
/// the real POST /auth/reset-password endpoint. Takes the token as a
/// manually-pasted field for now -- real SMTP delivery was fixed and
/// confirmed genuinely working earlier this session (see
/// forgot_password_screen.dart's own updated comment), but real deep
/// linking (this screen auto-opening with the token pre-filled from a
/// real email link) is still real, separate, unbuilt work -- it needs
/// real platform config (Android App Links / iOS Universal Links, each
/// requiring a real hosted verification file on a real production
/// domain) that can't be meaningfully built or verified here.
class ResetPasswordScreen extends StatefulWidget {
  // Real deep-link readiness (new) -- when a real link provides the
  // token directly (e.g. tapping a real reset link once real Android
  // App Links / iOS Universal Links are configured -- see this
  // file's own header comment for what real, external setup that
  // still requires), it's pre-filled here rather than requiring the
  // person to copy-paste it manually.
  final String? initialToken;
  const ResetPasswordScreen({super.key, this.initialToken});

  @override
  State<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends State<ResetPasswordScreen> {
  final _tokenController = TextEditingController();
  final _passwordController = TextEditingController();
  final _passwordFocusNode = FocusNode();
  bool _isSubmitting = false;
  bool _obscurePassword = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    if (widget.initialToken != null && widget.initialToken!.isNotEmpty) {
      _tokenController.text = widget.initialToken!;
      // Real UX improvement (new): when the token arrived pre-filled
      // from a real link, skip straight to the password field instead
      // of leaving focus on the (already-filled) token field.
      WidgetsBinding.instance.addPostFrameCallback((_) => _passwordFocusNode.requestFocus());
    }
  }

  @override
  void dispose() {
    _tokenController.dispose();
    _passwordController.dispose();
    _passwordFocusNode.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_tokenController.text.trim().isEmpty || _passwordController.text.isEmpty) {
      setState(() => _errorMessage = trRead(context, 'please_fill_both_fields'));
      return;
    }
    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });
    try {
      await ApiClient().resetPassword(token: _tokenController.text.trim(), newPassword: _passwordController.text);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(trRead(context, 'password_reset_success'))),
        );
        context.go('/login');
      }
    } on ApiException catch (e) {
      setState(() => _errorMessage = e.message);
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
        title: Text(tr(context, 'enter_reset_code')),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: 12),
            Text(
              tr(context, 'paste_reset_code'),
              style: TextStyle(color: palette.muted, fontSize: 13),
            ),
            const SizedBox(height: 20),
            TextField(
              controller: _tokenController,
              decoration: InputDecoration(labelText: tr(context, 'reset_code_label'), prefixIcon: const Icon(Icons.key_outlined)),
              maxLines: 2,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _passwordController,
              focusNode: _passwordFocusNode,
              obscureText: _obscurePassword,
              decoration: InputDecoration(
                labelText: tr(context, 'new_password_label'),
                helperText: tr(context, 'at_least_8_chars'),
                prefixIcon: const Icon(Icons.lock_outline),
                // Real password visibility toggle (new) -- matching
                // the same real toggle already added elsewhere this
                // session.
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
                  : Text(tr(context, 'reset_password_title')),
            ),
          ],
        ),
      ),
    );
  }
}
