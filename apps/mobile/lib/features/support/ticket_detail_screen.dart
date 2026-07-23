import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../core/app_strings.dart';
import '../../core/auth_state.dart';
import '../../services/api_client.dart';

/// Real message thread for one ticket — GET/POST /support/my-tickets/:id.
/// Only ever shows this buyer's own messages plus the Platform's replies —
/// never a supplier (see the backend module's header comment for why
/// that's structurally true, not just a UI choice).
///
/// REAL GAP CLOSED HERE: this screen used to silently do nothing for a
/// guest (`if (!auth.isLoggedIn) return;`, leaving the screen stuck on
/// its loading spinner forever) -- the backend's GET/POST
/// /support/my-tickets/:id* now support a real guest lookup via a
/// matching guestEmail, the same optionalAuth pattern already proven
/// for returns. A guest reaches this screen either via chat_screen.dart's
/// new "Track a ticket" entry (guestEmail passed in directly, already
/// known) or a shared link with ?guestEmail= in the URL; if neither is
/// present, shows a real inline email prompt rather than getting stuck.
class TicketDetailScreen extends StatefulWidget {
  final String ticketId;
  final String? guestEmail;
  const TicketDetailScreen({super.key, required this.ticketId, this.guestEmail});

  @override
  State<TicketDetailScreen> createState() => _TicketDetailScreenState();
}

class _TicketDetailScreenState extends State<TicketDetailScreen> {
  Map<String, dynamic>? _ticket;
  String? _errorMessage;
  bool _isLoading = true;
  bool _isSending = false;
  bool _needsEmail = false;
  String? _activeGuestEmail;
  final _replyController = TextEditingController();
  final _emailController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _activeGuestEmail = widget.guestEmail;
    _load();
  }

  @override
  void dispose() {
    _replyController.dispose();
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final auth = context.read<AuthState>();
    if (!auth.isLoggedIn && _activeGuestEmail == null) {
      setState(() { _needsEmail = true; _isLoading = false; });
      return;
    }
    setState(() { _isLoading = true; _needsEmail = false; });
    try {
      final ticket = await ApiClient().fetchTicketDetail(widget.ticketId, token: auth.token, guestEmail: _activeGuestEmail);
      setState(() {
        _ticket = ticket;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = trRead(context, 'could_not_load_ticket');
        _isLoading = false;
      });
    }
  }

  void _submitEmail() {
    if (_emailController.text.trim().isEmpty) return;
    setState(() => _activeGuestEmail = _emailController.text.trim());
    _load();
  }

  Future<void> _sendReply() async {
    if (_replyController.text.trim().isEmpty) return;
    final auth = context.read<AuthState>();
    setState(() => _isSending = true);
    try {
      await ApiClient().sendTicketMessage(widget.ticketId, _replyController.text.trim(), token: auth.token, guestEmail: _activeGuestEmail);
      _replyController.clear();
      await _load();
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _isSending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(appBar: AppBar(title: Text(tr(context, 'ticket'))), body: const Center(child: CircularProgressIndicator()));
    }
    if (_needsEmail) {
      return Scaffold(
        appBar: AppBar(title: Text(tr(context, 'ticket'))),
        body: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(tr(context, 'enter_email_to_view_ticket'), textAlign: TextAlign.center, style: const TextStyle(color: LeapColors.muted, fontSize: 13)),
              const SizedBox(height: 16),
              TextField(controller: _emailController, keyboardType: TextInputType.emailAddress, decoration: InputDecoration(labelText: tr(context, 'email_label'))),
              const SizedBox(height: 12),
              ElevatedButton(onPressed: _submitEmail, child: Text(tr(context, 'view'))),
            ],
          ),
        ),
      );
    }
    if (_errorMessage != null || _ticket == null) {
      return Scaffold(appBar: AppBar(title: Text(tr(context, 'ticket'))), body: Center(child: Text(_errorMessage ?? tr(context, 'not_found'), style: const TextStyle(color: LeapColors.muted))));
    }

    final messages = (_ticket!['messages'] as List).cast<Map<String, dynamic>>();
    return Scaffold(
      appBar: AppBar(title: Text(_ticket!['subject'] as String, maxLines: 1, overflow: TextOverflow.ellipsis)),
      body: Column(
        children: [
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: messages.length,
              itemBuilder: (context, i) {
                final m = messages[i];
                final isAdmin = m['senderRole'] == 'admin';
                return Align(
                  alignment: isAdmin ? Alignment.centerLeft : Alignment.centerRight,
                  child: Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
                    decoration: BoxDecoration(
                      color: isAdmin ? LeapColors.chalk : LeapColors.ink,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      m['message'] as String,
                      style: TextStyle(color: isAdmin ? LeapColors.ink : Colors.white, fontSize: 13),
                    ),
                  ),
                );
              },
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _replyController,
                    decoration: InputDecoration(hintText: tr(context, 'type_a_message')),
                    onSubmitted: (_) => _sendReply(),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton.filled(onPressed: _isSending ? null : _sendReply, icon: const Icon(Icons.send)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
