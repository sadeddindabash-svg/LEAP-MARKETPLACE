import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../core/app_strings.dart';
import '../../core/auth_state.dart';
import '../../services/api_client.dart';

/// Real "change email" screen (new) -- closes a real, confirmed gap:
/// no self-service way to change your account email existed at all
/// before this, only display-only in the account menu. Requires the
/// real current password as a real security check, matching the same
/// bar as changing a password itself -- a stolen, still-logged-in
/// session alone shouldn't be enough to take over an account's own
/// email.
class ChangeEmailScreen extends StatefulWidget {
  const ChangeEmailScreen({super.key});

  @override
  State<ChangeEmailScreen> createState() => _ChangeEmailScreenState();
}

class _ChangeEmailScreenState extends State<ChangeEmailScreen> {
  final _newEmailController = TextEditingController();
  final _currentPasswordController = TextEditingController();
  bool _isSubmitting = false;
  String? _errorMessage;
  bool _obscurePassword = true;

  @override
  void dispose() {
    _newEmailController.dispose();
    _currentPasswordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final newEmail = _newEmailController.text.trim();
    final currentPassword = _currentPasswordController.text;
    if (newEmail.isEmpty || currentPassword.isEmpty) {
      setState(() => _errorMessage = trRead(context, 'please_fill_all_fields'));
      return;
    }
    // Real email format validation (new) -- same exact regex the
    // backend's own isValidEmail already uses (auth/routes.js) and the
    // same one this session's own guest-checkout fix already reused,
    // for consistency.
    if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(newEmail)) {
      setState(() => _errorMessage = trRead(context, 'please_enter_valid_email'));
      return;
    }

    setState(() { _isSubmitting = true; _errorMessage = null; });
    final auth = context.read<AuthState>();
    try {
      final result = await ApiClient().changeEmail(auth.token!, newEmail, currentPassword);
      await auth.updateSession(result['token'] as String, result['user'] as Map<String, dynamic>);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(trRead(context, 'email_changed_success'))));
        context.pop();
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _errorMessage = e.message);
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    final currentEmail = auth.user?['email'] as String? ?? '';

    return Scaffold(
      appBar: AppBar(title: Text(tr(context, 'change_email'))),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            '${tr(context, 'current_email_label')} $currentEmail',
            style: const TextStyle(color: LeapColors.muted, fontSize: 13),
          ),
          const SizedBox(height: 20),
          TextField(
            controller: _newEmailController,
            keyboardType: TextInputType.emailAddress,
            decoration: InputDecoration(labelText: tr(context, 'new_email_label'), border: const OutlineInputBorder()),
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _currentPasswordController,
            obscureText: _obscurePassword,
            decoration: InputDecoration(
              labelText: tr(context, 'current_password_label'),
              border: const OutlineInputBorder(),
              suffixIcon: IconButton(
                icon: Icon(_obscurePassword ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
              ),
            ),
          ),
          if (_errorMessage != null) ...[
            const SizedBox(height: 12),
            Text(_errorMessage!, style: const TextStyle(color: LeapColors.signal, fontSize: 12.5)),
          ],
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: _isSubmitting ? null : _submit,
            style: ElevatedButton.styleFrom(minimumSize: const Size.fromHeight(48)),
            child: _isSubmitting
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : Text(tr(context, 'save_changes')),
          ),
        ],
      ),
    );
  }
}
