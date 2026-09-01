import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../core/auth_state.dart';
import '../../core/language_state.dart';
import '../../core/hub_strings.dart';
import '../../core/theme.dart';
import '../../models/shipment.dart';
import '../../services/api_client.dart';
import '../../widgets/status_badge.dart';
import '../../widgets/evidence_photo_picker.dart';

/// Simple, self-contained "yyyy-MM-dd HH:mm" formatting -- no intl
/// dependency, no locale initialization needed at all. Same real
/// approach already proven in apps/mobile's own delivery-date
/// feature, avoiding intl's DateFormat entirely (it throws at runtime
/// without explicit locale setup, which nothing in this app performs).
String _formatEventTimestamp(DateTime dt) {
  final local = dt.toLocal();
  String two(int n) => n.toString().padLeft(2, '0');
  return '${local.year}-${two(local.month)}-${two(local.day)} ${two(local.hour)}:${two(local.minute)}';
}

enum _LoadState { loading, ready, error }

/// Maps a step to its history-timeline icon -- Material equivalents
/// of the web app's own real Lucide icon choices (STEP_INFO, App.jsx
/// lines 119-128).
IconData _iconForStep(String step) {
  switch (step) {
    case 'awaiting_receipt':
      return Icons.inbox_outlined;
    case 'received':
      return Icons.inventory_2_outlined;
    case 'opened':
      return Icons.search;
    case 'inspected':
      return Icons.add_box_outlined;
    case 'packed':
      return Icons.local_shipping_outlined;
    case 'shipped_to_buyer':
      return Icons.assignment_turned_in_outlined;
    case 'delivered':
      return Icons.check_circle_outline;
    case 'flagged':
      return Icons.warning_amber_outlined;
    default:
      return Icons.assignment_turned_in_outlined;
  }
}

class ShipmentDetailScreen extends StatefulWidget {
  final String shipmentId;
  const ShipmentDetailScreen({super.key, required this.shipmentId});

  @override
  State<ShipmentDetailScreen> createState() => _ShipmentDetailScreenState();
}

class _ShipmentDetailScreenState extends State<ShipmentDetailScreen> {
  ShipmentDetail? _shipment;
  _LoadState _loadState = _LoadState.loading;
  String? _errorMessage;

  final _notesController = TextEditingController();
  final _trackingController = TextEditingController();
  final _deliveryNoteController = TextEditingController();
  List<String> _photos = [];
  bool _isUploadingPhoto = false;
  bool _isSubmitting = false;
  bool _showFlagForm = false;
  // Confirmed with the person: one controller per item, initialized
  // lazily as each item's card builds, for the interactive
  // received-quantity input.
  final Map<String, TextEditingController> _receivedControllers = {};
  // Confirmed with the person through several rounds of
  // clarification: which spec labels have been actively confirmed
  // against the physical part, per item.
  final Map<String, Set<String>> _checkedSpecs = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _notesController.dispose();
    _trackingController.dispose();
    _deliveryNoteController.dispose();
    for (final c in _receivedControllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  /// Confirmed with the person: records the real, actual quantity
  /// counted on arrival. Deliberately does NOT auto-flag on a real
  /// mismatch -- purely informational, the worker decides for
  /// themselves whether to actually flag the shipment.
  Future<void> _saveReceivedQuantity(String productId, String rawValue) async {
    final parsed = int.tryParse(rawValue.trim());
    if (parsed == null || parsed < 0) return;
    final auth = context.read<AuthState>();
    try {
      await ApiClient().recordReceivedQuantity(auth.token!, widget.shipmentId, productId, parsed);
      await _load();
    } on SessionExpiredError {
      auth.handleSessionExpired();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _errorMessage = e.message);
    }
  }

