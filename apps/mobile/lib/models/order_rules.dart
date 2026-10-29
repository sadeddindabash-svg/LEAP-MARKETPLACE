/// The buyer's order screen: what is still worth offering. An order that is OVER for good (cancelled, or every part cancelled: for example the only supplier refused it and nobody else could supply it)
/// has nothing to check, track or give a receipt for (nothing will be shipped and nothing was charged). An order with a part still going is not over. Plain Dart (no Flutter), so it is tested without a device.
bool isOrderFullyCancelled(Map<String, dynamic>? order) {
  if (order == null) return false;
  if (order['status'] == 'cancelled') return true;
  final parts = order['supplierSubOrders'];
  if (parts is! List || parts.isEmpty) return false;
  return parts.every((p) => p is Map && p['status'] == 'cancelled');
}

/// "Track your package": offered while a part that is still going has not been delivered. A cancelled part is not "still to deliver". [stageOf] says how the screen classifies a part ('delivered' ...).
bool showsTrackingButton(Map<String, dynamic>? order, List<Map<String, dynamic>> subOrders, String Function(Map<String, dynamic>) stageOf) {
  if (isOrderFullyCancelled(order)) return false;
  final going = subOrders.where((so) => so['status'] != 'cancelled').toList();
  return going.isNotEmpty && !going.every((so) => stageOf(so) == 'delivered');
}

/// "Download receipt": nothing was charged for an order that is over.
bool showsReceiptButton(Map<String, dynamic>? order) => !isOrderFullyCancelled(order);

/// "Check your address in English": only for an automatic English address that nobody confirmed, and not for an order that is over.
bool needsEnglishAddressCheckFor(Map<String, dynamic>? order) {
  final english = order?['addressEnglish'];
  return order?['address'] != null && english is Map<String, dynamic> && english['source'] == 'auto' && !isOrderFullyCancelled(order);
}
