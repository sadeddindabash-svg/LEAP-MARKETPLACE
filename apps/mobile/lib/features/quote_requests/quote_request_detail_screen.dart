import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../core/auth_state.dart';
import '../../core/cart_state.dart';
import '../../services/api_client.dart';
import '../../models/quote_request.dart';

/// Real request detail / quote-review screen for the "request a part
/// we don't carry" system (RFQ), confirmed matching the person's own
/// workflow description exactly: once quoted, the buyer can edit
/// quantity or remove items they no longer need, then place the
/// order.
class QuoteRequestDetailScreen extends StatefulWidget {
  final String requestId;
  const QuoteRequestDetailScreen({super.key, required this.requestId});

  @override
  State<QuoteRequestDetailScreen> createState() => _QuoteRequestDetailScreenState();
}

class _QuoteRequestDetailScreenState extends State<QuoteRequestDetailScreen> {
  QuoteRequest? _request;
  String? _errorMessage;
  bool _isPlacingOrder = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final token = context.read<AuthState>().token;
    if (token == null) return;
    try {
      final request = await ApiClient().fetchQuoteRequest(token, widget.requestId);
      if (mounted) setState(() { _request = request; _errorMessage = null; });
    } on ApiException catch (e) {
      if (mounted) setState(() => _errorMessage = e.message);
    }
  }

  Future<void> _updateQuantity(QuoteRequestItem item, int newQuantity) async {
    final token = context.read<AuthState>().token;
    if (token == null) return;
    if (newQuantity < 1) return;
    try {
      final updated = await ApiClient().updateQuoteRequestItem(token, widget.requestId, item.id, quantity: newQuantity);
      if (mounted) setState(() => _request = updated);
    } on ApiException catch (e) {
      if (mounted) setState(() => _errorMessage = e.message);
    }
  }

  Future<void> _removeItem(QuoteRequestItem item) async {
    final token = context.read<AuthState>().token;
    if (token == null) return;
    try {
      final updated = await ApiClient().deleteQuoteRequestItem(token, widget.requestId, item.id);
      if (mounted) setState(() => _request = updated);
    } on ApiException catch (e) {
      if (mounted) setState(() => _errorMessage = e.message);
    }
  }

  Future<void> _cancelRequest() async {
    final isAr = Localizations.localeOf(context).languageCode == 'ar';
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(isAr ? 'إلغاء الطلب؟' : 'Cancel this request?'),
        content: Text(isAr ? 'لا يمكن التراجع عن هذا الإجراء.' : "This can't be undone."),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: Text(isAr ? 'رجوع' : 'Back')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: Text(isAr ? 'إلغاء الطلب' : 'Cancel request', style: const TextStyle(color: Colors.red))),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    final token = context.read<AuthState>().token;
    if (token == null) return;
    try {
      final updated = await ApiClient().cancelQuoteRequest(token, widget.requestId);
      if (mounted) setState(() => _request = updated);
    } on ApiException catch (e) {
      if (mounted) setState(() => _errorMessage = e.message);
    }
  }

  Future<void> _placeOrder() async {
    final token = context.read<AuthState>().token;
    final cartId = context.read<CartState>().cartId;
    if (token == null || cartId == null) return;
    setState(() { _isPlacingOrder = true; _errorMessage = null; });
    try {
      await ApiClient().placeQuoteRequestOrder(token, widget.requestId, cartId: cartId);
      if (mounted) context.go('/cart');
    } on ApiException catch (e) {
      if (mounted) setState(() { _errorMessage = e.message; _isPlacingOrder = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = LeapPalette.of(context);
    final isAr = Localizations.localeOf(context).languageCode == 'ar';

    if (_request == null) {
      return Scaffold(
        appBar: AppBar(),
        body: _errorMessage != null
            ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(_errorMessage!, style: const TextStyle(color: Colors.red))))
            : const Center(child: CircularProgressIndicator()),
      );
    }

    final request = _request!;
    final readyItems = request.items.where((i) => i.readyToOrder).toList();
    final total = readyItems.fold<double>(0, (sum, i) => sum + (i.price ?? 0) * i.quantity);

    return Scaffold(
      appBar: AppBar(title: Text(request.vehicleLabel, style: const TextStyle(fontSize: 15))),
      body: SafeArea(
        child: Column(
          children: [
            _StatusBanner(status: request.status, isAr: isAr, palette: palette),
            if (_errorMessage != null)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                child: Text(_errorMessage!, style: const TextStyle(color: Colors.red, fontSize: 12.5)),
              ),
            Expanded(
              child: ListView.separated(
                padding: const EdgeInsets.all(14),
                itemCount: request.items.length,
                separatorBuilder: (_, __) => const SizedBox(height: 10),
                itemBuilder: (context, i) => _ItemRow(
                  item: request.items[i],
                  isQuoted: request.status == 'quoted',
                  isAr: isAr,
                  palette: palette,
                  onQuantityChanged: (q) => _updateQuantity(request.items[i], q),
                  onRemove: () => _removeItem(request.items[i]),
                ),
              ),
            ),
            if (request.status == 'draft' || request.status == 'submitted')
              Padding(
                padding: const EdgeInsets.all(14),
                child: OutlinedButton(
                  onPressed: _cancelRequest,
                  style: OutlinedButton.styleFrom(minimumSize: const Size(double.infinity, 46), foregroundColor: Colors.red),
                  child: Text(isAr ? 'إلغاء الطلب' : 'Cancel this request'),
                ),
              ),
            if (request.status == 'quoted')
              Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(isAr ? 'الإجمالي' : 'Total', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                        Text('\$${total.toStringAsFixed(2)}', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: palette.signalDark)),
                      ],
                    ),
                    const SizedBox(height: 10),
                    ElevatedButton(
                      onPressed: (readyItems.isEmpty || _isPlacingOrder) ? null : _placeOrder,
                      style: ElevatedButton.styleFrom(minimumSize: const Size(double.infinity, 48), backgroundColor: palette.signal, foregroundColor: palette.onSignal),
                      child: Text(_isPlacingOrder ? (isAr ? 'جارٍ المعالجة…' : 'Processing…') : (isAr ? 'إتمام الطلب' : 'Place order')),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _StatusBanner extends StatelessWidget {
  final String status;
  final bool isAr;
  final LeapPalette palette;
  const _StatusBanner({required this.status, required this.isAr, required this.palette});

  @override
  Widget build(BuildContext context) {
    String message;
    Color color;
    switch (status) {
      case 'draft':
        message = isAr ? 'لم يتم إرسال هذا الطلب بعد.' : "This request hasn't been submitted yet.";
        color = palette.muted;
        break;
      case 'submitted':
        message = isAr ? 'بانتظار عرض السعر من فريقنا.' : 'Awaiting a quote from our team.';
        color = palette.amber;
        break;
      case 'quoted':
        message = isAr ? 'تم استلام عرض السعر — راجع الأسعار أدناه.' : 'Quote received -- review the prices below.';
        color = palette.gauge;
        break;
      case 'ordered':
        message = isAr ? 'تم تقديم هذا الطلب.' : 'This request has been ordered.';
        color = palette.torque;
        break;
      case 'expired':
        message = isAr ? 'انتهت صلاحية عرض السعر.' : 'This quote has expired.';
        color = Colors.red;
        break;
      default:
        message = isAr ? 'تم إلغاء هذا الطلب.' : 'This request was cancelled.';
        color = palette.muted;
    }
    return Container(
      width: double.infinity,
      color: color.withValues(alpha: 0.1),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      child: Text(message, style: TextStyle(fontSize: 12.5, color: color, fontWeight: FontWeight.w600)),
    );
  }
}

class _ItemRow extends StatelessWidget {
  final QuoteRequestItem item;
  final bool isQuoted;
  final bool isAr;
  final LeapPalette palette;
  final void Function(int) onQuantityChanged;
  final VoidCallback onRemove;
  const _ItemRow({required this.item, required this.isQuoted, required this.isAr, required this.palette, required this.onQuantityChanged, required this.onRemove});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(border: Border.all(color: palette.line), borderRadius: BorderRadius.circular(10)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Text(item.name, style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700))),
              if (item.status == 'unavailable')
                Text(isAr ? 'غير متوفر' : 'Unavailable', style: const TextStyle(fontSize: 11.5, color: Colors.red, fontWeight: FontWeight.w700))
              else if (item.status == 'priced')
                Text(
                  item.readyToOrder ? '\$${item.price?.toStringAsFixed(2)}' : (isAr ? 'قيد المراجعة' : 'Pending approval'),
                  style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: item.readyToOrder ? palette.signalDark : palette.amber),
                ),
            ],
          ),
          if (item.description != null) Padding(padding: const EdgeInsets.only(top: 2), child: Text(item.description!, style: TextStyle(fontSize: 12, color: palette.muted))),
          const SizedBox(height: 8),
          if (isQuoted && item.status == 'priced')
            Row(
              children: [
                IconButton(icon: const Icon(Icons.remove_circle_outline, size: 20), onPressed: item.quantity > 1 ? () => onQuantityChanged(item.quantity - 1) : null),
                Text('${item.quantity}', style: const TextStyle(fontSize: 13)),
                IconButton(icon: const Icon(Icons.add_circle_outline, size: 20), onPressed: () => onQuantityChanged(item.quantity + 1)),
                const Spacer(),
                TextButton(onPressed: onRemove, child: Text(isAr ? 'إزالة' : 'Remove', style: const TextStyle(color: Colors.red, fontSize: 12.5))),
              ],
            )
          else
            Text(isAr ? 'الكمية: ${item.quantity}' : 'Qty: ${item.quantity}', style: TextStyle(fontSize: 12, color: palette.muted)),
        ],
      ),
    );
  }
}
