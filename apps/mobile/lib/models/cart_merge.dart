/// ONE CART PER ACCOUNT: what the server says when it combined this device's basket with the account basket (only in the one answer that did).
class CartMergeReduced {
  final String productId;
  final String name;
  final int from;
  final int to;
  const CartMergeReduced({required this.productId, required this.name, required this.from, required this.to});
}

class CartMergeDropped {
  final String productId;
  final String name;
  const CartMergeDropped({required this.productId, required this.name});
}

class CartMerge {
  final int itemsAdded; // lines that were not in the account basket
  final int itemsCombined; // lines whose quantity was added to the account basket's
  final List<CartMergeReduced> reduced; // quantities lowered because there is not enough stock
  final List<CartMergeDropped> dropped; // lines that could not be added at all (no stock)
  const CartMerge({required this.itemsAdded, required this.itemsCombined, required this.reduced, required this.dropped});

  /// null when there is nothing to say (no `merge` in the answer, or an answer of the wrong shape: an older server).
  static CartMerge? fromJson(dynamic json) {
    if (json is! Map) return null;
    int whole(dynamic v) => v is num ? v.toInt() : 0;
    final reduced = <CartMergeReduced>[];
    final rawReduced = json['reduced'];
    if (rawReduced is List) {
      for (final r in rawReduced) {
        if (r is Map && r['productId'] is String) reduced.add(CartMergeReduced(productId: r['productId'] as String, name: (r['name'] as String?) ?? '', from: whole(r['from']), to: whole(r['to'])));
      }
    }
    final dropped = <CartMergeDropped>[];
    final rawDropped = json['dropped'];
    if (rawDropped is List) {
      for (final d in rawDropped) {
        if (d is Map && d['productId'] is String) dropped.add(CartMergeDropped(productId: d['productId'] as String, name: (d['name'] as String?) ?? ''));
      }
    }
    return CartMerge(itemsAdded: whole(json['itemsAdded']), itemsCombined: whole(json['itemsCombined']), reduced: reduced, dropped: dropped);
  }
}
