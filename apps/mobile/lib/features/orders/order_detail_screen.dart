import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme.dart';
import '../../core/app_strings.dart';
import '../../core/auth_state.dart';
import '../../services/api_client.dart';
import '../../widgets/plate_chip.dart';

/// BUY-052/053: order detail, showing the real per-supplier split (the
/// buyer placed one order, but it's fulfilled by potentially multiple
/// suppliers — same structure the admin dashboard and supplier portal
/// already show). Each supplier's line lets the buyer request a return
/// for that specific portion via POST /returns — routed through the
/// Platform, never contacting the supplier directly (see the backend
/// module's header comment for why that's structural, not just UI).
class OrderDetailScreen extends StatefulWidget {
  final String orderId;
  const OrderDetailScreen({super.key, required this.orderId});

  @override
  State<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends State<OrderDetailScreen> {
  Map<String, dynamic>? _order;
  String? _errorMessage;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final auth = context.read<AuthState>();
    if (!auth.isLoggedIn) return;
    setState(() => _isLoading = true);
    try {
      final order = await ApiClient().fetchOrderDetail(auth.token!, widget.orderId);
      setState(() {
        _order = order;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = trRead(context, 'could_not_load_order');
        _isLoading = false;
      });
    }
  }

  void _openReturnRequest(int subOrderId, String supplierLabel) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) => _ReturnRequestSheet(
        subOrderId: subOrderId,
        supplierLabel: supplierLabel,
        onSubmitted: () {
          Navigator.of(context).pop();
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(trRead(context, 'return_request_sent')),
              // Real deep link straight to the new case in My Returns
              // (see returns_screen.dart) -- otherwise a buyer who just
              // filed a return has no obvious next step to go check on it.
              action: SnackBarAction(label: trRead(context, 'view'), onPressed: () => context.push('/returns')),
            ),
          );
        },
      ),
    );
  }

  // Real "pending address" banner (migration 030) -- a real, honest
  // state shown instead of a silently missing shipping address. Real
  // guests reach this after declining/skipping the geolocation
  // suggestion at checkout; a real logged-in buyer should never
  // actually see this (their address is required at checkout), but
  // it's handled here too in case of any real edge case.
  Widget _buildPendingAddressBanner() {
    final isAr = Localizations.localeOf(context).languageCode == 'ar';
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: const Color(0xFFFDF1EB), borderRadius: BorderRadius.circular(10)),
      child: Row(
        children: [
          const Icon(Icons.location_off_outlined, size: 18, color: LeapColors.signal),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              isAr ? 'الطلب معلّق حتى تؤكد عنوان التسليم.' : 'Order pending — add your delivery address to continue.',
              style: const TextStyle(fontSize: 12.5, color: LeapColors.ink),
            ),
          ),
          TextButton(
            onPressed: _openAddAddress,
            child: Text(isAr ? 'إضافة عنوان' : 'Add address'),
          ),
        ],
      ),
    );
  }

  Widget _buildConfirmedAddress(Map<String, dynamic> address) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(border: Border.all(color: LeapColors.line), borderRadius: BorderRadius.circular(10)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.location_on_outlined, size: 18, color: LeapColors.muted),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              '${address['recipientName']}\n${address['streetAddress']}, ${address['city']}, ${address['country']}',
              style: const TextStyle(fontSize: 12.5),
            ),
          ),
        ],
      ),
    );
  }

  void _openAddAddress() {
    final auth = context.read<AuthState>();
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (context) => _AddAddressSheet(
        orderId: widget.orderId,
        guestEmail: _order?['guestEmail'] as String?,
        token: auth.token,
        onSaved: () {
          Navigator.of(context).pop();
          _load();
        },
      ),
    );
  }

  bool _isCancellable() {
    // CONFIRMED (migration 029): cancellable only while every real
    // sub-order is still pending/preparing -- matches the real
    // backend's own check exactly, so this button only ever appears
    // when the real cancel call would actually succeed.
    if (_order == null) return false;
    if (_order!['status'] == 'cancelled') return false;
    final subOrders = (_order!['supplierSubOrders'] as List).cast<Map<String, dynamic>>();
    return subOrders.every((so) => ['pending', 'preparing'].contains(so['status']));
  }

  Future<void> _confirmAndCancelOrder() async {
    final isAr = Localizations.localeOf(context).languageCode == 'ar';
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(isAr ? 'إلغاء الطلب؟' : 'Cancel this order?'),
        content: Text(isAr ? 'لا يمكن التراجع عن هذا الإجراء.' : 'This cannot be undone.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(dialogContext).pop(false), child: Text(isAr ? 'رجوع' : 'Back')),
          FilledButton(onPressed: () => Navigator.of(dialogContext).pop(true), child: Text(isAr ? 'إلغاء الطلب' : 'Cancel order')),
        ],
      ),
    );
    if (confirmed != true) return;

    final auth = context.read<AuthState>();
    try {
      await ApiClient().cancelOrder(auth.token!, widget.orderId);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(isAr ? 'تم إلغاء الطلب.' : 'Order cancelled.')),
        );
        _load();
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(appBar: AppBar(title: Text(tr(context, 'order'))), body: const Center(child: CircularProgressIndicator()));
    }
    if (_errorMessage != null || _order == null) {
      return Scaffold(appBar: AppBar(title: Text(tr(context, 'order'))), body: Center(child: Text(_errorMessage ?? tr(context, 'not_found'), style: const TextStyle(color: LeapColors.muted))));
    }

    final subOrders = (_order!['supplierSubOrders'] as List).cast<Map<String, dynamic>>();
    return Scaffold(
      appBar: AppBar(title: Text(_order!['id'] as String)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              PlateChip(text: _order!['id'] as String),
              Text(trStatus(context, (_order!['displayStatus'] as String?) ?? (_order!['status'] as String)).toUpperCase(), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: LeapColors.torque)),
            ],
          ),
          const SizedBox(height: 6),
          Text('\$${(_order!['total'] as num).toStringAsFixed(2)} ${_order!['currencyCode']}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 20)),
          const SizedBox(height: 16),
          if (_order!['address'] == null)
            _buildPendingAddressBanner()
          else
            _buildConfirmedAddress(_order!['address'] as Map<String, dynamic>),
          const SizedBox(height: 20),
          Text(tr(context, 'shipped_by'), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
          const SizedBox(height: 8),
          for (final so in subOrders) _SupplierSubOrderCard(subOrder: so, onRequestReturn: _openReturnRequest),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: () => context.push('/orders/${widget.orderId}/tracking'),
            icon: const Icon(Icons.local_shipping_outlined, size: 18),
            label: Text(Localizations.localeOf(context).languageCode == 'ar' ? 'تتبع الطلب' : 'Track your package'),
          ),
          if (_isCancellable()) ...[
            const SizedBox(height: 20),
            OutlinedButton(
              onPressed: _confirmAndCancelOrder,
              style: OutlinedButton.styleFrom(foregroundColor: Colors.red, side: const BorderSide(color: Colors.red), minimumSize: const Size.fromHeight(48)),
              child: Text(Localizations.localeOf(context).languageCode == 'ar' ? 'إلغاء الطلب' : 'Cancel order'),
            ),
          ],
        ],
      ),
    );
  }
}

