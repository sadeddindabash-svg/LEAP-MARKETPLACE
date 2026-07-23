import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../core/app_strings.dart';
import '../../core/auth_state.dart';
import '../../services/api_client.dart';

/// BUY-060/061: buyer support is Platform-only. There is no supplier
/// contact path here, by explicit business requirement — see the note in
/// services/api/src/modules/support/routes.js for the backend side of
/// this same constraint.
///
/// This screen shows the buyer's own ticket list — real data via
/// GET /support/my-tickets. Requires login to LIST every ticket (no
/// "list all my tickets" exists for a guest without a real account,
/// same reasoning as guest order history) -- but a guest can still
/// track ONE specific ticket by ID + email (real gap closed here,
/// mirroring the same fix already made for returns), or file a new one.
class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  late Future<List<dynamic>> _ticketsFuture;
  final _lookupIdController = TextEditingController();
  final _lookupEmailController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _ticketsFuture = _load();
  }

  @override
  void dispose() {
    _lookupIdController.dispose();
    _lookupEmailController.dispose();
    super.dispose();
  }

  Future<List<dynamic>> _load() async {
    final auth = context.read<AuthState>();
    if (!auth.isLoggedIn) return [];
    return ApiClient().fetchMyTickets(auth.token!);
  }

  void _refresh() {
    setState(() => _ticketsFuture = _load());
  }

  void _trackTicket() {
    if (_lookupIdController.text.trim().isEmpty || _lookupEmailController.text.trim().isEmpty) return;
    context.push('/support/${_lookupIdController.text.trim()}?guestEmail=${Uri.encodeQueryComponent(_lookupEmailController.text.trim())}');
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();

    if (!auth.isLoggedIn) {
      return Scaffold(
        appBar: AppBar(title: Text(tr(context, 'leap_support'))),
        body: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(tr(context, 'track_a_ticket'), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
              const SizedBox(height: 8),
              Text(tr(context, 'track_ticket_hint'), style: const TextStyle(color: LeapColors.muted, fontSize: 12.5)),
              const SizedBox(height: 16),
              TextField(controller: _lookupIdController, decoration: InputDecoration(labelText: tr(context, 'ticket_id_label'))),
              const SizedBox(height: 12),
              TextField(controller: _lookupEmailController, keyboardType: TextInputType.emailAddress, decoration: InputDecoration(labelText: tr(context, 'email_label'))),
              const SizedBox(height: 12),
              ElevatedButton(onPressed: _trackTicket, child: Text(tr(context, 'track'))),
              const SizedBox(height: 24),
              OutlinedButton(onPressed: () => context.push('/support/new'), child: Text(tr(context, 'new_support_ticket'))),
              const SizedBox(height: 16),
              Center(
                child: TextButton(onPressed: () => context.push('/login'), child: Text(tr(context, 'log_in_to_see_all_tickets'))),
              ),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: Text(tr(context, 'leap_support'))),
      body: Column(
        children: [
          Container(
            width: double.infinity,
            color: const Color(0xFFE9EFFC),
            padding: const EdgeInsets.all(12),
            child: Text(
              tr(context, 'messaging_leap_note'),
              style: const TextStyle(color: LeapColors.torque, fontSize: 12),
            ),
          ),
          Expanded(
            child: FutureBuilder<List<dynamic>>(
              future: _ticketsFuture,
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator());
                }
                if (snapshot.hasError) {
                  return Center(child: Text('${tr(context, 'could_not_load_tickets')} ${snapshot.error}', style: const TextStyle(color: LeapColors.muted)));
                }
                final tickets = snapshot.data ?? [];
                if (tickets.isEmpty) {
                  return Center(child: Text(tr(context, 'no_tickets_yet'), style: const TextStyle(color: LeapColors.muted)));
                }
                return ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: tickets.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (context, i) {
                    final t = tickets[i] as Map<String, dynamic>;
                    return Card(
                      child: ListTile(
                        title: Text(t['subject'] as String, maxLines: 1, overflow: TextOverflow.ellipsis),
                        subtitle: Text(trStatus(context, t['status'] as String), style: const TextStyle(fontSize: 12)),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () async {
                          await context.push('/support/${t['id']}');
                          _refresh();
                        },
                      ),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () async {
          await context.push('/support/new');
          _refresh();
        },
        child: const Icon(Icons.add),
      ),
    );
  }
}
