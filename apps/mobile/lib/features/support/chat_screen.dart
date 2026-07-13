import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../core/auth_state.dart';
import '../../services/api_client.dart';

/// BUY-060/061: buyer support is Platform-only. There is no supplier
/// contact path here, by explicit business requirement — see the note in
/// services/api/src/modules/support/routes.js for the backend side of
/// this same constraint.
///
/// This screen shows the buyer's own ticket list — real data via
/// GET /support/my-tickets. Requires login: guest-created tickets aren't
/// listable without an account, same limitation as guest order history
/// (see orders_screen.dart's identical login-gate pattern).
class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  late Future<List<dynamic>> _ticketsFuture;

  @override
  void initState() {
    super.initState();
    _ticketsFuture = _load();
  }

  Future<List<dynamic>> _load() async {
    final auth = context.read<AuthState>();
    if (!auth.isLoggedIn) return [];
    return ApiClient().fetchMyTickets(auth.token!);
  }

  void _refresh() {
    setState(() => _ticketsFuture = _load());
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();

    if (!auth.isLoggedIn) {
      return Scaffold(
        appBar: AppBar(title: const Text('Leap Support')),
        body: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.support_agent_outlined, size: 40, color: LeapColors.muted),
              const SizedBox(height: 12),
              const Text(
                "Log in to message the Leap team about an order.\n(You're always talking to the Platform — never the supplier directly.)",
                textAlign: TextAlign.center,
                style: TextStyle(color: LeapColors.muted, fontSize: 13),
              ),
              const SizedBox(height: 16),
              ElevatedButton(onPressed: () => context.push('/login'), child: const Text('Log in')),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Leap Support')),
      body: Column(
        children: [
          Container(
            width: double.infinity,
            color: const Color(0xFFE9EFFC),
            padding: const EdgeInsets.all(12),
            child: const Text(
              "You're messaging the Leap team, not the supplier directly.",
              style: TextStyle(color: LeapColors.torque, fontSize: 12),
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
                  return Center(child: Text('Could not load tickets: ${snapshot.error}', style: const TextStyle(color: LeapColors.muted)));
                }
                final tickets = snapshot.data ?? [];
                if (tickets.isEmpty) {
                  return const Center(child: Text('No support tickets yet. Tap + to start one.', style: TextStyle(color: LeapColors.muted)));
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
                        subtitle: Text((t['status'] as String).replaceAll('_', ' '), style: const TextStyle(fontSize: 12)),
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
