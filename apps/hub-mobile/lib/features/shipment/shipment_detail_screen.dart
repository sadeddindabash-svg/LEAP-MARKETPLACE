import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:share_plus/share_plus.dart';
import 'package:path_provider/path_provider.dart';
import '../../core/auth_state.dart';
import '../../core/language_state.dart';
import '../../core/hub_strings.dart';
import '../../core/theme.dart';
import '../../models/shipment.dart';
import '../../services/api_client.dart';
import '../../widgets/status_badge.dart';
import '../../widgets/evidence_photo_picker.dart';
import 'shipping_cost_card.dart';
import 'delivery_status.dart';      // after shipping: on its way, then Delivered (confirmed only with the buyer's code)
import 'inspection_text.dart';      // the inspection list's words (migration 129)
import 'step_flow.dart';      // design C: one step per screen

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

/// Confirmed with the person: the items section's 3 confirmed states
/// -- hidden before inspection, fully interactive only during
/// inspection, read-only afterward.
enum _ItemsCardMode { hidden, interactive, readOnly }

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
    case 'returned_to_supplier':
      return Icons.undo;
    case 'discarded_at_hub':
      return Icons.delete_outline;
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
  final _returnTrackingController = TextEditingController();
  // The faulty-unit panel: send it back to the supplier ('return') or destroy it at the hub ('discard').
  String _returnMode = 'return';
  List<String> _photos = [];
  bool _isUploadingPhoto = false;
  bool _isSubmitting = false;
  bool _showFlagForm = false;
  // The parcel's shipping cost is recorded (and, if it was dearer than planned, approved): "Shipped to buyer" may be pressed (migration 127).
  bool _mayShip = false;
  // at "Packed": the supplier's striped "hub use only" label is removed or covered
  bool _labelCovered = false;
  // Confirmed with the person: one controller per item, initialized
  // lazily as each item's card builds, for the interactive
  // received-quantity input.
  final Map<String, TextEditingController> _receivedControllers = {};
  // Confirmed with the person through several rounds of
  // clarification: which spec labels have been actively confirmed
  // against the physical part, per item.
  final Map<String, Set<String>> _checkedSpecs = {};
  // what still stops "Confirm Inspected" (worked out on each build; the server checks the same)
  List<String> _inspectionMissingNow = const [];
  // Confirmed with the person via mockup: loading state for the
  // delivery-address share action, so the button shows real progress
  // while the PDF is being downloaded and prepared.
  bool _isSharingAddress = false;
  // design C: the page within a step (Inspect: the list, then the photos; Packed: the shipping cost, then Ship), and the status they belong to
  int _inspectPage = 0;
  bool _shipPage = false;
  String? _pageStatus;

  // Everything on this screen is read again every 5 seconds, quietly, so a change made on the hub portal or by Leap appears here by itself.
  Timer? _refreshTimer;
  // what the server had at the last read: a tick or quantity still equal to it has no change of this screen's own, so a newer value may replace it
  final Map<String, Set<String>> _serverChecks = {};
  final Map<String, String> _serverQty = {};

  @override
  void initState() {
    super.initState();
    _load();
    _refreshTimer = Timer.periodic(const Duration(seconds: 5), (_) => _refreshQuietly());
  }

  /// Reads the shipment again without the loading screen; a failed read keeps what is shown. Skipped while a step is being saved.
  Future<void> _refreshQuietly() async {
    if (!mounted || _isSubmitting || _loadState != _LoadState.ready) return;
    final auth = context.read<AuthState>();
    try {
      final data = await ApiClient().fetchMyShipmentById(auth.token!, widget.shipmentId);
      if (!mounted || _isSubmitting) return;
      setState(() {
        _shipment = data;
        _syncFromServer(data);
      });
    } on SessionExpiredError {
      auth.handleSessionExpired();
    } on ApiException {
      // quiet: the screen keeps what it has
    }
  }

  /// Takes the inspection list's ticks and quantities from the server, except where this screen has a change of its own not saved yet.
  void _syncFromServer(ShipmentDetail data) {
    bool same(Set<String> a, Set<String> b) => a.length == b.length && a.containsAll(b);
    for (final item in data.items) {
      final checksNow = item.checkedKeys.toSet();
      final local = _checkedSpecs[item.productId];
      final last = _serverChecks[item.productId];
      if (local == null || last == null || same(local, last)) _checkedSpecs[item.productId] = checksNow;
      _serverChecks[item.productId] = checksNow;
      final qtyNow = item.receivedQuantity?.toString() ?? '';
      final controller = _receivedControllers[item.productId];
      final lastQty = _serverQty[item.productId];
      if (controller != null && lastQty != null && controller.text.trim() == lastQty && controller.text.trim() != qtyNow) controller.text = qtyNow;
      _serverQty[item.productId] = qtyNow;
    }
    // the evidence photos being added (migration 130): the server's list, unless a photo is on its way from this screen
    final drafts = data.draftPhotos?[_draftPurpose(data)];
    if (drafts != null && !_isUploadingPhoto && _draftBusy == 0 && drafts.join('|') != _photos.join('|')) _photos = [...drafts];
  }

  // The photos of the form being filled in are shared with the hub portal (migration 130). Which form: a fault return (flagged), a flag, or the next step.
  int _draftBusy = 0;
  String _draftPurpose(ShipmentDetail s) => s.status == 'flagged' ? 'fault_return' : (_showFlagForm ? 'flag' : 'step');

  Future<void> _shareDraftPhoto(String action, String url) async {
    final shipment = _shipment;
    if (shipment == null) return;
    final purpose = _draftPurpose(shipment);
    final auth = context.read<AuthState>();
    _draftBusy++;
    try {
      final drafts = await ApiClient().saveDraftPhoto(auth.token!, widget.shipmentId, action, purpose, url);
      final mine = drafts[purpose];
      if (mounted && mine != null && !_isUploadingPhoto && _draftBusy == 1) setState(() => _photos = [...mine]);
    } on SessionExpiredError {
      auth.handleSessionExpired();
    } on ApiException {
      // not shared (an older server): the photo still counts on this screen
    } finally {
      _draftBusy--;
    }
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    _notesController.dispose();
    _trackingController.dispose();
    _deliveryNoteController.dispose();
    _returnTrackingController.dispose();
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
      await _refreshQuietly();      // no loading screen: the rest of the screen stays as it is
    } on SessionExpiredError {
      auth.handleSessionExpired();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _errorMessage = e.message);
    }
  }

  /// Confirmed with the person: fixes a real gap where a received-
  /// quantity value only ever saved on the TextField's own
  /// onSubmitted/onEditingComplete -- a worker who typed a value then
  /// tapped straight to "mark as inspected" without first dismissing
  /// the keyboard would silently lose it. Called before advancing any
  /// step, flushing every real controller's current value so nothing
  /// typed is ever lost regardless of how the field was left.
  Future<void> _flushPendingReceivedQuantities() async {
    final auth = context.read<AuthState>();
    for (final entry in _receivedControllers.entries) {
      final parsed = int.tryParse(entry.value.text.trim());
      if (parsed == null || parsed < 0) continue;
      try {
        await ApiClient().recordReceivedQuantity(auth.token!, widget.shipmentId, entry.key, parsed);
      } on ApiException {
        // Real, deliberate: a single item's flush failing shouldn't
        // block the whole step submission -- the main save below
        // still runs, and any genuine issue surfaces from there.
      }
    }
  }

  /// Confirmed with the person via mockup: downloads the real PDF
  /// bytes, saves them to a real temp file (share_plus shares by file
  /// path, not raw bytes), then opens the device's real native share
  /// sheet -- the worker picks WhatsApp, email, a PDF viewer with its
  /// own print option, etc.
  Future<void> _shareAddressLabel() async {
    final auth = context.read<AuthState>();
    setState(() => _isSharingAddress = true);
    try {
      final bytes = await ApiClient().fetchAddressLabelPdf(auth.token!, widget.shipmentId);
      final dir = await getTemporaryDirectory();
      final file = File('${dir.path}/LEAP-address-${widget.shipmentId}.pdf');
      await file.writeAsBytes(bytes);
      if (!mounted) return;
      // Confirmed working for this exact share_plus version
      // (^10.1.2) -- see apps/mobile's own product_screen.dart for
      // the real compile-error history behind this choice:
      // SharePlus.instance/ShareParams does not exist in this real
      // installed version at all.
      await Share.shareXFiles([XFile(file.path)], text: 'Delivery address');
    } on SessionExpiredError {
      auth.handleSessionExpired();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _errorMessage = e.message);
    } finally {
      if (mounted) setState(() => _isSharingAddress = false);
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
        _syncFromServer(data);
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
    await _flushPendingReceivedQuantities();
    final auth = context.read<AuthState>();
    try {
      await ApiClient().recordShipmentEvent(
        auth.token!,
        widget.shipmentId,
        step: step,
        notes: _notesController.text.trim().isEmpty ? null : _notesController.text.trim(),
        photos: _photos,
        trackingNumber: step == 'shipped_to_buyer' ? _trackingController.text.trim() : null,
        supplierLabelCovered: step == 'packed' ? _labelCovered : null,
      );
      if (!mounted) return;
      _notesController.clear();
      _trackingController.clear();
      setState(() {
        _photos = [];
        _labelCovered = false;
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

  /// A real fault was confirmed by the platform: record that the faulty unit was sent back to the supplier (return tracking number required) or
  /// discarded at the hub. Same rules as the web hub portal: at least one evidence photo, and a tracking number for a return.
  Future<void> _submitFaultReturn() async {
    final t = kHubStrings[context.read<LanguageState>().language]!;
    final step = _returnMode == 'return' ? 'returned_to_supplier' : 'discarded_at_hub';
    if (_photos.isEmpty) {
      setState(() => _errorMessage = t.detail.errPhotoRequired);
      return;
    }
    if (step == 'returned_to_supplier' && _returnTrackingController.text.trim().isEmpty) {
      setState(() => _errorMessage = t.detail.errReturnTrackingRequired);
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
        trackingNumber: step == 'returned_to_supplier' ? _returnTrackingController.text.trim() : null,
      );
      if (!mounted) return;
      _notesController.clear();
      _returnTrackingController.clear();
      setState(() => _photos = []);
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
    // Delivered, or anywhere in the flagged family (flagged, returned to the supplier, discarded): nothing more to ADVANCE.
    final isTerminal = shipment.status == 'delivered' || kFlaggedStatuses.contains(shipment.status);
    final needsDeliveryConfirmation = shipment.status == 'shipped_to_buyer';
    // A real fault was confirmed and the faulty unit is still at this hub: it must be sent back or discarded.
    final needsFaultReturn = shipment.needsFaultReturn;
    // Confirmed with the person through several rounds of
    // clarification: can't mark a shipment as inspected until every
    // real spec on every real item has been actively confirmed
    // against the physical part -- only relevant for this specific
    // real status transition (receiving and opening the package stay
    // ungated; the detailed real verification belongs at inspection).
    // The inspection list (migration 129): every line ticked and every item's received quantity entered, and equal to the order (a different
    // quantity is flagged; it goes on only after Leap chose to continue). The same as the hub portal; the server refuses it otherwise.
    _inspectionMissingNow = nextStatus == 'inspected' ? _inspectionMissing(shipment, _ix) : const <String>[];
    final allChecksConfirmed = _inspectionMissingNow.isEmpty;
    // Confirmed with the person through several rounds of
    // clarification: the items section is hidden before inspection
    // (nothing to verify yet), fully interactive (checklist + real
    // editable received-quantity input) only during the real
    // inspection stage itself, then read-only afterward -- so a
    // shipping worker can still see what's actually being shipped
    // without re-editing already-confirmed real data.
    final itemsCardMode = nextStatus == 'inspected'
        ? _ItemsCardMode.interactive
        : (shipment.status == 'awaiting_receipt' || shipment.status == 'received')
            ? _ItemsCardMode.hidden
            : _ItemsCardMode.readOnly;
    // Deliberate, noted fix from the web app's own real behavior: also
    // gated on nextStatus != null, so this card doesn't render at the
    // shipped_to_buyer status with an empty title/hint/button label --
    // the confirm-delivery card below is the real, correct action at
    // that status instead.
    final showMainStepForm = !isTerminal && !_showFlagForm && nextStatus != null;

    // ---- Design C (confirmed with the person via mockup): one step per screen ----
    final lang = context.watch<LanguageState>().language;
    final f = kStepFlowText[lang] ?? kStepFlowText['en']!;
    if (_pageStatus != shipment.status) {      // the parcel moved on (here, or on the hub portal): its new step starts at its first page
      _pageStatus = shipment.status;
      _inspectPage = 0;
      _shipPage = false;
    }
    final flagged = kFlaggedStatuses.contains(shipment.status);
    final step = stepIndexFor(shipment.status, shipPage: _shipPage);
    final onPhotosPage = shipment.status == 'opened' && _inspectPage == 1 && !_showFlagForm;
    final onShipPage = shipment.status == 'packed' && _shipPage && !_showFlagForm;
    final String title;
    final String hint;
    if (_showFlagForm && !isTerminal) {
      title = t.detail.flagTitle;
      hint = '${f.titles[step]} · ${shipment.supplierName}';
    } else if (flagged) {
      title = t.steps[shipment.displayStatus]?.label ?? f.flaggedTitle;
      hint = shipment.supplierName;
    } else if (onPhotosPage) {
      title = f.photosTitle;
      hint = f.photosHint;
    } else {
      title = f.titles[step];
      hint = f.hints[step];
    }
    final goBack = (_showFlagForm && !isTerminal) || onPhotosPage || onShipPage;

    final body = <Widget>[
      if (shipment.replacementFor != null) ...[
        _buildReplacementBanner(t, shipment.replacementFor!),
        const SizedBox(height: 10),
      ],
      if (_errorMessage != null)
        Container(
          width: double.infinity,
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: HubColors.redBg, borderRadius: BorderRadius.circular(12)),
          child: Text(_errorMessage!, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: HubColors.red)),
        ),
      ..._stepBody(t, f, shipment, flagged, needsFaultReturn, isTerminal, needsDeliveryConfirmation),
    ];

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,      // white status-bar icons on the dark header
      child: Scaffold(
        backgroundColor: HubColors.canvas,
        body: Column(
          children: [
            StepHeader(
              orderId: shipment.orderId,
              subtitle: shipment.supplierName,
              badge: shipment.totalShipments > 1 ? '${shipment.shipmentIndex} / ${shipment.totalShipments}' : null,
              step: step,
              allDone: shipment.status == 'delivered',
              red: flagged || (_showFlagForm && !isTerminal),
              title: title,
              hint: hint,
              stepOf: f.stepOf.replaceAll('{n}', '${step + 1}'),
              back: goBack,
              onLeading: () {
                if (!goBack) {
                  Navigator.of(context).maybePop();
                  return;
                }
                setState(() {
                  if (_showFlagForm) {
                    _showFlagForm = false;
                  } else if (onPhotosPage) {
                    _inspectPage = 0;
                  } else {
                    _shipPage = false;
                  }
                  _errorMessage = null;
                });
              },
              onDetails: () => _showDetailsSheet(t, f, shipment, itemsCardMode),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(14, 14, 14, 24),
                children: body,
              ),
            ),
            if (showMainStepForm || needsDeliveryConfirmation || shipment.status == 'delivered')
              _stepBottomBar(t, f, shipment, stepText, nextStatus, allChecksConfirmed, onPhotosPage, onShipPage),
          ],
        ),
      ),
    );
  }

  /// What this step's screen shows (only what the step needs).
  List<Widget> _stepBody(HubText t, StepFlowText f, ShipmentDetail shipment, bool flagged, bool needsFaultReturn, bool isTerminal, bool onItsWay) {
    if (flagged) {
      return [
        if (needsFaultReturn) _buildFaultPanel(t, shipment) else _buildTerminalBanner(t, shipment),
        const SizedBox(height: 16),
        _buildHistory(t, shipment),
      ];
    }
    if (onItsWay || shipment.status == 'delivered') {
      return [
        DeliveryStatusCard(shipment: shipment, language: Provider.of<LanguageState>(context, listen: false).language),
        const SizedBox(height: 16),
        _buildHistory(t, shipment),
      ];
    }
    if (_showFlagForm) return [_buildFlagForm(t)];
    switch (shipment.status) {
      case 'awaiting_receipt':
        return [
          StepCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                stepSection(f.from),
                Text(shipment.supplierName, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: HubColors.ink)),
                const SizedBox(height: 2),
                Text(shipment.items.map((i) => '${i.name} × ${i.quantity}').join(' · '), style: const TextStyle(fontSize: 12.5, color: HubColors.muted)),
              ],
            ),
          ),
          _stepPhotos(t),
          _stepNotes(t),
        ];
      case 'received':
        return [
          _stepPhotos(t),
          StepCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                stepSection(f.expectedInside),
                ...shipment.items.map((i) => Padding(
                      padding: const EdgeInsets.symmetric(vertical: 2),
                      child: Text('${i.name} × ${i.quantity}', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: HubColors.ink)),
                    )),
              ],
            ),
          ),
          _stepNotes(t),
        ];
      case 'opened':
        if (_inspectPage == 1) return [_stepPhotos(t), _stepNotes(t)];
        return [
          _buildItemsCard(t, shipment, _ItemsCardMode.interactive),
          const SizedBox(height: 4),
          _buildInspectionStatus(),
        ];
      case 'inspected':
        return [
          _buildLabelTick(),
          if (shipment.deliveryAddress != null) ...[
            _buildDeliveryAddressCard(shipment.deliveryAddress!),
            const SizedBox(height: 10),
          ],
          _stepPhotos(t),
          _stepNotes(t),
        ];
      case 'packed':
        if (!_shipPage) {
          return [
            ShippingCostCard(shipmentId: widget.shipmentId, token: context.read<AuthState>().token!, onChange: (v) => setState(() => _mayShip = v)),
          ];
        }
        return [
          StepCard(
            color: HubColors.gaugeBg,
            border: const Color(0xFFBFE6D2),
            child: Text('✓ ${f.costApproved}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: HubColors.gauge)),
          ),
          StepCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                stepSection(t.detail.trackingNumber),
                TextField(
                  key: const Key('tracking-to-buyer'),
                  controller: _trackingController,
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                  onChanged: (_) => setState(() {}),      // the button follows what is typed
                ),
              ],
            ),
          ),
          _stepPhotos(t),
          _stepNotes(t),
        ];
      default:
        return [_buildHistory(t, shipment)];
    }
  }

  /// The one big button at the bottom. Grey, and saying what is missing, while it cannot be pressed.
  Widget _stepBottomBar(HubText t, StepFlowText f, ShipmentDetail shipment, StepText? stepText, String? nextStatus, bool allChecksConfirmed,
      bool onPhotosPage, bool onShipPage) {
    void openFlag() => setState(() {
          _showFlagForm = true;
          _photos = [];
          _notesController.clear();
          _errorMessage = null;
        });
    if (shipment.status == 'shipped_to_buyer' || shipment.status == 'delivered') {
      return StepBottomBar(label: f.backToList, color: HubColors.ink, onPressed: () => Navigator.of(context).maybePop());
    }
    if (shipment.status == 'opened' && !onPhotosPage) {
      final left = _inspectionMissingNow.length;
      return StepBottomBar(
        label: left == 0 ? f.nextPhotos : '${f.nextPhotos} (${f.checksLeft(left)})',
        onPressed: allChecksConfirmed ? () => setState(() { _inspectPage = 1; _errorMessage = null; }) : null,
        flagLabel: f.flag,
        onFlag: openFlag,
      );
    }
    if (shipment.status == 'packed' && !onShipPage) {
      return StepBottomBar(
        label: _mayShip ? f.nextShip : f.needCost,
        onPressed: _mayShip ? () => setState(() { _shipPage = true; _errorMessage = null; }) : null,
        flagLabel: f.flag,
        onFlag: openFlag,
      );
    }
    String? missing;
    if (_photos.isEmpty) missing = f.needPhoto;
    if (nextStatus == 'packed' && !_labelCovered) missing = f.needLabel;
    if (nextStatus == 'shipped_to_buyer' && _trackingController.text.trim().isEmpty) missing = f.needTracking;
    if (nextStatus == 'shipped_to_buyer' && !_mayShip) missing = f.needCost;
    if (nextStatus == 'inspected' && !allChecksConfirmed) missing = f.checksLeft(_inspectionMissingNow.length);      // changed meanwhile on the hub portal
    final canGo = missing == null && allChecksConfirmed && nextStatus != null && !_isSubmitting && !_isUploadingPhoto;
    return StepBottomBar(
      label: _isSubmitting ? t.detail.saving : (missing ?? '${stepText?.actionLabel ?? ''} ✓'),
      onPressed: canGo ? () => _submitStep(nextStatus!) : null,
      flagLabel: onPhotosPage ? null : f.flag,
      onFlag: openFlag,
    );
  }

  /// The evidence photos of this step (shared with the hub portal), in a card.
  Widget _stepPhotos(HubText t) {
    final auth = context.read<AuthState>();
    return StepCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          stepSection(t.detail.evidencePhotos),
          EvidencePhotoPicker(
            photoUrls: _photos,
            onAdd: (url) {
              setState(() => _photos = [..._photos, url]);
              _shareDraftPhoto('add', url);      // kept on the server for this step, so the hub portal shows it too
            },
            onRemove: (url) {
              setState(() => _photos = _photos.where((p) => p != url).toList());
              _shareDraftPhoto('remove', url);
            },
            isUploading: _isUploadingPhoto,
            onUploadingChanged: (v) => setState(() => _isUploadingPhoto = v),
            onError: (msg) => setState(() => _errorMessage = msg),
            token: auth.token!,
          ),
        ],
      ),
    );
  }

  Widget _stepNotes(HubText t) => StepCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            stepSection(t.detail.notes),
            TextField(controller: _notesController, maxLines: 2),
          ],
        ),
      );

  /// Pack: the supplier's striped "hub use only" label must be removed or covered (the server checks it too).
  Widget _buildLabelTick() {
    final zh = Provider.of<LanguageState>(context, listen: false).language == 'zh';
    return Column(
      children: [
        Container(
          width: double.infinity,
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: HubColors.amberBg, border: Border.all(color: const Color(0xFFF5D9A8)), borderRadius: BorderRadius.circular(14)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(zh ? '⚠ 供应商→质检中心标签：仅限质检中心' : '⚠ Supplier→hub label: HUB USE ONLY', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: HubColors.ink)),
              const SizedBox(height: 2),
              Text(zh ? '换新箱，或用派送标签完全覆盖它' : 'Use a new box, or stick the buyer label fully over it', style: const TextStyle(fontSize: 12, color: HubColors.muted)),
            ],
          ),
        ),
        InkWell(
          key: const Key('supplier-label-tick'),
          onTap: () => setState(() => _labelCovered = !_labelCovered),
          borderRadius: BorderRadius.circular(14),
          child: Container(
            width: double.infinity,
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: _labelCovered ? HubColors.gaugeBg : HubColors.card, border: Border.all(color: _labelCovered ? HubColors.gauge : HubColors.line, width: 1.5), borderRadius: BorderRadius.circular(14)),
            child: Row(
              children: [
                Icon(_labelCovered ? Icons.check_box : Icons.check_box_outline_blank, size: 26, color: _labelCovered ? HubColors.gauge : HubColors.muted),
                const SizedBox(width: 10),
                Expanded(child: Text(zh ? '供应商标签已撕除或已完全覆盖' : "The supplier's label is removed or fully covered", style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: HubColors.ink))),
              ],
            ),
          ),
        ),
      ],
    );
  }

  /// The ⟲ button in the header: the items, the order's other parcels and the full history, in a sheet.
  void _showDetailsSheet(HubText t, StepFlowText f, ShipmentDetail shipment, _ItemsCardMode itemsMode) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: HubColors.canvas,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(18))),
      builder: (_) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.7,
        maxChildSize: 0.95,
        builder: (context, controller) => ListView(
          controller: controller,
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
          children: [
            Text(f.details, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: HubColors.ink)),
            const SizedBox(height: 12),
            if (itemsMode != _ItemsCardMode.hidden) ...[
              _buildItemsCard(t, shipment, _ItemsCardMode.readOnly),
              const SizedBox(height: 10),
            ] else
              StepCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    stepSection(f.items),
                    ...shipment.items.map((i) => Text('${i.name} × ${i.quantity}', style: const TextStyle(fontSize: 13.5, color: HubColors.ink))),
                  ],
                ),
              ),
            if (_deliveryAddressVisibleFor(shipment.status) && shipment.deliveryAddress != null) ...[
              _buildDeliveryAddressCard(shipment.deliveryAddress!),
              const SizedBox(height: 10),
            ],
            ...shipment.otherShipments.map((s) => Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Text('Other shipment: ${s.supplierName} — ${s.status.replaceAll('_', ' ')}', style: const TextStyle(fontSize: 11.5, color: HubColors.muted)),
                )),
            const SizedBox(height: 6),
            _buildHistory(t, shipment),
          ],
        ),
      ),
    );
  }

  /// − and + beside the received quantity (bigger targets than typing).
  Widget _qtyButton(IconData icon, VoidCallback onTap) => InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          width: 40,
          height: 40,
          alignment: Alignment.center,
          decoration: BoxDecoration(border: Border.all(color: HubColors.line), borderRadius: BorderRadius.circular(8)),
          child: Icon(icon, size: 20, color: HubColors.ink),
        ),
      );

  void _stepQuantity(ShipmentItem item, TextEditingController c, int by) {
    final now = int.tryParse(c.text.trim());
    final next = now == null ? (by > 0 ? 1 : 0) : (now + by < 0 ? 0 : now + by);
    c.text = '$next';
    setState(() {});
    _saveReceivedQuantity(item.productId, c.text);
  }

  /// Confirmed with the person via mockup: the real delivery address
  /// card shows from the moment inspection is genuinely done onward
  /// -- an explicit set rather than index arithmetic on kStatusOrder,
  /// since 'delivered' is a genuine terminal status not present in
  /// that list at all and would otherwise be silently excluded.
  bool _deliveryAddressVisibleFor(String status) =>
      const {'inspected', 'packed', 'shipped_to_buyer', 'delivered'}.contains(status);

  Widget _buildDeliveryAddressCard(DeliveryAddress address) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: HubColors.card, border: Border.all(color: HubColors.line), borderRadius: BorderRadius.circular(10)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(Provider.of<LanguageState>(context, listen: false).language == 'zh' ? '收货地址' : 'DELIVERY ADDRESS', style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: HubColors.muted)),
          const SizedBox(height: 10),
          Text(address.recipientName, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: HubColors.ink)),
          const SizedBox(height: 4),
          Text(address.phone, style: const TextStyle(fontSize: 12.5, color: HubColors.muted)),
          const SizedBox(height: 6),
          Text(address.streetAddress, style: const TextStyle(fontSize: 12.5, color: HubColors.muted)),
          Text('${address.city}, ${address.country}', style: const TextStyle(fontSize: 12.5, color: HubColors.muted)),
          if (address.postalCode != null) Text(address.postalCode!, style: const TextStyle(fontSize: 12.5, color: HubColors.muted)),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: _isSharingAddress ? null : _shareAddressLabel,
              icon: _isSharingAddress
                  ? const SizedBox(height: 14, width: 14, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.share_outlined, size: 16),
              label: Text(Provider.of<LanguageState>(context, listen: false).language == 'zh'
                  ? (_isSharingAddress ? '准备中…' : '分享 / 打印地址')
                  : (_isSharingAddress ? 'Preparing…' : 'Share / print address')),
              style: OutlinedButton.styleFrom(side: const BorderSide(color: HubColors.signal), foregroundColor: HubColors.signal),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildItemsCard(HubText t, ShipmentDetail shipment, _ItemsCardMode mode) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: HubColors.card, border: Border.all(color: HubColors.line), borderRadius: BorderRadius.circular(10)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text((mode == _ItemsCardMode.interactive ? _ix.title : t.detail.items).toUpperCase(), style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: HubColors.muted)),
          const SizedBox(height: 8),
          ...shipment.items.map((item) => _buildItemVerificationRow(item, mode)),
        ],
      ),
    );
  }

  /// The inspection list (migration 129): the server builds it, so the hub portal shows exactly the same lines (part, OEM, position, specs, and
  /// the condition line). The ticks are saved on the server as they are made, so work started here can be finished on the portal.
  InspectionText get _ix => kInspectionText[Provider.of<LanguageState>(context, listen: false).language] ?? kInspectionText['en']!;

  /// The received quantity as typed (or as saved), or null when it is empty or not a whole number.
  int? _receivedNow(ShipmentItem item) {
    final c = _receivedControllers[item.productId];
    if (c == null) return item.receivedQuantity;
    final v = int.tryParse(c.text.trim());
    return (v == null || v < 0) ? null : v;
  }

  /// What still stops "Confirm Inspected", one line per problem (empty: it may go on). The server checks the same.
  List<String> _inspectionMissing(ShipmentDetail shipment, InspectionText x) {
    final out = <String>[];
    for (final item in shipment.items) {
      final checked = _checkedSpecs[item.productId] ?? item.checkedKeys.toSet();
      final left = item.checklist.where((c) => !checked.contains(c.key)).length;
      if (left > 0) out.add(x.needChecks(item.name, left));
      final received = _receivedNow(item);
      if (received == null) {
        out.add(x.needQuantity(item.name));
      } else if (received != item.quantity && shipment.resolution != 'continue_processing') {
        out.add(x.needFlag(item.name, received, item.quantity));
      }
    }
    return out;
  }

  Future<void> _saveChecks(String productId, Set<String> before) async {
    final auth = context.read<AuthState>();
    try {
      final saved = {...(_checkedSpecs[productId] ?? <String>{})};
      await ApiClient().saveInspectionChecks(auth.token!, widget.shipmentId, productId, saved.toList());
      _serverChecks[productId] = saved;
    } on SessionExpiredError {
      auth.handleSessionExpired();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _checkedSpecs[productId] = before;      // not saved: the tick goes back, so what is shown is what the server has
        _errorMessage = e.isNetworkError ? _ix.saveFailed : e.message;
      });
    }
  }

  void _setChecks(ShipmentItem item, Set<String> next) {
    final before = {...(_checkedSpecs[item.productId] ?? <String>{})};
    setState(() => _checkedSpecs[item.productId] = next);
    _saveChecks(item.productId, before);
  }

  Widget _buildItemVerificationRow(ShipmentItem item, _ItemsCardMode mode) {
    final x = _ix;
    final lang = Provider.of<LanguageState>(context, listen: false).language;      // build already watches the language
    final controller = _receivedControllers.putIfAbsent(
      item.productId,
      () => TextEditingController(text: item.receivedQuantity?.toString() ?? ''),
    );
    final received = mode == _ItemsCardMode.interactive ? _receivedNow(item) : item.receivedQuantity;
    final hasMismatch = received != null && received != item.quantity;
    final missingQuantity = mode == _ItemsCardMode.interactive && received == null;
    final specs = item.checklist;
    final checked = _checkedSpecs.putIfAbsent(item.productId, () => item.checkedKeys.toSet());
    // the list itself shows only while inspecting; before it is hidden, after it the quantity is shown read-only
    final showChecklist = mode == _ItemsCardMode.interactive;
    final quantityColor = hasMismatch || missingQuantity ? HubColors.red : HubColors.gauge;
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
          Text('${item.name} × ${item.quantity}', style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: HubColors.ink)),
          if (showChecklist && specs.isNotEmpty) ...[
            const SizedBox(height: 6),
            ...specs.map((c) {
              final isChecked = checked.contains(c.key);
              return InkWell(
                key: Key('check-${item.productId}-${c.key}'),
                onTap: () => _setChecks(item, isChecked ? ({...checked}..remove(c.key)) : ({...checked}..add(c.key))),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Row(
                    children: [
                      Icon(isChecked ? Icons.check_box : Icons.check_box_outline_blank, size: 26, color: isChecked ? HubColors.gauge : HubColors.muted),
                      const SizedBox(width: 10),
                      Expanded(child: Text(c.label(lang), style: TextStyle(fontSize: 14, color: isChecked ? HubColors.ink : HubColors.muted))),
                    ],
                  ),
                ),
              );
            }),
            const SizedBox(height: 2),
            Row(
              children: [
                Text(x.checksDone(specs.where((c) => checked.contains(c.key)).length, specs.length), style: const TextStyle(fontSize: 10.5, color: HubColors.muted)),
                const Spacer(),
                if (specs.any((c) => !checked.contains(c.key)))
                  InkWell(
                    onTap: () => _setChecks(item, specs.map((c) => c.key).toSet()),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 3),
                      child: Text(x.checkAll, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: HubColors.torque)),
                    ),
                  ),
              ],
            ),
          ],
          const SizedBox(height: 6),
          Row(
            children: [
              Text('${x.ordered}: ${item.quantity}', style: const TextStyle(fontSize: 12, color: HubColors.muted)),
              const Spacer(),
              Text(
                '${x.received}:',
                style: TextStyle(fontSize: 12, fontWeight: hasMismatch ? FontWeight.w700 : FontWeight.w400, color: hasMismatch ? HubColors.red : HubColors.muted),
              ),
              const SizedBox(width: 6),
              if (mode == _ItemsCardMode.readOnly)
                Text(
                  item.receivedQuantity?.toString() ?? '—',
                  style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: hasMismatch ? HubColors.red : HubColors.ink),
                )
              else ...[
                _qtyButton(Icons.remove, () => _stepQuantity(item, controller, -1)),
                const SizedBox(width: 6),
                SizedBox(
                  width: 52,
                  height: 40,
                  child: TextField(
                    key: Key('received-${item.productId}'),
                    controller: controller,
                    keyboardType: TextInputType.number,
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: hasMismatch ? HubColors.red : HubColors.ink),
                    decoration: InputDecoration(
                      isDense: true,
                      filled: missingQuantity,
                      fillColor: HubColors.redBg,
                      contentPadding: const EdgeInsets.symmetric(vertical: 6),
                      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(6), borderSide: BorderSide(color: quantityColor, width: 1.5)),
                      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(6), borderSide: BorderSide(color: quantityColor, width: 2)),
                    ),
                    onChanged: (_) => setState(() {}),      // the "still needed" list follows what is typed
                    onSubmitted: (value) => _saveReceivedQuantity(item.productId, value),
                    onEditingComplete: () => _saveReceivedQuantity(item.productId, controller.text),
                  ),
                ),
                const SizedBox(width: 6),
                _qtyButton(Icons.add, () => _stepQuantity(item, controller, 1)),
              ],
            ],
          ),
          if (missingQuantity) ...[
            const SizedBox(height: 6),
            Text(x.enterQuantity, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: HubColors.red)),
          ] else if (hasMismatch && mode == _ItemsCardMode.interactive && _shipment?.resolution != 'continue_processing') ...[
            const SizedBox(height: 6),
            Text(x.mismatchHint, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: HubColors.red)),
          ],
        ],
      ),
    );
  }

  /// Under the inspecting step's button: what is still missing (red), or that everything is confirmed (green).
  Widget _buildInspectionStatus() {
    final x = _ix;
    if (_inspectionMissingNow.isEmpty) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(color: HubColors.gaugeBg, borderRadius: BorderRadius.circular(10)),
        child: Text('✓ ${x.allDone}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: HubColors.gauge)),
      );
    }
    return Container(
      key: const Key('inspection-missing'),
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(color: HubColors.redBg, borderRadius: BorderRadius.circular(10)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(x.stillNeeded, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: HubColors.red)),
          const SizedBox(height: 4),
          ..._inspectionMissingNow.map((line) => Text('• $line', style: const TextStyle(fontSize: 12, color: HubColors.red))),
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
            onAdd: (url) {
              setState(() => _photos = [..._photos, url]);
              _shareDraftPhoto('add', url);      // kept on the server for this step, so the hub portal shows it too
            },
            onRemove: (url) {
              setState(() => _photos = _photos.where((p) => p != url).toList());
              _shareDraftPhoto('remove', url);
            },
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
          if (nextStatus == 'packed') ...[
            // the supplier's striped "hub use only" label must be removed or covered before "Confirm Packed" (the server checks it too)
            const SizedBox(height: 16),
            InkWell(
              key: const Key('supplier-label-tick'),
              onTap: () => setState(() => _labelCovered = !_labelCovered),
              child: Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(color: _labelCovered ? HubColors.gaugeBg : HubColors.redBg, border: Border.all(color: _labelCovered ? HubColors.gauge : HubColors.red, width: 1.5), borderRadius: BorderRadius.circular(10)),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(_labelCovered ? Icons.check_box : Icons.check_box_outline_blank, size: 20, color: _labelCovered ? HubColors.gauge : HubColors.red),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(Provider.of<LanguageState>(context, listen: false).language == 'zh' ? '供应商标签已撕除或已完全覆盖' : "The supplier's label is removed or fully covered", style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: HubColors.ink)),
                          const SizedBox(height: 2),
                          Text(Provider.of<LanguageState>(context, listen: false).language == 'zh' ? '条纹“仅限质检中心”标签——换新箱，或用派送标签覆盖' : 'The striped "hub use only" label: a new box, or the delivery label stuck over it', style: const TextStyle(fontSize: 11.5, color: HubColors.muted)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
          if (nextStatus == 'inspected') ...[
            const SizedBox(height: 12),
            _buildInspectionStatus(),
          ],
          const SizedBox(height: 18),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: (_isSubmitting || !allChecksConfirmed || (nextStatus == 'shipped_to_buyer' && !_mayShip) || (nextStatus == 'packed' && !_labelCovered)) ? null : () => _submitStep(nextStatus),
              style: ElevatedButton.styleFrom(backgroundColor: (_isSubmitting || !allChecksConfirmed || (nextStatus == 'shipped_to_buyer' && !_mayShip) || (nextStatus == 'packed' && !_labelCovered)) ? const Color(0xFFD1D5DB) : HubColors.signal),
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
            onAdd: (url) {
              setState(() => _photos = [..._photos, url]);
              _shareDraftPhoto('add', url);      // kept on the server for this step, so the hub portal shows it too
            },
            onRemove: (url) {
              setState(() => _photos = _photos.where((p) => p != url).toList());
              _shareDraftPhoto('remove', url);
            },
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

  Widget _buildReplacementBanner(HubText t, String orderId) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: HubColors.torqueBg, borderRadius: BorderRadius.circular(10)),
      child: Text(
        '${t.detail.replacementFor} $orderId ${t.detail.replacementHint}',
        style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: HubColors.torque),
      ),
    );
  }

  /// Where to send the faulty unit: the supplier's return address (the label itself is printed from the web portal).
  Widget _buildReturnAddressCard(HubText t, ReturnAddress address) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: HubColors.card, border: Border.all(color: HubColors.line), borderRadius: BorderRadius.circular(10)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(t.detail.sendTo.toUpperCase(), style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: HubColors.muted)),
          const SizedBox(height: 6),
          Text(address.contactName, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: HubColors.ink)),
          Text(address.phone, style: const TextStyle(fontSize: 13, color: HubColors.ink)),
          const SizedBox(height: 4),
          Text(address.address, style: const TextStyle(fontSize: 13, color: HubColors.ink)),
        ],
      ),
    );
  }

  Widget _buildModeButton(String label, String mode) {
    final selected = _returnMode == mode;
    return OutlinedButton(
      onPressed: () => setState(() {
        _returnMode = mode;
        _errorMessage = null;
      }),
      style: OutlinedButton.styleFrom(
        side: BorderSide(color: selected ? HubColors.ink : HubColors.line),
        backgroundColor: selected ? HubColors.card : Colors.transparent,
        foregroundColor: HubColors.ink,
        padding: const EdgeInsets.symmetric(vertical: 12),
      ),
      child: Text(label, style: TextStyle(fontSize: 12.5, fontWeight: selected ? FontWeight.w800 : FontWeight.w600)),
    );
  }

  /// A real fault was confirmed by the platform: this hub has to deal with the faulty unit. It can say NOTHING about money or who decided what
  /// (the server never sends that to a hub).
  Widget _buildFaultPanel(HubText t, ShipmentDetail shipment) {
    final auth = context.read<AuthState>();
    final fault = shipment.faultCase!;
    final returning = _returnMode == 'return';
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
              Expanded(child: Text(t.detail.faultTitle, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: HubColors.ink))),
            ],
          ),
          const SizedBox(height: 4),
          Text(t.detail.faultDesc, style: const TextStyle(fontSize: 12.5, color: HubColors.muted)),
          const SizedBox(height: 6),
          Text(t.detail.waitingOnHub, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: HubColors.red)),
          const SizedBox(height: 12),
          Text(t.detail.faultItems.toUpperCase(), style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: HubColors.muted)),
          const SizedBox(height: 6),
          ...fault.items.map((i) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 2),
                child: Text('${i.name} × ${i.quantity}', style: const TextStyle(fontSize: 13, color: HubColors.ink)),
              )),
          if (returning) ...[
            const SizedBox(height: 14),
            if (fault.returnAddress != null)
              _buildReturnAddressCard(t, fault.returnAddress!)
            else
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: HubColors.amberBg, borderRadius: BorderRadius.circular(10)),
                child: Text(t.detail.noReturnAddress, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: HubColors.amber)),
              ),
          ],
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(child: _buildModeButton(t.detail.returnOption, 'return')),
              const SizedBox(width: 8),
              Expanded(child: _buildModeButton(t.detail.discardOption, 'discard')),
            ],
          ),
          const SizedBox(height: 14),
          Text(t.detail.evidencePhotos.toUpperCase(), style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: HubColors.muted)),
          const SizedBox(height: 8),
          EvidencePhotoPicker(
            photoUrls: _photos,
            onAdd: (url) {
              setState(() => _photos = [..._photos, url]);
              _shareDraftPhoto('add', url);      // kept on the server for this step, so the hub portal shows it too
            },
            onRemove: (url) {
              setState(() => _photos = _photos.where((p) => p != url).toList());
              _shareDraftPhoto('remove', url);
            },
            isUploading: _isUploadingPhoto,
            onUploadingChanged: (v) => setState(() => _isUploadingPhoto = v),
            onError: (msg) => setState(() => _errorMessage = msg),
            token: auth.token!,
          ),
          if (returning) ...[
            const SizedBox(height: 16),
            Text(t.detail.returnTracking.toUpperCase(), style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: HubColors.muted)),
            const SizedBox(height: 8),
            TextField(controller: _returnTrackingController),
          ],
          const SizedBox(height: 18),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _isSubmitting ? null : _submitFaultReturn,
              style: ElevatedButton.styleFrom(backgroundColor: _isSubmitting ? const Color(0xFFD1D5DB) : HubColors.red),
              child: Text(_isSubmitting ? t.detail.saving : (returning ? t.detail.submitReturn : t.detail.submitDiscard)),
            ),
          ),
        ],
      ),
    );
  }

  /// The shipment has reached a final state for the hub: delivered, flagged and waiting for the platform, the faulty unit gone, or a flag the platform closed.
  Widget _buildTerminalBanner(HubText t, ShipmentDetail shipment) {
    final isDelivered = shipment.status == 'delivered';
    final String message;
    if (isDelivered) {
      message = t.detail.completedBanner;
    } else if (shipment.status == 'returned_to_supplier') {
      message = t.detail.returnedBanner;
    } else if (shipment.status == 'discarded_at_hub') {
      message = t.detail.discardedBanner;
    } else if (shipment.resolution != null) {
      message = t.detail.resolvedBanners[shipment.resolution] ?? t.detail.flaggedBanner;
    } else {
      message = t.detail.flaggedBanner;
    }
    final stage = (shipment.faultCase != null && !shipment.needsFaultReturn) ? t.detail.stage[shipment.faultCase!.platformStage] : null;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: isDelivered ? HubColors.gaugeBg : HubColors.redBg, borderRadius: BorderRadius.circular(10)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(message, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: isDelivered ? HubColors.gauge : HubColors.red)),
          if (stage != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text(stage, style: const TextStyle(fontSize: 12.5, color: HubColors.ink))),
        ],
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
                    if (e.performedBy != null && e.performedBy!.isNotEmpty) Text(t.detail.by(e.performedBy!), style: const TextStyle(fontSize: 10.5, color: HubColors.muted)),
                  ],
                ),
              ),
            )),
      ],
    );
  }
}
