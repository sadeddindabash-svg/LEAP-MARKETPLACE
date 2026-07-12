import 'package:flutter/material.dart';
import '../../models/order.dart';
import '../../widgets/plate_chip.dart';
import '../../widgets/status_badge.dart';

/// BUY-050–052: order history segmented by status, with tracking.
/// BUY-053: returns/warranty requests route to the Platform, never directly
/// to the supplier — keep that routing server-side, don't add a supplier
/// contact path here later.
class OrdersScreen extends StatelessWidget {
  const OrdersScreen({super.key});

  // TODO: replace with real orders from services/api/order.
  static final _placeholderOrders = [
    Order(
      id: 'LP-208841',
      placedAt: DateTime(2026, 7, 4),
      status: OrderStatus.shipped,
      total: 63.29,
      currencyCode: 'USD',
      items: const [OrderItem(productName: 'RIDEX Front Brake Disc', quantity: 1, supplierName: 'Guangzhou AutoParts Co.')],
      trackingNumber: 'CN-GLB-77213840',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My orders')),
      body: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: _placeholderOrders.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (context, i) {
          final o = _placeholderOrders[i];
          return Card(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [PlateChip(text: o.id, small: true), StatusBadge(status: o.status)],
                  ),
                  const SizedBox(height: 8),
                  Text('${o.items.length} item(s) · \$${o.total.toStringAsFixed(2)}'),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
