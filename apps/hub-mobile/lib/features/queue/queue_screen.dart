import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/auth_state.dart';
import '../../core/language_state.dart';
import '../../core/hub_strings.dart';
import '../../core/theme.dart';
import '../../models/shipment.dart';
import '../../services/api_client.dart';
import '../../widgets/status_badge.dart';
import '../shipment/shipment_detail_screen.dart';
import 'scan_screen.dart';

enum _LoadState { loading, ready, error }

/// Faithful port of apps/hub-portal/src/App.jsx's own QueueScreen
/// (lines 184-296) -- same real 6 filters, same real client-side
/// search (a hub's own real queue is naturally bounded to their own
/// assigned shipments, so no new backend endpoint was needed there,
/// and none is needed here either), same real 20-second silent
/// background poll (more than one real hub worker can be on the same
/// real queue at once).
class QueueScreen extends StatefulWidget {
  const QueueScreen({super.key});

  @override
  State<QueueScreen> createState() => _QueueScreenState();
}

class _QueueScreenState extends State<QueueScreen> {
  static const _filterIds = ['all', 'awaiting_receipt', 'in_progress', 'shipped_to_buyer', 'delivered', 'flagged'];
  static const _inProgressStatuses = ['received', 'opened', 'inspected', 'packed'];

  List<ShipmentSummary> _shipments = [];
  _LoadState _loadState = _LoadState.loading;
  String? _errorMessage;
  String _filter = 'all';
  final _searchController = TextEditingController();
  Timer? _pollTimer;

  @override
  void initState() {
    super.initState();
    _load(showSpinner: true);
    _pollTimer = Timer.periodic(const Duration(seconds: 20), (_) => _load(showSpinner: false));
    _searchController.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _load({required bool showSpinner}) async {
    if (showSpinner && mounted) setState(() => _loadState = _LoadState.loading);
    final auth = context.read<AuthState>();
    try {
      final data = await ApiClient().fetchMyShipments(auth.token!);
      if (!mounted) return;
      setState(() {
        _shipments = data;
        _loadState = _LoadState.ready;
      });
    } on SessionExpiredError {
      auth.handleSessionExpired();
    } on ApiException catch (e) {
      // A silent background poll failing shouldn't blank out an
      // already-rendered queue with a full error state -- same real
      // reasoning as the web app's own load() function.
      if (showSpinner && mounted) {
        setState(() {
          _errorMessage = e.message;
          _loadState = _LoadState.error;
        });
      }
    }
  }

  List<ShipmentSummary> get _filtered {
    final query = _searchController.text.trim().toLowerCase();
    return _shipments.where((s) {
      if (_filter == 'all') {
        // no status filter
      } else if (_filter == 'in_progress') {
        if (!_inProgressStatuses.contains(s.status)) return false;
      } else if (s.status != _filter) {
        return false;
      }
      if (query.isNotEmpty) {
        final matchesOrder = s.orderId.toLowerCase().contains(query);
        final matchesSupplier = s.supplierName.toLowerCase().contains(query);
        if (!matchesOrder && !matchesSupplier) return false;
      }
      return true;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final lang = context.watch<LanguageState>();
    final t = kHubStrings[lang.language]!;
    final auth = context.watch<AuthState>();
    final filtered = _filtered;

    return Scaffold(
      appBar: AppBar(
        title: Text(t.appName),
        actions: [
          TextButton(
            onPressed: () => lang.toggle(),
            child: Text(lang.isChinese ? 'EN' : '中文', style: const TextStyle(color: HubColors.muted, fontWeight: FontWeight.w700)),
          ),
          IconButton(
            icon: const Icon(Icons.logout, size: 18),
            tooltip: t.logout,
            onPressed: () => auth.logout(),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => const ScanScreen()),
        ),
        backgroundColor: HubColors.signal,
        icon: const Icon(Icons.qr_code_scanner),
        label: Text(t.scanButtonLabel),
      ),
      body: RefreshIndicator(
        onRefresh: () => _load(showSpinner: true),
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 18, 20, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(t.queue.title, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: HubColors.ink)),
                  const SizedBox(height: 2),
                  Text(
                    _loadState == _LoadState.ready ? t.queue.shownCount(filtered.length, _shipments.length) : t.queue.loading,
                    style: const TextStyle(fontSize: 12.5, color: HubColors.muted),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 14, 20, 0),
              child: TextField(
                controller: _searchController,
                decoration: InputDecoration(hintText: t.queue.searchPlaceholder, isDense: true),
              ),
            ),
            SizedBox(
              height: 46,
              child: ListView.separated(
                padding: const EdgeInsets.fromLTRB(20, 14, 20, 0),
                scrollDirection: Axis.horizontal,
                itemCount: _filterIds.length,
                separatorBuilder: (_, __) => const SizedBox(width: 6),
                itemBuilder: (context, i) {
                  final id = _filterIds[i];
                  final isActive = _filter == id;
                  return ChoiceChip(
                    label: Text(t.filters[id] ?? id),
                    selected: isActive,
                    onSelected: (_) => setState(() => _filter = id),
                    selectedColor: HubColors.ink,
                    backgroundColor: Colors.white,
                    labelStyle: TextStyle(color: isActive ? Colors.white : HubColors.ink, fontWeight: FontWeight.w700, fontSize: 12.5),
                    side: BorderSide(color: isActive ? HubColors.ink : HubColors.line),
                  );
                },
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(20),
              child: _buildBody(filtered),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBody(List<ShipmentSummary> filtered) {
    final t = kHubStrings[context.watch<LanguageState>().language]!;
    if (_loadState == _LoadState.loading) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 32),
        child: Center(child: Text(t.queue.loading, style: const TextStyle(color: HubColors.muted, fontSize: 13))),
      );
    }
    if (_loadState == _LoadState.error) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 32),
        child: Center(child: Text(_errorMessage ?? '', style: const TextStyle(color: HubColors.red, fontSize: 13))),
      );
    }
    if (filtered.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 32),
        child: Center(child: Text(t.queue.empty, style: const TextStyle(color: HubColors.muted, fontSize: 13))),
      );
    }
    return Column(
      children: filtered
          .map((s) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: InkWell(
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => ShipmentDetailScreen(shipmentId: s.id)),
                  ),
                  borderRadius: BorderRadius.circular(10),
                  child: Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: HubColors.card,
                      border: Border.all(color: HubColors.line),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(s.orderId, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: HubColors.ink)),
                            const SizedBox(height: 2),
                            Text(s.supplierName, style: const TextStyle(fontSize: 12, color: HubColors.muted)),
                          ],
                        ),
                        StatusBadge(status: s.status),
                      ],
                    ),
                  ),
                ),
              ))
          .toList(),
    );
  }
}
