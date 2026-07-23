import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../core/app_strings.dart';
import '../../core/auth_state.dart';
import '../../services/api_client.dart';

/// Composes a new support ticket. Works for a logged-in buyer (sends
/// their token) or a real guest (sends a real guestEmail) -- REAL GAP
/// CLOSED HERE: this screen used to only ever be reached from the
/// ticket list, which was itself login-gated, so in practice this was
/// always called with a logged-in buyer. chat_screen.dart's own
/// logged-out state now offers this screen directly too, so a real
/// guest email field appears when not logged in.
class NewTicketScreen extends StatefulWidget {
  const NewTicketScreen({super.key});

  @override
  State<NewTicketScreen> createState() => _NewTicketScreenState();
}

class _NewTicketScreenState extends State<NewTicketScreen> {
  final _subjectController = TextEditingController();
  final _messageController = TextEditingController();
  final _guestEmailController = TextEditingController();
  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  void dispose() {
    _subjectController.dispose();
    _messageController.dispose();
    _guestEmailController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final auth = context.read<AuthState>();
    if (_subjectController.text.trim().isEmpty || _messageController.text.trim().isEmpty) {
      setState(() => _errorMessage = trRead(context, 'please_fill_both_fields'));
      return;
    }
    if (!auth.isLoggedIn && _guestEmailController.text.trim().isEmpty) {
      setState(() => _errorMessage = trRead(context, 'email_required_for_guest'));
      return;
    }
    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });
    try {
      final result = await ApiClient().createTicket(
        token: auth.token,
        subject: _subjectController.text.trim(),
        message: _messageController.text.trim(),
        guestEmail: auth.isLoggedIn ? null : _guestEmailController.text.trim(),
      );
      if (!mounted) return;
      if (auth.isLoggedIn) {
        context.pop();
      } else {
        // Real, immediate hand-off for a guest -- straight to the real
        // ticket thread they just created, using the same real email
        // they just entered, rather than leaving them with no way to
        // find it again until this pass.
        context.pushReplacement('/support/${result['id']}?guestEmail=${Uri.encodeQueryComponent(_guestEmailController.text.trim())}');
      }
    } on ApiException catch (e) {
      setState(() => _errorMessage = e.message);
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    return Scaffold(
      appBar: AppBar(title: Text(tr(context, 'new_support_ticket'))),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(controller: _subjectController, decoration: InputDecoration(labelText: tr(context, 'subject_label'))),
            const SizedBox(height: 12),
            TextField(
              controller: _messageController,
              maxLines: 5,
              decoration: InputDecoration(labelText: tr(context, 'how_can_we_help'), alignLabelWithHint: true),
            ),
            if (!auth.isLoggedIn) ...[
              const SizedBox(height: 12),
              TextField(controller: _guestEmailController, keyboardType: TextInputType.emailAddress, decoration: InputDecoration(labelText: tr(context, 'email_label'))),
            ],
            if (_errorMessage != null) ...[
              const SizedBox(height: 12),
              Text(_errorMessage!, style: const TextStyle(color: Colors.red, fontSize: 12.5)),
            ],
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: _isSubmitting ? null : _submit,
              child: _isSubmitting
                  ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : Text(tr(context, 'send')),
            ),
          ],
        ),
      ),
    );
  }
}
