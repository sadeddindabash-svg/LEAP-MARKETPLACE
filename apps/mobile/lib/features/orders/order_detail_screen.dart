import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
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
            SnackBar(content: Text(trRead(context, 'return_request_sent'))),
          );
        },
      ),
    );
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
              Text((_order!['status'] as String).toUpperCase(), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: LeapColors.torque)),
            ],
          ),
          const SizedBox(height: 6),
          Text('\$${(_order!['total'] as num).toStringAsFixed(2)} ${_order!['currencyCode']}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 20)),
          const SizedBox(height: 20),
          Text(tr(context, 'shipped_by'), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
          const SizedBox(height: 8),
          for (final so in subOrders) _SupplierSubOrderCard(subOrder: so, onRequestReturn: _openReturnRequest),
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
                Text((subOrder['status'] as String).toUpperCase(), style: const TextStyle(fontSize: 10.5, color: LeapColors.muted, fontWeight: FontWeight.w700)),
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
