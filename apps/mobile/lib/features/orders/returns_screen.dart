import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../core/app_strings.dart';
import '../../core/auth_state.dart';
import '../../services/api_client.dart';

/// BUY-053 (the missing half): the return-request sheet on
/// order_detail_screen.dart already lets a buyer SUBMIT a return via
/// POST /returns — this screen is the other half, showing the real
/// list of return cases the buyer has filed via GET /returns/my-cases,
/// so they can check status and follow up. Same login-gate pattern as
/// orders_screen.dart and chat_screen.dart: guest-filed returns aren't
/// listable without an account (the backend scopes /returns/my-cases
/// to a real buyer_id).
///
/// Deliberately no "new return" FAB here, unlike chat_screen.dart's
/// "new ticket" FAB — a return case is always tied to a specific
/// sub-order, so it's only ever started from that order's detail page,
/// not from a blank form.
class ReturnsScreen extends StatefulWidget {
  const ReturnsScreen({super.key});

  @override
  State<ReturnsScreen> createState() => _ReturnsScreenState();
}

class _ReturnsScreenState extends State<ReturnsScreen> {
  late Future<List<dynamic>> _casesFuture;

  @override
  void initState() {
    super.initState();
    _casesFuture = _load();
  }

  Future<List<dynamic>> _load() async {
    final auth = context.read<AuthState>();
    if (!auth.isLoggedIn) return [];
    return ApiClient().fetchMyReturnCases(auth.token!);
  }

  void _refresh() {
    setState(() => _casesFuture = _load());
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();

    if (!auth.isLoggedIn) {
      return Scaffold(
        appBar: AppBar(title: Text(tr(context, 'my_returns'))),
        body: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.assignment_return_outlined, size: 40, color: LeapColors.muted),
              const SizedBox(height: 12),
              Text(
                tr(context, 'login_to_see_returns'),
                textAlign: TextAlign.center,
                style: const TextStyle(color: LeapColors.muted, fontSize: 13),
              ),
              const SizedBox(height: 16),
              ElevatedButton(onPressed: () => context.push('/login'), child: Text(tr(context, 'log_in'))),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: Text(tr(context, 'my_returns'))),
      body: FutureBuilder<List<dynamic>>(
        future: _casesFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(child: Text('${tr(context, 'could_not_load_returns')} ${snapshot.error}', style: const TextStyle(color: LeapColors.muted)));
          }
          final cases = snapshot.data ?? [];
          if (cases.isEmpty) {
            return Center(child: Text(tr(context, 'no_returns_yet'), style: const TextStyle(color: LeapColors.muted)));
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: cases.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (context, i) {
              final c = cases[i] as Map<String, dynamic>;
              return Card(
                child: ListTile(
                  title: Text(c['reason'] as String, maxLines: 1, overflow: TextOverflow.ellipsis),
                  subtitle: Text(
                    '${tr(context, 'return_case_order_label')} ${c['orderId']}',
                    style: const TextStyle(fontSize: 12),
                  ),
                  trailing: _StatusPill(status: c['status'] as String),
                  onTap: () async {
                    await context.push('/returns/${c['id']}');
                    _refresh();
                  },
                ),
              );
            },
          );
        },
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  final String status;
  const _StatusPill({required this.status});

  Color _colorFor(String status) {
    switch (status) {
      case 'approved':
      case 'completed':
        return LeapColors.torque;
      case 'rejected':
        return Colors.red;
      default:
        return LeapColors.muted;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Text(
      trStatus(context, status).toUpperCase(),
      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: _colorFor(status)),
    );
  }
}
