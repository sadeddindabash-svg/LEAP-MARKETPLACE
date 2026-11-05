import 'package:flutter/material.dart';
import '../../widgets/premium.dart';
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
  String _tab = 'all';      // the chosen tab: all, open or resolved

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
                  bool resolvedOf(dynamic t) => (t as Map<String, dynamic>)['status'] == 'resolved' || t['status'] == 'closed';
                  final openCount = tickets.where((t) => !resolvedOf(t)).length;
                  final resolvedCount = tickets.length - openCount;
                  // the three tabs (All · Open · Resolved), each showing only its tickets
                  final shown = switch (_tab) { 'open' => tickets.where((t) => !resolvedOf(t)).toList(), 'resolved' => tickets.where(resolvedOf).toList(), _ => tickets };
                  return ListView.separated(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.all(16),
                    itemCount: shown.isEmpty ? 2 : shown.length + 1,
                    separatorBuilder: (_, __) => const SizedBox(height: 12),
                    itemBuilder: (context, i) {
                      if (i == 0) {
                        return _TicketTabs(
                          tab: _tab,
                          counts: {'all': tickets.length, 'open': openCount, 'resolved': resolvedCount},
                          onTab: (t) => setState(() => _tab = t),
                        );
                      }
                      if (shown.isEmpty) {
                        return Padding(padding: const EdgeInsets.symmetric(vertical: 40), child: Center(child: Text(tr(context, 'no_tickets_yet'), style: TextStyle(color: palette.muted))));
                      }
                      final t = shown[i - 1] as Map<String, dynamic>;
                      final status = t['status'] as String;
                      final isResolved = status == 'resolved' || status == 'closed';
                      return Container(
                        decoration: Premium.cardFor(palette, radius: 14),
                        clipBehavior: Clip.antiAlias,
                        child: ListTile(
                          leading: Container(
                            width: 44,
                            height: 44,
                            decoration: Premium.cardFor(palette, radius: 10),
                            child: Icon(isResolved ? Icons.check_circle_outline : Icons.build_outlined, color: isResolved ? palette.gauge : palette.signal),
                          ),
                          title: Text(t['subject'] as String, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontWeight: FontWeight.w700, color: palette.ink)),
                          subtitle: Text(trStatus(context, status), style: TextStyle(fontSize: 12, color: palette.muted)),
                          // the status as a raised pill: open gold, resolved green
                          trailing: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: isResolved ? Premium.greenRaised() : Premium.goldRaised(radius: 999),
                            child: Text(isResolved ? tr(context, 'resolved') : _openWord(context), style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: isResolved ? Colors.white : const Color(0xFF0B3146))),
                          ),
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

/// The short word for an open ticket (the tab and the label on each ticket).
String _openWord(BuildContext context) => Directionality.of(context) == TextDirection.rtl ? 'مفتوحة' : 'Open';

/// All · Open · Resolved as one raised switch: the chosen tab is a raised card; Open's number is gold, Resolved's green.
class _TicketTabs extends StatelessWidget {
  final String tab;
  final Map<String, int> counts;
  final ValueChanged<String> onTab;
  const _TicketTabs({required this.tab, required this.counts, required this.onTab});

  @override
  Widget build(BuildContext context) {
    final palette = LeapPalette.of(context);
    final dark = Theme.of(context).brightness == Brightness.dark;
    const gold = Color(0xFFC98A00);
    final green = palette.gauge;
    final tabs = [('all', tr(context, 'tab_all'), palette.ink), ('open', _openWord(context), gold), ('resolved', tr(context, 'resolved'), green)];
    return Container(
      padding: const EdgeInsets.all(5),
      decoration: BoxDecoration(color: dark ? Colors.black.withValues(alpha: 0.25) : const Color(0xFFE4E9EE), borderRadius: BorderRadius.circular(16)),
      child: Row(
        children: [
          for (final (key, label, color) in tabs)
            Expanded(
              child: GestureDetector(
                key: Key('ticket-tab-$key'),
                behavior: HitTestBehavior.opaque,
                onTap: () => onTab(key),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
                  decoration: tab == key ? Premium.cardFor(palette, radius: 12) : const BoxDecoration(),
                  child: Column(
                    children: [
                      Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: key == 'all' ? palette.muted : color)),
                      const SizedBox(height: 2),
                      Text('${counts[key] ?? 0}', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: color)),
                    ],
                  ),
                ),
              ),
            ),
        ],
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
