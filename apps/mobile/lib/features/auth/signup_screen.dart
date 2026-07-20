import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../core/app_strings.dart';
import '../../core/auth_state.dart';
import '../../services/api_client.dart';

class SignupScreen extends StatefulWidget {
  // Real pre-fill for the guest-to-account conversion flow (migration
  // 029) -- when set, this is the exact real guest email a just-placed
  // order used, since signing up with that exact same email is what
  // genuinely links it. Null for a normal, unrelated signup.
  final String? prefillEmail;
  const SignupScreen({super.key, this.prefillEmail});

  @override
  State<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends State<SignupScreen> {
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _referralCodeController = TextEditingController();
  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    if (widget.prefillEmail != null) {
      _emailController.text = widget.prefillEmail!;
    }
  }

  Future<void> _submit() async {
    if (_passwordController.text.length < 8) {
      setState(() => _errorMessage = trRead(context, 'password_too_short'));
      return;
    }
    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });
    try {
      final linkedOrderCount = await context.read<AuthState>().signup(
            _emailController.text.trim(),
            _passwordController.text,
            name: _nameController.text.trim().isEmpty ? null : _nameController.text.trim(),
            referralCode: _referralCodeController.text.trim().isEmpty ? null : _referralCodeController.text.trim(),
          );
      if (mounted) {
        // Real guest-to-account conversion confirmation (migration 029)
        // -- only shown when a real prior guest order under this exact
        // email genuinely got linked, never a generic message.
        //
        // REAL BUG FOUND AND FIXED HERE: this originally used a
        // SnackBar, shown immediately before navigating to '/account'
        // right after -- but context.go() REPLACES the navigation
        // stack, disposing the Scaffold the SnackBar was attached to
        // almost instantly, so it never actually stayed visible long
        // enough to read. A real dialog blocks until the person
        // dismisses it themselves, so it can never be silently
        // destroyed by the navigation that follows.
        if (linkedOrderCount > 0) {
          final isAr = Localizations.localeOf(context).languageCode == 'ar';
          await showDialog<void>(
            context: context,
            builder: (dialogContext) => AlertDialog(
              title: Text(isAr ? 'مرحبًا بك' : 'Welcome'),
              content: Text(isAr
                  ? (linkedOrderCount == 1 ? 'تم ربط طلب سابق بحسابك.' : 'تم ربط $linkedOrderCount طلبات سابقة بحسابك.')
                  : (linkedOrderCount == 1 ? 'A previous order was linked to your account.' : '$linkedOrderCount previous orders were linked to your account.')),
              actions: [FilledButton(onPressed: () => Navigator.of(dialogContext).pop(), child: Text(isAr ? 'حسنًا' : 'OK'))],
            ),
          );
        }
        if (mounted) context.go('/account');
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
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _referralCodeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(icon: const Icon(Icons.close), onPressed: () => context.pop()),
        title: Text(tr(context, 'create_account')),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: 12),
            const Text('LEAP', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 28, color: LeapColors.ink)),
            const SizedBox(height: 6),
            Text(tr(context, 'signup_subtitle'), style: const TextStyle(color: LeapColors.muted, fontSize: 13)),
            const SizedBox(height: 24),
            TextField(controller: _nameController, decoration: InputDecoration(labelText: tr(context, 'name_optional'))),
            const SizedBox(height: 12),
            TextField(
              controller: _emailController,
              keyboardType: TextInputType.emailAddress,
              decoration: InputDecoration(labelText: tr(context, 'email_label')),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _passwordController,
              obscureText: true,
              decoration: InputDecoration(labelText: tr(context, 'password_label'), helperText: tr(context, 'at_least_8_chars')),
              onSubmitted: (_) => _submit(),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _referralCodeController,
              textCapitalization: TextCapitalization.characters,
              decoration: InputDecoration(labelText: tr(context, 'referral_code_optional')),
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
                  : Text(tr(context, 'create_account')),
            ),
            const SizedBox(height: 12),
            TextButton(
              onPressed: () => context.pop(),
              child: Text(tr(context, 'already_have_account')),
            ),
          ],
        ),
      ),
    );
  }
}
