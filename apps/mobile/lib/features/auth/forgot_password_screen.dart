import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme.dart';
import '../../core/app_strings.dart';
import '../../services/api_client.dart';

/// BUY-002-ish. Calls the real POST /auth/forgot-password endpoint.
///
/// HONEST LIMITATION, shown in the UI itself rather than hidden: no email
/// provider is connected in this backend yet, so the reset link isn't
/// actually delivered anywhere a real end user would see it — it's
/// logged to the SERVER's own console as a stand-in (see that endpoint's
/// header comment). This screen tells the person that directly and
/// offers a "I have a reset code" link so a developer/tester can paste
/// the token manually during development, rather than pretending email
/// delivery works when it doesn't.
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
                style: const TextStyle(color: LeapColors.muted, fontSize: 13),
              ),
              const SizedBox(height: 20),
              TextField(
                controller: _emailController,
                keyboardType: TextInputType.emailAddress,
                decoration: InputDecoration(labelText: tr(context, 'email_label')),
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
                    ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : Text(tr(context, 'send_reset_link')),
              ),
            ] else ...[
              const Icon(Icons.mark_email_read_outlined, size: 40, color: LeapColors.muted),
              const SizedBox(height: 12),
              Text(
                tr(context, 'if_email_registered'),
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: LeapColors.chalk, borderRadius: BorderRadius.circular(8)),
                child: Text(
                  tr(context, 'dev_note_email'),
                  style: const TextStyle(fontSize: 11.5, color: LeapColors.muted),
                ),
              ),
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
