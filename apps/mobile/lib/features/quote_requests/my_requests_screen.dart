import 'package:flutter/material.dart';
import '../../widgets/premium.dart';
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
      // a deleted (cancelled) request is not shown any more
      final requests = (await ApiClient().fetchMyQuoteRequests(token)).where((r) => r.status != 'cancelled').toList();
      if (mounted) setState(() { _requests = requests; _errorMessage = null; });
    } on ApiException catch (e) {
      if (mounted) setState(() => _errorMessage = e.message);
    }
  }

  /// Swiped away: it leaves the list at once; a message offers Undo for 4 seconds, then the request is deleted (cancelled) on the server.
  /// The server only allows this before the request has been quoted, so only drafts and requests waiting for offers can be swiped.
  void _delete(QuoteRequest request, bool isAr) {
    final index = _requests!.indexOf(request);
    final token = context.read<AuthState>().token;
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _requests!.remove(request));
    var undone = false;
    messenger.hideCurrentSnackBar();
    messenger
        .showSnackBar(SnackBar(
          duration: const Duration(seconds: 4),
          content: Text(isAr ? 'تم حذف الطلب' : 'Request deleted'),
          action: SnackBarAction(
            label: isAr ? 'تراجع' : 'Undo',
            onPressed: () {
              undone = true;
              if (mounted && _requests != null) setState(() => _requests!.insert(index.clamp(0, _requests!.length), request));
            },
          ),
        ))
        .closed
        .then((_) async {
      if (undone || token == null) return;
      try {
        await ApiClient().cancelQuoteRequest(token, request.id);
      } on ApiException catch (e) {
        messenger.showSnackBar(SnackBar(content: Text(e.message)));
        if (mounted) _load();
      }
    });
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

  // Real, confirmed fix found via self-audit: the status badge was
  // showing the raw English database value directly, even in Arabic.
  // Matches the same real status values already translated correctly
  // in quote_request_detail_screen.dart's own _StatusBanner.
  String _statusLabel(String status, bool isAr) {
    switch (status) {
      case 'draft':
        return isAr ? 'مسودة' : 'Draft';
      case 'submitted':
        return isAr ? 'قيد المراجعة' : 'Submitted';
      case 'quoted':
        return isAr ? 'تم التسعير' : 'Quoted';
      case 'ordered':
        return isAr ? 'تم الطلب' : 'Ordered';
      case 'expired':
        return isAr ? 'منتهي الصلاحية' : 'Expired';
      case 'cancelled':
        return isAr ? 'ملغى' : 'Cancelled';
      default:
        return status;
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
                          final canDelete = request.status == 'draft' || request.status == 'submitted';
                          // slide it to the side: a red trash can shows, and letting go deletes it
                          return Dismissible(
                            key: ValueKey('request-${request.id}'),
                            direction: canDelete ? DismissDirection.endToStart : DismissDirection.none,
                            onDismissed: (_) => _delete(request, isAr),
                            background: Container(
                              alignment: AlignmentDirectional.centerEnd,
                              padding: const EdgeInsets.symmetric(horizontal: 22),
                              decoration: BoxDecoration(
                                gradient: const LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xFFEF5350), Color(0xFFC62828)]),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Semantics(label: isAr ? 'حذف' : 'Delete', child: const Icon(Icons.delete_outline, color: Colors.white, size: 26)),
                            ),
                            child: InkWell(
                            borderRadius: BorderRadius.circular(10),
                            onTap: () => context.push('/part-requests/${request.id}').then((_) => _load()),
                            child: Container(
                              padding: const EdgeInsets.all(14),
                              decoration: Premium.cardFor(palette, radius: 10),
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
                                      _statusLabel(request.status, isAr),
                                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: _statusColor(request.status, palette)),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ));
                        },
                      ),
      ),
    );
  }
}