  Future<void> _load() async {
    setState(() => _loadState = _LoadState.loading);
    final auth = context.read<AuthState>();
    try {
      final data = await ApiClient().fetchMyShipmentById(auth.token!, widget.shipmentId);
      if (!mounted) return;
      setState(() {
        _shipment = data;
        _loadState = _LoadState.ready;
      });
    } on SessionExpiredError {
      auth.handleSessionExpired();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = e.message;
        _loadState = _LoadState.error;
      });
    }
  }

  Future<void> _submitStep(String step) async {
    final t = kHubStrings[context.read<LanguageState>().language]!;
    if (_photos.isEmpty) {
      setState(() => _errorMessage = t.detail.errPhotoRequired);
      return;
    }
    if (step == 'shipped_to_buyer' && _trackingController.text.trim().isEmpty) {
      setState(() => _errorMessage = t.detail.errTrackingRequired);
      return;
    }
    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });
    final auth = context.read<AuthState>();
    try {
      await ApiClient().recordShipmentEvent(
        auth.token!,
        widget.shipmentId,
        step: step,
        notes: _notesController.text.trim().isEmpty ? null : _notesController.text.trim(),
        photos: _photos,
        trackingNumber: step == 'shipped_to_buyer' ? _trackingController.text.trim() : null,
      );
      if (!mounted) return;
      _notesController.clear();
      _trackingController.clear();
      setState(() {
        _photos = [];
        _showFlagForm = false;
      });
      await _load();
    } on SessionExpiredError {
      auth.handleSessionExpired();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _errorMessage = e.message);
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  Future<void> _submitConfirmDelivery() async {
    final t = kHubStrings[context.read<LanguageState>().language]!;
    if (_deliveryNoteController.text.trim().isEmpty) {
      setState(() => _errorMessage = t.detail.errDeliveryNoteRequired);
      return;
    }
    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });
    final auth = context.read<AuthState>();
    try {
      await ApiClient().confirmDelivery(auth.token!, widget.shipmentId, _deliveryNoteController.text.trim());
      if (!mounted) return;
      _deliveryNoteController.clear();
      await _load();
    } on SessionExpiredError {
      auth.handleSessionExpired();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _errorMessage = e.message);
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = kHubStrings[context.watch<LanguageState>().language]!;

    if (_loadState == _LoadState.loading) {
      return Scaffold(body: Center(child: Text(t.queue.loading, style: const TextStyle(color: HubColors.muted, fontSize: 13))));
    }
    if (_loadState == _LoadState.error && _shipment == null) {
      return Scaffold(body: Center(child: Text(_errorMessage ?? '', style: const TextStyle(color: HubColors.red, fontSize: 13))));
    }

    final shipment = _shipment!;
    final stepText = t.steps[shipment.status];
    final nextStatus = nextStatusFor(shipment.status);
    // CONFIRMED (backend migration 027): "shipped_to_buyer" is no
    // longer the real terminal state -- a real "Confirm Delivered"
    // action (or real carrier tracking) still needs to happen from
    // here. Only "delivered" and "flagged" are genuinely final.
    final isTerminal = shipment.status == 'delivered' || shipment.status == 'flagged';
    final needsDeliveryConfirmation = shipment.status == 'shipped_to_buyer';
    // Confirmed with the person through several rounds of
    // clarification: can't mark a shipment as inspected until every
    // real spec on every real item has been actively confirmed
    // against the physical part -- only relevant for this specific
    // real status transition (receiving and opening the package stay
    // ungated; the detailed real verification belongs at inspection).
    final allChecksConfirmed = nextStatus != 'inspected' ||
        shipment.items.every((item) => (_checkedSpecs[item.productId]?.length ?? 0) >= _specLabelsFor(item).length);
    // Deliberate, noted fix from the web app's own real behavior: also
    // gated on nextStatus != null, so this card doesn't render at the
    // shipped_to_buyer status with an empty title/hint/button label --
    // the confirm-delivery card below is the real, correct action at
    // that status instead.
    final showMainStepForm = !isTerminal && !_showFlagForm && nextStatus != null;

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(shipment.orderId, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                // Confirmed with the person: shown only when this
                // real order genuinely has more than one shipment --
                // a single-supplier order (the common case) shows
                // nothing extra here.
                if (shipment.totalShipments > 1) ...[
                  const SizedBox(width: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(color: HubColors.card, borderRadius: BorderRadius.circular(999), border: Border.all(color: HubColors.line)),
                    child: Text(
                      '${shipment.shipmentIndex} / ${shipment.totalShipments}',
                      style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: HubColors.ink),
                    ),
                  ),
                ],
              ],
            ),
            Text(shipment.supplierName, style: const TextStyle(fontSize: 11.5, color: HubColors.muted)),
          ],
        ),
        actions: [Padding(padding: const EdgeInsets.only(right: 16), child: StatusBadge(status: shipment.status))],
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          _buildItemsCard(t, shipment),
          if (shipment.otherShipments.isNotEmpty) ...[
            const SizedBox(height: 8),
            ...shipment.otherShipments.map((s) => Padding(
                  padding: const EdgeInsets.only(left: 4),
                  child: Text(
                    'Other shipment: ${s.supplierName} — ${s.status.replaceAll('_', ' ')}',
                    style: const TextStyle(fontSize: 11.5, color: HubColors.muted),
                  ),
                )),
          ],
          if (_errorMessage != null) ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: HubColors.redBg, borderRadius: BorderRadius.circular(8)),
              child: Text(_errorMessage!, style: const TextStyle(fontSize: 12.5, color: HubColors.red)),
            ),
          ],
          if (showMainStepForm) ...[
            const SizedBox(height: 16),
            _buildMainStepForm(t, stepText!, nextStatus!, allChecksConfirmed),
          ],
          if (!isTerminal && _showFlagForm) ...[
            const SizedBox(height: 16),
            _buildFlagForm(t),
          ],
          if (needsDeliveryConfirmation) ...[
            const SizedBox(height: 16),
            _buildConfirmDeliveryCard(t),
          ],
          if (isTerminal) ...[
            const SizedBox(height: 16),
            _buildTerminalBanner(t, shipment),
          ],
          const SizedBox(height: 16),
          _buildHistory(t, shipment),
        ],
      ),
    );
  }

  Widget _buildItemsCard(HubText t, ShipmentDetail shipment) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: HubColors.card, border: Border.all(color: HubColors.line), borderRadius: BorderRadius.circular(10)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(t.detail.items.toUpperCase(), style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: HubColors.muted)),
          const SizedBox(height: 8),
          ...shipment.items.map((item) => _buildItemVerificationRow(item)),
        ],
      ),
    );
  }

  /// Confirmed with the person: the same spec set already shown, now
  /// as individually-labeled entries rather than one joined string,
  /// since each one needs its own real, tappable checkbox.
  List<String> _specLabelsFor(ShipmentItem item) => [
        if (item.part != null) 'Part: ${item.part}',
        if (item.oemNumber != null) 'OEM: ${item.oemNumber}',
        ...item.attributes.map((a) => '${a.name}: ${a.value}'),
      ];

  Widget _buildItemVerificationRow(ShipmentItem item) {
    // Confirmed with the person: a genuine mismatch is a visual
    // warning only -- never auto-flags the shipment.
    final hasMismatch = item.receivedQuantity != null && item.receivedQuantity != item.quantity;
    final specs = _specLabelsFor(item);
    final checked = _checkedSpecs.putIfAbsent(item.productId, () => <String>{});
    final controller = _receivedControllers.putIfAbsent(
      item.productId,
      () => TextEditingController(text: item.receivedQuantity?.toString() ?? ''),
    );
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: hasMismatch ? HubColors.redBg : HubColors.card,
        border: Border.all(color: hasMismatch ? HubColors.red : HubColors.line),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(item.name, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: HubColors.ink)),
          if (specs.isNotEmpty) ...[
            const SizedBox(height: 6),
            ...specs.map((label) {
              final isChecked = checked.contains(label);
              return InkWell(
                onTap: () => setState(() {
                  if (isChecked) {
                    checked.remove(label);
                  } else {
                    checked.add(label);
                  }
                }),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 3),
                  child: Row(
                    children: [
                      Icon(
                        isChecked ? Icons.check_box : Icons.check_box_outline_blank,
                        size: 18,
                        color: isChecked ? HubColors.gauge : HubColors.muted,
                      ),
                      const SizedBox(width: 8),
                      Text(label, style: TextStyle(fontSize: 12.5, color: isChecked ? HubColors.ink : HubColors.muted)),
                    ],
                  ),
                ),
              );
            }),
            if (checked.length < specs.length) ...[
              const SizedBox(height: 2),
              InkWell(
                onTap: () => setState(() => checked.addAll(specs)),
                child: const Padding(
                  padding: EdgeInsets.symmetric(vertical: 3),
                  child: Text('Check all', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: HubColors.torque)),
                ),
              ),
            ],
            const SizedBox(height: 2),
            Text('${checked.length} of ${specs.length} checks confirmed', style: const TextStyle(fontSize: 10.5, color: HubColors.muted)),
          ],
          const SizedBox(height: 6),
          Row(
            children: [
              Text('Ordered: ${item.quantity}', style: const TextStyle(fontSize: 12, color: HubColors.muted)),
              const Spacer(),
              Text(
                'Received:',
                style: TextStyle(fontSize: 12, fontWeight: hasMismatch ? FontWeight.w700 : FontWeight.w400, color: hasMismatch ? HubColors.red : HubColors.muted),
              ),
              const SizedBox(width: 6),
              SizedBox(
                width: 44,
                height: 30,
                child: TextField(
                  controller: controller,
                  keyboardType: TextInputType.number,
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: hasMismatch ? HubColors.red : HubColors.ink),
                  decoration: InputDecoration(
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(vertical: 4),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(6), borderSide: BorderSide(color: hasMismatch ? HubColors.red : HubColors.line)),
                  ),
                  onSubmitted: (value) => _saveReceivedQuantity(item.productId, value),
                  onEditingComplete: () => _saveReceivedQuantity(item.productId, controller.text),
                ),
              ),
            ],
          ),
          if (hasMismatch) ...[
            const SizedBox(height: 6),
            const Text('Quantity mismatch — decide whether to flag this shipment below.', style: TextStyle(fontSize: 10.5, color: HubColors.red)),
          ],
        ],
      ),
    );
  }

  Widget _buildMainStepForm(HubText t, StepText stepText, String nextStatus, bool allChecksConfirmed) {
    final auth = context.read<AuthState>();
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(color: HubColors.card, border: Border.all(color: HubColors.line), borderRadius: BorderRadius.circular(12)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(stepText.promptTitle ?? '', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: HubColors.ink)),
          const SizedBox(height: 4),
          Text(stepText.promptHint ?? '', style: const TextStyle(fontSize: 12.5, color: HubColors.muted)),
          const SizedBox(height: 16),
          Text(t.detail.evidencePhotos.toUpperCase(), style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: HubColors.muted)),
          const SizedBox(height: 8),
          EvidencePhotoPicker(
            photoUrls: _photos,
            onAdd: (url) => setState(() => _photos = [..._photos, url]),
            onRemove: (url) => setState(() => _photos = _photos.where((p) => p != url).toList()),
            isUploading: _isUploadingPhoto,
            onUploadingChanged: (v) => setState(() => _isUploadingPhoto = v),
            onError: (msg) => setState(() => _errorMessage = msg),
            token: auth.token!,
          ),
          const SizedBox(height: 16),
          Text(t.detail.notes.toUpperCase(), style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: HubColors.muted)),
          const SizedBox(height: 8),
          TextField(controller: _notesController, maxLines: 3),
          if (nextStatus == 'shipped_to_buyer') ...[
            const SizedBox(height: 16),
            Text(t.detail.trackingNumber.toUpperCase(), style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: HubColors.muted)),
            const SizedBox(height: 8),
            TextField(controller: _trackingController),
          ],
          if (!allChecksConfirmed) ...[
            const SizedBox(height: 8),
            const Text('Confirm every checklist item above before marking as inspected.', style: TextStyle(fontSize: 11.5, color: HubColors.red)),
          ],
          const SizedBox(height: 18),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: (_isSubmitting || !allChecksConfirmed) ? null : () => _submitStep(nextStatus),
              style: ElevatedButton.styleFrom(backgroundColor: (_isSubmitting || !allChecksConfirmed) ? const Color(0xFFD1D5DB) : HubColors.signal),
              child: Text(_isSubmitting ? t.detail.saving : (stepText.actionLabel ?? '')),
            ),
          ),
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              onPressed: () => setState(() {
                _showFlagForm = true;
                _photos = [];
                _notesController.clear();
                _errorMessage = null;
              }),
              style: OutlinedButton.styleFrom(side: const BorderSide(color: HubColors.red), foregroundColor: HubColors.red),
              child: Text(t.detail.flagInstead),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFlagForm(HubText t) {
    final auth = context.read<AuthState>();
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(color: HubColors.redBg, border: Border.all(color: HubColors.red.withValues(alpha: 0.27)), borderRadius: BorderRadius.circular(12)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.warning_amber_outlined, size: 17, color: HubColors.red),
              const SizedBox(width: 8),
              Text(t.detail.flagTitle, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: HubColors.ink)),
            ],
          ),
          const SizedBox(height: 4),
          Text(t.detail.flagDesc, style: const TextStyle(fontSize: 12.5, color: HubColors.muted)),
          const SizedBox(height: 16),
          Text(t.detail.evidencePhotos.toUpperCase(), style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: HubColors.muted)),
          const SizedBox(height: 8),
          EvidencePhotoPicker(
            photoUrls: _photos,
            onAdd: (url) => setState(() => _photos = [..._photos, url]),
            onRemove: (url) => setState(() => _photos = _photos.where((p) => p != url).toList()),
            isUploading: _isUploadingPhoto,
            onUploadingChanged: (v) => setState(() => _isUploadingPhoto = v),
            onError: (msg) => setState(() => _errorMessage = msg),
            token: auth.token!,
          ),
          const SizedBox(height: 16),
          Text(t.detail.whatsWrong.toUpperCase(), style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: HubColors.muted)),
          const SizedBox(height: 8),
          TextField(controller: _notesController, maxLines: 3),
          const SizedBox(height: 18),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _isSubmitting ? null : () => _submitStep('flagged'),
              style: ElevatedButton.styleFrom(backgroundColor: _isSubmitting ? const Color(0xFFD1D5DB) : HubColors.red),
              child: Text(_isSubmitting ? t.detail.saving : t.detail.submitFlag),
            ),
          ),
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              onPressed: () => setState(() => _showFlagForm = false),
              style: OutlinedButton.styleFrom(side: const BorderSide(color: HubColors.line), foregroundColor: HubColors.ink),
              child: Text(t.detail.cancel),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildConfirmDeliveryCard(HubText t) {
    final canSubmit = !_isSubmitting && _deliveryNoteController.text.trim().isNotEmpty;
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(color: HubColors.card, border: Border.all(color: HubColors.line), borderRadius: BorderRadius.circular(12)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.inventory_2_outlined, size: 18, color: HubColors.ink),
              const SizedBox(width: 8),
              Text(t.detail.confirmDeliveredTitle, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: HubColors.ink)),
            ],
          ),
          const SizedBox(height: 10),
          Text(t.detail.confirmDeliveredHint, style: const TextStyle(fontSize: 12, color: HubColors.muted)),
          const SizedBox(height: 10),
          TextField(
            controller: _deliveryNoteController,
            minLines: 3,
            maxLines: 5,
            decoration: InputDecoration(hintText: t.detail.deliveryNotePlaceholder),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: canSubmit ? _submitConfirmDelivery : null,
              style: ElevatedButton.styleFrom(backgroundColor: canSubmit ? HubColors.gauge : const Color(0xFFD1D5DB)),
              child: Text(_isSubmitting ? t.detail.confirming : t.detail.confirmDelivered),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTerminalBanner(HubText t, ShipmentDetail shipment) {
    final isFlagged = shipment.status == 'flagged';
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: isFlagged ? HubColors.redBg : HubColors.gaugeBg, borderRadius: BorderRadius.circular(10)),
      child: Text(
        isFlagged ? t.detail.flaggedBanner : t.detail.completedBanner,
        style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: isFlagged ? HubColors.red : HubColors.gauge),
      ),
    );
  }

  Widget _buildHistory(HubText t, ShipmentDetail shipment) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(t.detail.history.toUpperCase(), style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: HubColors.muted)),
        const SizedBox(height: 10),
        if (shipment.events.isEmpty) Text(t.detail.noSteps, style: const TextStyle(fontSize: 12.5, color: HubColors.muted)),
        ...shipment.events.map((e) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: HubColors.card, border: Border.all(color: HubColors.line), borderRadius: BorderRadius.circular(10)),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(_iconForStep(e.step), size: 14, color: e.step == 'flagged' ? HubColors.red : HubColors.ink),
                        const SizedBox(width: 8),
                        Text(t.steps[e.step]?.label ?? e.step, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: HubColors.ink)),
                        const Spacer(),
                        Text(_formatEventTimestamp(e.createdAt), style: const TextStyle(fontSize: 11, color: HubColors.muted)),
                      ],
                    ),
                    if (e.notes != null && e.notes!.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Text(e.notes!, style: const TextStyle(fontSize: 12.5, color: HubColors.ink)),
                    ],
                    if (e.trackingNumber != null && e.trackingNumber!.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Text(t.detail.tracking(e.trackingNumber!), style: const TextStyle(fontSize: 12, color: HubColors.muted)),
                    ],
                    if (e.photos.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: e.photos
                            .map((url) => ClipRRect(
                                  borderRadius: BorderRadius.circular(6),
                                  child: CachedNetworkImage(imageUrl: ApiClient.resolveMediaUrl(url), width: 52, height: 52, fit: BoxFit.cover),
                                ))
                            .toList(),
                      ),
                    ],
                    const SizedBox(height: 6),
                    Text(t.detail.by(e.performedBy ?? ''), style: const TextStyle(fontSize: 10.5, color: HubColors.muted)),
                  ],
                ),
              ),
            )),
      ],
    );
  }
}