class _SupplierSubOrderCard extends StatelessWidget {
  final Map<String, dynamic> subOrder;
  final void Function(int subOrderId, String supplierLabel) onRequestReturn;
  const _SupplierSubOrderCard({required this.subOrder, required this.onRequestReturn});

  @override
  Widget build(BuildContext context) {
    final items = (subOrder['items'] as List).cast<Map<String, dynamic>>();
    final supplierName = (subOrder['supplierName'] as String?) ?? (subOrder['supplierId'] as String);
    final trackingNumber = subOrder['trackingNumber'] as String?;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(supplierName, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                Text(trStatus(context, subOrder['status'] as String).toUpperCase(), style: const TextStyle(fontSize: 10.5, color: LeapColors.muted, fontWeight: FontWeight.w700)),
              ],
            ),
            if (trackingNumber != null) ...[
              const SizedBox(height: 4),
              Text('${tr(context, 'tracking_label')} $trackingNumber', style: const TextStyle(fontSize: 11.5, color: LeapColors.muted)),
            ],
            const SizedBox(height: 8),
            for (final item in items)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 2),
                child: Text('${item['name']} × ${item['quantity']}', style: const TextStyle(fontSize: 12.5)),
              ),
            const SizedBox(height: 8),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: () => onRequestReturn(subOrder['subOrderId'] as int, supplierName),
                child: Text(tr(context, 'request_a_return'), style: const TextStyle(fontSize: 12.5)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// Real "Add address" sheet (migration 030) -- used both for a real
// guest completing a real "pending" order, and available generically
// for any order missing an address. Plain manual entry here -- the
// real geolocation-based suggestion only happens once, right at
// checkout (see checkout_screen.dart's _AddressConfirmationSheet).
class _AddAddressSheet extends StatefulWidget {
  final String orderId;
  final String? guestEmail;
  final String? token;
  final VoidCallback onSaved;

  const _AddAddressSheet({required this.orderId, required this.guestEmail, required this.token, required this.onSaved});

  @override
  State<_AddAddressSheet> createState() => _AddAddressSheetState();
}

class _AddAddressSheetState extends State<_AddAddressSheet> {
  final _recipientController = TextEditingController();
  final _phoneController = TextEditingController();
  final _countryController = TextEditingController();
  final _cityController = TextEditingController();
  final _streetController = TextEditingController();
  bool _isSaving = false;
  String? _error;

  @override
  void dispose() {
    _recipientController.dispose();
    _phoneController.dispose();
    _countryController.dispose();
    _cityController.dispose();
    _streetController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_recipientController.text.trim().isEmpty ||
        _phoneController.text.trim().isEmpty ||
        _countryController.text.trim().isEmpty ||
        _cityController.text.trim().isEmpty ||
        _streetController.text.trim().isEmpty) {
      setState(() => _error = 'Please fill in every field.');
      return;
    }
    setState(() { _isSaving = true; _error = null; });
    try {
      await ApiClient().confirmOrderAddress(
        widget.orderId,
        {
          'recipientName': _recipientController.text.trim(),
          'phone': _phoneController.text.trim(),
          'country': _countryController.text.trim(),
          'city': _cityController.text.trim(),
          'streetAddress': _streetController.text.trim(),
        },
        guestEmail: widget.guestEmail,
        token: widget.token,
        source: 'manual',
      );
      widget.onSaved();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: MediaQuery.of(context).viewInsets.bottom + 20),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Add your delivery address', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
            const SizedBox(height: 16),
            TextField(controller: _recipientController, decoration: const InputDecoration(labelText: 'Recipient name')),
            const SizedBox(height: 10),
            TextField(controller: _phoneController, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Phone')),
            const SizedBox(height: 10),
            TextField(controller: _countryController, decoration: const InputDecoration(labelText: 'Country')),
            const SizedBox(height: 10),
            TextField(controller: _cityController, decoration: const InputDecoration(labelText: 'City')),
            const SizedBox(height: 10),
            TextField(controller: _streetController, decoration: const InputDecoration(labelText: 'Street address')),
            if (_error != null) ...[
              const SizedBox(height: 10),
              Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 12.5)),
            ],
            const SizedBox(height: 18),
            FilledButton(
              onPressed: _isSaving ? null : _save,
              child: _isSaving
                  ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('Save address'),
            ),
          ],
        ),
      ),
    );
  }
}

