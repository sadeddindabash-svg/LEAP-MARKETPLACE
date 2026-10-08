import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/auth_state.dart';
import '../../core/hub_strings.dart';
import '../../core/language_state.dart';
import '../../core/theme.dart';
import '../../services/api_client.dart';

/// Shown INSTEAD of the queue while the worker is still on the temporary password an admin gave them (same rules and wording as the web hub portal's
/// "choose your own password" page). The server also reports this on every login, so it cannot be skipped by reopening the app.
class ChangePasswordScreen extends StatefulWidget {
  const ChangePasswordScreen({super.key});

  @override
  State<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends State<ChangePasswordScreen> {
  final _currentController = TextEditingController();
  final _newController = TextEditingController();
  final _confirmController = TextEditingController();
  bool _isSaving = false;
  String? _error;

  @override
  void dispose() {
    _currentController.dispose();
    _newController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final t = kHubStrings[context.read<LanguageState>().language]!.changePassword;
    // Checked here first (the same three rules the portal checks), so an obvious mistake is explained at once; the server checks them again.
    if (_newController.text.length < 8) {
      setState(() => _error = t.tooShort);
      return;
    }
    if (_newController.text != _confirmController.text) {
      setState(() => _error = t.mismatch);
      return;
    }
    if (_newController.text == _currentController.text) {
      setState(() => _error = t.same);
      return;
    }
    setState(() {
      _isSaving = true;
      _error = null;
    });
    final auth = context.read<AuthState>();
    try {
      await ApiClient().changeMyPassword(auth.token!, _currentController.text, _newController.text);
      auth.markPasswordChanged(); // the queue opens
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = kHubStrings[context.watch<LanguageState>().language]!;
    final t = text.changePassword;
    return Scaffold(
      appBar: AppBar(
        title: Text(text.appName, style: const TextStyle(fontWeight: FontWeight.w800)),
        actions: [
          TextButton(onPressed: () => context.read<AuthState>().logout(), child: Text(text.logout)),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          Text(t.title, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: HubColors.ink)),
          const SizedBox(height: 8),
          Text(t.intro, style: const TextStyle(fontSize: 13.5, color: HubColors.muted)),
          const SizedBox(height: 24),
          TextField(controller: _currentController, obscureText: true, decoration: InputDecoration(labelText: t.current)),
          const SizedBox(height: 14),
          TextField(controller: _newController, obscureText: true, decoration: InputDecoration(labelText: t.newPassword)),
          const SizedBox(height: 14),
          TextField(controller: _confirmController, obscureText: true, decoration: InputDecoration(labelText: t.confirm)),
          if (_error != null) ...[
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: HubColors.redBg, borderRadius: BorderRadius.circular(8)),
              child: Text(_error!, style: const TextStyle(fontSize: 12.5, color: HubColors.red)),
            ),
          ],
          const SizedBox(height: 20),
          ElevatedButton(onPressed: _isSaving ? null : _submit, child: Text(_isSaving ? t.saving : t.submit)),
        ],
      ),
    );
  }
}
