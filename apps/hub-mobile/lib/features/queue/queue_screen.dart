import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/auth_state.dart';
import '../../core/language_state.dart';
import '../../core/hub_strings.dart';
import '../../core/theme.dart';
import '../../models/shipment.dart';
import '../../services/api_client.dart';
import '../../widgets/leap_logo_animation.dart';
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
    _pollTimer = Timer.periodic(const Duration(seconds: 5), (_) => _load(showSpinner: false));      // every 5 seconds, the same as the hub portal
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

  // the number on each filter chip: every shipment in it, whatever is typed in the search box
  bool _inFilter(ShipmentSummary s, String id) {
    if (id == 'all') return true;
    if (id == 'in_progress') return _inProgressStatuses.contains(s.status);
    if (id == 'flagged') return kFlaggedStatuses.contains(s.status) && s.resolvedAt == null;
    return s.status == id;
  }

  int _countOf(String id) => _shipments.where((s) => _inFilter(s, id)).length;

  // gold for work coming or at the hub, red for open flags, grey otherwise
  Widget _filterCount(String id, bool active) {
    final n = _countOf(id);
    if (_loadState != _LoadState.ready || n == 0) return const SizedBox.shrink();
    final Color bg; final Color fg;
    if (id == 'flagged') { bg = HubColors.red; fg = Colors.white; }
    else if (id == 'awaiting_receipt' || id == 'in_progress') { bg = const Color(0xFFF2A71B); fg = const Color(0xFF241A05); }
    else if (active) { bg = Colors.white; fg = HubColors.ink; }
    else { bg = const Color(0xFFEEF0F3); fg = HubColors.ink; }
    return Container(
      margin: const EdgeInsets.only(left: 6),
      constraints: const BoxConstraints(minWidth: 19),
      height: 19,
      padding: const EdgeInsets.symmetric(horizontal: 5),
      alignment: Alignment.center,
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(10)),
      child: Text('$n', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: fg)),
    );
  }

  List<ShipmentSummary> get _filtered {
    final query = _searchController.text.trim().toLowerCase();
    return _shipments.where((s) {
      if (_filter == 'all') {
        // no status filter
      } else if (_filter == 'in_progress') {
        if (!_inProgressStatuses.contains(s.status)) return false;
      } else if (_filter == 'flagged') {
        // the whole flagged family (flagged, returned, discarded), but a flag the platform has CLOSED is no longer an open problem: it stays under "All"
        if (!kFlaggedStatuses.contains(s.status) || s.resolvedAt != null) return false;
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
        // the logo, drawn like an engraving when the queue opens (the same as the opening screen, the portals and the website), then the app's name
        title: Row(mainAxisSize: MainAxisSize.min, children: [const LeapLogoAnimation(size: 30), const SizedBox(width: 10), Flexible(child: Text(t.appName, overflow: TextOverflow.ellipsis))]),
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
                    label: Row(mainAxisSize: MainAxisSize.min, children: [Text(t.filters[id] ?? id), _filterCount(id, isActive)]),
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
                            Row(
                              children: [
                                Text(s.orderId, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: HubColors.ink)),
                                // a free replacement for a faulty unit: handled like any other shipment, but the hub should know why it came
                                if (s.replacementFor != null) ...[
                                  const SizedBox(width: 6),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(color: HubColors.torqueBg, borderRadius: BorderRadius.circular(999)),
                                    child: Text(t.detail.replacementTag, style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: HubColors.torque)),
                                  ),
                                ],
                              ],
                            ),
                            const SizedBox(height: 2),
                            Text(s.supplierName, style: const TextStyle(fontSize: 12, color: HubColors.muted)),
                          ],
                        ),
                        StatusBadge(status: s.displayStatus),
                      ],
                    ),
                  ),
                ),
              ))
          .toList(),
    );
  }
}
