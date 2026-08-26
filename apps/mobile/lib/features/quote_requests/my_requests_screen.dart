import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../core/auth_state.dart';
import '../../core/language_state.dart';
import '../../services/api_client.dart';
import '../../models/quote_request.dart';

/// Real "My Requests" tracking screen for the "request a part we
/// don't carry" system (RFQ), confirmed with the person's own
/// workflow description: the buyer's own real requests, so they can
/// see status and (once quoted) review and pay.
class MyRequestsScreen extends StatefulWidget {
  const MyRequestsScreen({super.key});

  @override
  State<MyRequestsScreen> createState() => _MyRequestsScreenState();
}

class _MyRequestsScreenState extends State<MyRequestsScreen> {
  List<QuoteRequest>? _requests;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final token = context.read<AuthState>().token;
    if (token == null) return;
    try {
      final requests = await ApiClient().fetchMyQuoteRequests(token);
      if (mounted) setState(() { _requests = requests; _errorMessage = null; });
    } on ApiException catch (e) {
      if (mounted) setState(() => _errorMessage = e.message);
    }
  }

  Color _statusColor(String status, LeapPalette palette) {
    switch (status) {
      case 'quoted':
        return palette.gauge;
      case 'ordered':
        return palette.torque;
      case 'submitted':
        return palette.amber;
      default:
        return palette.muted;
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = LeapPalette.of(context);
    final isAr = context.watch<LanguageState>().isArabic;
    return Scaffold(
      appBar: AppBar(title: Text(isAr ? 'طلباتي' : 'My Requests')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/request-quote').then((_) => _load()),
        icon: const Icon(Icons.add),
        label: Text(isAr ? 'طلب جديد' : 'New request'),
        backgroundColor: palette.signal,
        foregroundColor: palette.onSignal,
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _errorMessage != null
            ? ListView(children: [Padding(padding: const EdgeInsets.all(24), child: Text(_errorMessage!, style: const TextStyle(color: Colors.red)))])
            : _requests == null
                ? ListView(children: const [Center(child: Padding(padding: EdgeInsets.all(60), child: CircularProgressIndicator()))])
                : _requests!.isEmpty
                    ? ListView(
                        children: [
                          Padding(
                            padding: const EdgeInsets.all(40),
                            child: Text(isAr ? 'لا توجد طلبات بعد.' : 'No requests yet.', textAlign: TextAlign.center, style: TextStyle(color: palette.muted)),
                          ),
                        ],
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.all(14),
                        itemCount: _requests!.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 10),
                        itemBuilder: (context, i) {
                          final request = _requests![i];
                          return InkWell(
                            borderRadius: BorderRadius.circular(10),
                            onTap: () => context.push('/part-requests/${request.id}').then((_) => _load()),
                            child: Container(
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(border: Border.all(color: palette.line), borderRadius: BorderRadius.circular(10)),
                              child: Row(
                                children: [
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(request.vehicleLabel, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                                        const SizedBox(height: 2),
                                        Text(
                                          isAr ? '${request.items.length} قطعة' : '${request.items.length} item${request.items.length == 1 ? '' : 's'}',
                                          style: TextStyle(fontSize: 12, color: palette.muted),
                                        ),
                                      ],
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                    decoration: BoxDecoration(color: _statusColor(request.status, palette).withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
                                    child: Text(
                                      request.status,
                                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: _statusColor(request.status, palette)),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
      ),
    );
  }
}
