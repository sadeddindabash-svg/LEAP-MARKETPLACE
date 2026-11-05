import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../core/app_strings.dart';
import '../../core/auth_state.dart';
import '../../services/api_client.dart';
import '../../widgets/skeleton.dart';

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

  Future<void> _refresh() async {
    final future = _load();
    setState(() => _ticketsFuture = future);
    await future;
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
              Text(tr(context, 'track_ticket_hint'), style: TextStyle(color: LeapPalette.of(context).muted, fontSize: 12.5)),
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
            color: LeapPalette.of(context).torque.withValues(alpha: 0.12),
            padding: const EdgeInsets.all(12),
            child: Text(
              tr(context, 'messaging_leap_note'),
              style: TextStyle(color: LeapPalette.of(context).torque, fontSize: 12),
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: _refresh,
              child: FutureBuilder<List<dynamic>>(
                future: _ticketsFuture,
                builder: (context, snapshot) {
                  final palette = LeapPalette.of(context);
                  if (snapshot.connectionState == ConnectionState.waiting) {
                    return const ListSkeleton();
                  }
                  if (snapshot.hasError) {
                    return ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      children: [
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 80),
                          child: Center(child: Text('${tr(context, 'could_not_load_tickets')} ${snapshot.error}', style: TextStyle(color: palette.muted))),
                        ),
                      ],
                    );
                  }
                  final tickets = snapshot.data ?? [];
                  if (tickets.isEmpty) {
                    return ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      children: [
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 80),
                          child: Center(child: Text(tr(context, 'no_tickets_yet'), style: TextStyle(color: palette.muted))),
                        ),
                      ],
                    );
                  }
                  // Real, honestly-computed stats (new) -- matches the
                  // real Stitch reference's own stats bento concept,
                  // but only for the two counts genuinely computable
                  // from real, already-loaded ticket data. The
                  // reference's "AVG RESPONSE" stat is deliberately NOT
                  // shown -- no response-time tracking exists anywhere
                  // in the real data without fabricating a number.
                  final openCount = tickets.where((t) => (t as Map<String, dynamic>)['status'] != 'resolved' && t['status'] != 'closed').length;
                  final resolvedCount = tickets.length - openCount;
                  return ListView.separated(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.all(16),
                    itemCount: tickets.length + 1,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, i) {
                      if (i == 0) {
                        return Row(
                          children: [
                            Expanded(child: _StatCard(label: tr(context, 'total_tickets'), value: '${tickets.length}')),
                            const SizedBox(width: 10),
                            Expanded(child: _StatCard(label: tr(context, 'open_requests'), value: '$openCount', accent: true)),
                            const SizedBox(width: 10),
                            Expanded(child: _StatCard(label: tr(context, 'resolved'), value: '$resolvedCount')),
                          ],
                        );
                      }
                      final t = tickets[i - 1] as Map<String, dynamic>;
                      final status = t['status'] as String;
                      final isResolved = status == 'resolved' || status == 'closed';
                      return Container(
                        decoration: BoxDecoration(
                          color: palette.card,
                          borderRadius: BorderRadius.circular(14),
                          border: Border(left: BorderSide(color: isResolved ? palette.gauge : palette.signal, width: 4)),
                        ),
                        clipBehavior: Clip.antiAlias,
                        child: ListTile(
                          leading: Container(
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(color: palette.card, borderRadius: BorderRadius.circular(10)),
                            child: Icon(isResolved ? Icons.check_circle_outline : Icons.build_outlined, color: isResolved ? palette.gauge : palette.signal),
                          ),
                          title: Text(t['subject'] as String, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontWeight: FontWeight.w700, color: palette.ink)),
                          subtitle: Text(trStatus(context, status), style: TextStyle(fontSize: 12, color: palette.muted)),
                          trailing: Icon(Icons.chevron_right, color: palette.muted),
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

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final bool accent;
  const _StatCard({required this.label, required this.value, this.accent = false});

  @override
  Widget build(BuildContext context) {
    final palette = LeapPalette.of(context);
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: palette.card,
        borderRadius: BorderRadius.circular(12),
        border: Border(left: BorderSide(color: accent ? palette.signal : palette.line, width: accent ? 4 : 1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label.toUpperCase(), style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: palette.muted, letterSpacing: 0.4)),
          const SizedBox(height: 6),
          Text(value, style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: palette.ink)),
        ],
      ),
    );
  }
}
