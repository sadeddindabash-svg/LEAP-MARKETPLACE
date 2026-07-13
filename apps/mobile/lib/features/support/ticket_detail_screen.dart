import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../core/auth_state.dart';
import '../../services/api_client.dart';

/// Real message thread for one ticket — GET/POST /support/my-tickets/:id.
/// Only ever shows this buyer's own messages plus the Platform's replies —
/// never a supplier (see the backend module's header comment for why
/// that's structurally true, not just a UI choice).
class TicketDetailScreen extends StatefulWidget {
  final String ticketId;
  const TicketDetailScreen({super.key, required this.ticketId});

  @override
  State<TicketDetailScreen> createState() => _TicketDetailScreenState();
}

class _TicketDetailScreenState extends State<TicketDetailScreen> {
  Map<String, dynamic>? _ticket;
  String? _errorMessage;
  bool _isLoading = true;
  bool _isSending = false;
  final _replyController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _replyController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final auth = context.read<AuthState>();
    if (!auth.isLoggedIn) return;
    setState(() => _isLoading = true);
    try {
      final ticket = await ApiClient().fetchTicketDetail(auth.token!, widget.ticketId);
      setState(() {
        _ticket = ticket;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = 'Could not load this ticket.';
        _isLoading = false;
      });
    }
  }

  Future<void> _sendReply() async {
    if (_replyController.text.trim().isEmpty) return;
    final auth = context.read<AuthState>();
    setState(() => _isSending = true);
    try {
      await ApiClient().sendTicketMessage(auth.token!, widget.ticketId, _replyController.text.trim());
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
      return Scaffold(appBar: AppBar(title: const Text('Ticket')), body: const Center(child: CircularProgressIndicator()));
    }
    if (_errorMessage != null || _ticket == null) {
      return Scaffold(appBar: AppBar(title: const Text('Ticket')), body: Center(child: Text(_errorMessage ?? 'Not found', style: const TextStyle(color: LeapColors.muted))));
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
                    decoration: const InputDecoration(hintText: 'Type a message…'),
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
