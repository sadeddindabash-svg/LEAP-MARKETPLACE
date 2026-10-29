import 'dart:async';
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
///
/// Real auto-refresh (new) -- mirrors the exact same proven pattern
/// already built for tracking_screen.dart: a buyer previously had to
/// manually leave and re-enter this screen (or use pull-to-refresh) to
/// see whether an admin had replied yet. Polls every 20s while this
/// screen is on-screen. Silent -- a background poll never flashes the
/// full-screen loading spinner, only the very first load does.
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
  Timer? _pollTimer;
  final _replyController = TextEditingController();
  final _emailController = TextEditingController();
  // Real ticket-helpfulness feedback (#100) -- tracks whether this
  // real session has already submitted feedback, so the prompt
  // disappears immediately after answering rather than staying
  // visible until the next real poll refresh.
  bool _feedbackJustSubmitted = false;
  bool _isSubmittingFeedback = false;

  static const _pollInterval = Duration(seconds: 20);

  @override
  void initState() {
    super.initState();
    _activeGuestEmail = widget.guestEmail;
    _load(showSpinner: true);
    _pollTimer = Timer.periodic(_pollInterval, (_) => _load(showSpinner: false));
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _replyController.dispose();
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _load({required bool showSpinner}) async {
    final auth = context.read<AuthState>();
    if (!auth.isLoggedIn && _activeGuestEmail == null) {
      if (mounted) setState(() { _needsEmail = true; _isLoading = false; });
      return;
    }
    if (showSpinner && mounted) setState(() { _isLoading = true; _needsEmail = false; });
    try {
      final ticket = await ApiClient().fetchTicketDetail(widget.ticketId, token: auth.token, guestEmail: _activeGuestEmail);
      if (mounted) {
        setState(() {
          _ticket = ticket;
          _isLoading = false;
        });
      }
    } catch (e) {
      // A silent background poll failing shouldn't blank out an
      // already-loaded thread with an error message -- only a real,
      // user-initiated load (the very first one, or after submitting
      // an email) should ever show one.
      if (showSpinner && mounted) {
        setState(() {
          _errorMessage = trRead(context, 'could_not_load_ticket');
          _isLoading = false;
        });
      }
    }
  }

  void _submitEmail() {
    if (_emailController.text.trim().isEmpty) return;
    setState(() => _activeGuestEmail = _emailController.text.trim());
    _load(showSpinner: true);
  }

  Future<void> _sendReply() async {
    if (_replyController.text.trim().isEmpty) return;
    final auth = context.read<AuthState>();
    setState(() => _isSending = true);
    try {
      await ApiClient().sendTicketMessage(widget.ticketId, _replyController.text.trim(), token: auth.token, guestEmail: _activeGuestEmail);
      _replyController.clear();
      await _load(showSpinner: false);
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _isSending = false);
    }
  }

  Future<void> _submitFeedback(bool helpful) async {
    final auth = context.read<AuthState>();
    setState(() => _isSubmittingFeedback = true);
    try {
      await ApiClient().submitTicketFeedback(widget.ticketId, helpful, token: auth.token, guestEmail: _activeGuestEmail);
      if (mounted) {
        setState(() => _feedbackJustSubmitted = true);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(tr(context, 'thanks_for_feedback'))));
      }
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _isSubmittingFeedback = false);
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
              Text(tr(context, 'enter_email_to_view_ticket'), textAlign: TextAlign.center, style: TextStyle(color: LeapPalette.of(context).muted, fontSize: 13)),
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
      return Scaffold(appBar: AppBar(title: Text(tr(context, 'ticket'))), body: Center(child: Text(_errorMessage ?? tr(context, 'not_found'), style: TextStyle(color: LeapPalette.of(context).muted))));
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
                      color: isAdmin ? LeapPalette.of(context).chalk : LeapPalette.of(context).signal,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      m['message'] as String,
                      style: TextStyle(color: isAdmin ? LeapPalette.of(context).ink : LeapPalette.of(context).onSignal, fontSize: 13),
                    ),
                  ),
                );
              },
            ),
          ),
          // Real ticket-helpfulness feedback prompt (#100) -- only
          // shown when this real ticket has genuinely reached
          // resolved/closed status, and hasn't already received real
          // feedback (checked against the real resolutionHelpful
          // field from the backend, or this session's own real,
          // just-submitted state).
          if (!_feedbackJustSubmitted &&
              _ticket!['resolutionHelpful'] == null &&
              ['resolved', 'closed'].contains(_ticket!['status']))
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              color: LeapPalette.of(context).chalk,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(tr(context, 'was_this_resolution_helpful'), style: TextStyle(fontWeight: FontWeight.w600, color: LeapPalette.of(context).ink)),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      OutlinedButton.icon(
                        onPressed: _isSubmittingFeedback ? null : () => _submitFeedback(true),
                        icon: const Icon(Icons.thumb_up_outlined, size: 16),
                        label: Text(tr(context, 'yes')),
                      ),
                      const SizedBox(width: 8),
                      OutlinedButton.icon(
                        onPressed: _isSubmittingFeedback ? null : () => _submitFeedback(false),
                        icon: const Icon(Icons.thumb_down_outlined, size: 16),
                        label: Text(tr(context, 'no')),
                      ),
                    ],
                  ),
                ],
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
