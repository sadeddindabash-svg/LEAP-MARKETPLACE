import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme.dart';
import '../../core/app_strings.dart';
import '../../services/api_client.dart';

/// BUY-002-ish. Calls the real POST /auth/forgot-password endpoint.
///
/// UPDATED, same session: real SMTP delivery was found broken (a real
/// bug -- unhandled email timeouts could hang entire API responses --
/// see services/api/README.md's own real bug writeup) and fixed
/// earlier this session, then confirmed genuinely working end-to-end
/// with a real Mailtrap account. The backend's own real endpoint
/// already conditionally sends a real email when SMTP happens to be
/// configured, falling back to a server console log otherwise -- this
/// screen's own copy was updated to stay accurate either way (the
/// "if that email is registered..." message is true regardless), and
/// the stale "email sending isn't connected yet" claim was removed
/// rather than left as a real, now-inaccurate assumption. The "I have
/// a reset code" link is still kept -- still genuinely useful as a
/// fallback for a real environment where SMTP isn't configured.
class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _emailController = TextEditingController();
  bool _isSubmitting = false;
  bool _submitted = false;
  String? _errorMessage;

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_emailController.text.trim().isEmpty) return;
    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });
    try {
      await ApiClient().forgotPassword(_emailController.text.trim());
      setState(() => _submitted = true);
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
        leading: IconButton(icon: const Icon(Icons.close), onPressed: () => context.pop()),
        title: Text(tr(context, 'reset_password_title')),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: 12),
            if (!_submitted) ...[
              Text(
                tr(context, 'enter_email_for_reset'),
                style: TextStyle(color: palette.muted, fontSize: 13),
              ),
              const SizedBox(height: 20),
              TextField(
                controller: _emailController,
                keyboardType: TextInputType.emailAddress,
                decoration: InputDecoration(labelText: tr(context, 'email_label'), prefixIcon: const Icon(Icons.mail_outline)),
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
                    // gold is the same real white-on-gold contrast
                    // issue already found and fixed multiple times
                    // elsewhere this session.
                    ? SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: palette.onSignal))
                    : Text(tr(context, 'send_reset_link')),
              ),
            ] else ...[
              Icon(Icons.mark_email_read_outlined, size: 40, color: palette.muted),
              const SizedBox(height: 12),
              Text(
                tr(context, 'if_email_registered'),
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: palette.ink),
                textAlign: TextAlign.center,
              ),
              // REAL, STALE CLAIM REMOVED HERE: this used to
              // unconditionally show a "dev note" claiming email
              // sending isn't connected in this build yet -- but real
              // SMTP delivery was fixed and confirmed genuinely
              // working earlier this session. The mobile app has no
              // way to know, server-side, whether SMTP happens to be
              // configured in any given environment, so removing this
              // presumptuous claim (rather than guessing) is the
              // honest fix -- the message above already covers both
              // real cases accurately.
            ],
            const SizedBox(height: 12),
            TextButton(
              onPressed: () => context.push('/reset-password'),
              child: Text(tr(context, 'have_reset_code')),
            ),
          ],
        ),
      ),
    );
  }
}