class _ReturnRequestSheet extends StatefulWidget {
  final int subOrderId;
  final String supplierLabel;
  final VoidCallback onSubmitted;
  const _ReturnRequestSheet({required this.subOrderId, required this.supplierLabel, required this.onSubmitted});

  @override
  State<_ReturnRequestSheet> createState() => _ReturnRequestSheetState();
}

class _ReturnRequestSheetState extends State<_ReturnRequestSheet> {
  final _reasonController = TextEditingController();
  final _messageController = TextEditingController();
  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  void dispose() {
    _reasonController.dispose();
    _messageController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_reasonController.text.trim().isEmpty || _messageController.text.trim().isEmpty) {
      setState(() => _errorMessage = trRead(context, 'please_fill_both_fields'));
      return;
    }
    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });
    final auth = context.read<AuthState>();
    try {
      await ApiClient().createReturnCase(
        token: auth.token,
        subOrderId: widget.subOrderId,
        reason: _reasonController.text.trim(),
        message: _messageController.text.trim(),
      );
      widget.onSubmitted();
    } on ApiException catch (e) {
      setState(() => _errorMessage = e.message);
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('${tr(context, 'request_a_return')} — ${widget.supplierLabel}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
          const SizedBox(height: 4),
          Text(
            tr(context, 'return_goes_to_leap'),
            style: const TextStyle(fontSize: 12, color: LeapColors.muted),
          ),
          const SizedBox(height: 16),
          TextField(controller: _reasonController, decoration: InputDecoration(labelText: tr(context, 'reason_label'))),
          const SizedBox(height: 12),
          TextField(
            controller: _messageController,
            maxLines: 4,
            decoration: InputDecoration(labelText: tr(context, 'details_label'), alignLabelWithHint: true),
          ),
          if (_errorMessage != null) ...[
            const SizedBox(height: 12),
            Text(_errorMessage!, style: const TextStyle(color: Colors.red, fontSize: 12.5)),
          ],
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: _isSubmitting ? null : _submit,
            child: _isSubmitting
                ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : Text(tr(context, 'submit_request')),
          ),
        ],
      ),
    );
  }
}
