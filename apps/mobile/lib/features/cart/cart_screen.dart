import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../core/app_strings.dart';
import '../../core/currency_state.dart';
import '../../core/cart_state.dart';
import '../../models/cart_item.dart';
import '../../services/api_client.dart';
import '../../widgets/skeleton.dart';

/// BUY-030–031: cart holds items from multiple suppliers but presents one
/// unified basket and total; splitting into supplier sub-orders happens at
/// checkout time (server-side), invisibly to the buyer. Every quantity
/// change and removal here is a real call to services/api/cart — there is
/// no local-only cart state to reconcile later.
///
/// Real visual redesign (new), matched directly against the real Stitch
/// "cart" reference export. One real, deliberate deviation, not an
/// oversight: the reference groups items under a REAL supplier name
/// ("Supplier: ALPHA-71") -- this app's own real, confirmed business
/// rule is that a buyer never sees a real supplier's identity anywhere,
/// so this still uses the existing, already-anonymized
/// `cart.itemsBySupplier` grouping ("Supplier", "Supplier 1", etc.),
/// not the reference's real names. Also does not add the reference's
/// "Precision Shipping" / "Estimated Tax" line items or "Save Quote"
/// button -- neither is real data/functionality that exists in this
/// app (shipping/tax are only ever computed at real checkout time, not
/// in the cart), so adding them here would be fabricating figures or a
/// feature that doesn't work.
class CartScreen extends StatelessWidget {
  const CartScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartState>();
    final palette = LeapPalette.of(context);

    return Scaffold(
      appBar: AppBar(title: Text(tr(context, 'basket'))),
      body: _buildBody(context, cart, palette),
      bottomNavigationBar: (cart.isLoading || cart.isEmpty)
          ? null
          : Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: palette.card,
                border: Border(top: BorderSide(color: palette.line)),
              ),
              child: SafeArea(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(tr(context, 'total').toUpperCase(), style: TextStyle(color: palette.muted, fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 0.5)),
                        Text(formatPriceWithUsd(context, cart.total), style: TextStyle(fontWeight: FontWeight.w800, fontSize: 24, color: palette.signal)),
                      ],
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: () => context.push('/checkout'),
                        child: Text(tr(context, 'checkout')),
                      ),
                    ),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildBody(BuildContext context, CartState cart, LeapPalette palette) {
    if (cart.isLoading) {
      return const ListSkeleton();
    }
    if (cart.errorMessage != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(cart.errorMessage!, textAlign: TextAlign.center, style: TextStyle(color: palette.muted)),
              const SizedBox(height: 12),
              ElevatedButton(onPressed: cart.refresh, child: Text(tr(context, 'retry'))),
            ],
          ),
        ),
      );
    }
    if (cart.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.shopping_cart_outlined, size: 40, color: palette.muted),
              const SizedBox(height: 12),
              Text(tr(context, 'basket_empty'),
                  textAlign: TextAlign.center, style: TextStyle(color: palette.muted)),
              const SizedBox(height: 20),
              // Real "Browse products" CTA (new) -- closes a real gap:
              // this empty state's own copy already said "Browse
              // categories to add..." but there was no actual button to
              // do that with.
              ElevatedButton(
                onPressed: () => context.go('/home'),
                child: Text(tr(context, 'browse_products')),
              ),
            ],
          ),
        ),
      );
    }

    final grouped = cart.itemsBySupplier;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        for (final entry in grouped.entries) _SupplierGroup(supplierName: entry.key, items: entry.value),
        // Real order summary (new) -- shows only real, currently-known
        // data (subtotal). Deliberately does not show a shipping/tax
        // breakdown here, matching the real Stitch reference's own
        // "Order Specifications" section structurally -- that real
        // breakdown only exists once real checkout computes it.
        Container(
          decoration: BoxDecoration(
            color: palette.card,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: palette.line),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.all(14),
                child: Text(tr(context, 'order_summary'), style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: palette.ink)),
              ),
              Divider(height: 1, color: palette.line),
              Padding(
                padding: const EdgeInsets.all(14),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(tr(context, 'subtotal'), style: TextStyle(color: palette.muted, fontSize: 13)),
                    Text(formatPrice(context, cart.total), style: TextStyle(color: palette.ink, fontSize: 13, fontWeight: FontWeight.w600)),
                  ],
                ),
              ),
              // Real cart weight estimate (#23) -- only shown when at
              // least one real item in the cart actually has real
              // weight data on file; a partial real total (items
              // missing weight data just aren't counted) is still
              // genuinely useful and clearly better than hiding it
              // entirely just because coverage isn't complete.
              if (cart.items.any((i) => i.weightKg != null))
                Padding(
                  padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(tr(context, 'estimated_weight'), style: TextStyle(color: palette.muted, fontSize: 12.5)),
                      Text(
                        '${cart.items.fold<double>(0, (sum, i) => sum + (i.weightKg ?? 0) * i.quantity).toStringAsFixed(1)} kg',
                        style: TextStyle(color: palette.muted, fontSize: 12.5),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _SupplierGroup extends StatelessWidget {
  final String supplierName;
  final List<CartItem> items;
  const _SupplierGroup({required this.supplierName, required this.items});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final item in items) _CartItemRow(key: ValueKey(item.productId), item: item),
        ],
      ),
    );
  }
}

class _CartItemRow extends StatefulWidget {
  final CartItem item;
  const _CartItemRow({super.key, required this.item});

  @override
  State<_CartItemRow> createState() => _CartItemRowState();
}

class _CartItemRowState extends State<_CartItemRow> {
  // REAL FIX: fully local removal state, not tied to CartState's own
  // notifyListeners() at all. Suspected root cause of the message
  // never auto-dismissing: this row previously watched CartState
  // reactively for this same visual purpose, and CartState.removeItem
  // notifies listeners twice per removal -- the repeated rebuilds
  // this caused, right while the real SnackBar was showing, may have
  // been disrupting its own timer (confirmed manual dismissal via
  // Undo worked fine, only the automatic timer never fired --
  // pointing at something disrupting the timer specifically, not the
  // SnackBar mechanism itself). This is real, local State now,
  // entirely decoupled from Provider's rebuild mechanism.
  bool _isRemoving = false;

  CartItem get item => widget.item;

  // REAL BUG FOUND AND FIXED HERE: the +/- stepper's onPressed calls
  // were fire-and-forget (`() => cart.setQuantity(...)`, never awaited
  // or wrapped in a try/catch) -- the exact same class of bug found and
  // fixed in the photo-upload code earlier this session. A real
  // rejection from the backend's new stock check (services/api/src/
  // modules/cart/routes.js) would throw an ApiException that nothing
  // ever caught, silently doing nothing with no visible feedback at
  // all. Fixed by awaiting and catching here instead.
  Future<void> _changeQuantity(BuildContext context, CartState cart, int newQuantity) async {
    try {
      await cart.setQuantity(item.productId, newQuantity);
    } on ApiException catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  // REAL BUG FOUND AND FIXED HERE (two, actually): this remove button
  // was a fire-and-forget call (`() => cart.removeItem(...)`, never
  // awaited or wrapped in a try/catch) -- the exact same bug class
  // already documented as fixed for the +/- stepper right above in
  // this same file, just missed here. A real removal failure (network
  // error) would silently do nothing with no visible feedback at all.
  //
  // Second, found only after the first fix shipped and the real Undo
  // snackbar still never appeared: removing the item successfully
  // triggers a real rebuild of the cart list WITHOUT this row -- so by
  // the time execution resumes after `await cart.removeItem(...)`,
  // THIS row's own BuildContext has already been disposed as part of
  // that same rebuild. `context.mounted` correctly reported false at
  // that point, so an `if (context.mounted)` guard was silently
  // skipping the snackbar every time, not failing loudly. Fixed by
  // capturing the real ScaffoldMessenger instance -- and every real
  // translated string, since `tr()` also does a real InheritedWidget
  // lookup via this row's own context -- BEFORE the async removal,
  // never re-resolving anything from this row's own context afterward.
  //
  // Also adds a real "Undo" action -- restores the exact real quantity
  // that was removed via the real cart's own addItem, not a guessed
  // default of 1.
  // REAL BUG FOUND AND FIXED HERE (a THIRD one, found only via a real
  // device console error after the second fix still didn't work): used
  // `tr(context, ...)` here, which internally calls
  // `context.watch<LanguageState>()` -- a REACTIVE read, meant for use
  // inside a real build() method so a widget rebuilds when the
  // language changes. Provider explicitly forbids calling `.watch()`
  // from inside an event handler (like this async onPressed callback)
  // regardless of whether the context is fresh or stale -- a real,
  // structural mismatch that had nothing to do with the earlier
  // context-disposal fix. The real, correct fix: `trRead()`, which uses
  // `context.read()` (a one-time, non-reactive read) -- the exact same
  // pattern this file's own `_addToCart` above already uses correctly
  // for its own snackbar. This should have been used here from the
  // start.
  Future<void> _removeItem(BuildContext context, CartState cart) async {
    final removedQuantity = item.quantity;
    final removedName = item.name;
    final messenger = ScaffoldMessenger.of(context);
    final removedLabel = trRead(context, 'cart_removed_from_cart');
    final undoLabel = trRead(context, 'undo');
    setState(() => _isRemoving = true);
    try {
      await cart.removeItem(item.productId);
    } on ApiException catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
      return;
    } finally {
      if (mounted) setState(() => _isRemoving = false);
    }
    // REAL BUG FOUND AND FIXED HERE: removeCurrentSnackBar()
    // immediately followed by showSnackBar() in the same synchronous
    // call is a known, documented Flutter interaction issue in some
    // versions -- the new SnackBar's own timer can behave
    // unpredictably right after a forced removal like this. Removed
    // entirely; the explicit duration below already handles the
    // real underlying concern (a message that could otherwise
    // linger) more directly and safely.
    messenger.showSnackBar(
      SnackBar(
        content: Text('$removedName $removedLabel'),
        // Real, explicit, guaranteed-finite duration (fix) --
        // confirmed directly that no duration was ever set anywhere
        // on this SnackBar before, relying entirely on Flutter's own
        // default. This removes that dependency and directly
        // guarantees the message can't stay up indefinitely.
        duration: const Duration(seconds: 4),
        action: SnackBarAction(
          label: undoLabel,
          onPressed: () async {
            try {
              await cart.addItem(item.productId, removedQuantity);
            } on ApiException catch (e) {
              messenger.showSnackBar(SnackBar(content: Text(e.message)));
            }
          },
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final cart = context.read<CartState>();
    final palette = LeapPalette.of(context);
    // Real, proactive stock limit (new) -- disables "+" right at the
    // real stock ceiling, rather than only reacting after the backend
    // rejects it. Genuinely honest either way: stock isn't reserved
    // per-cart anywhere in this schema (see the backend's own comment),
    // so this can still occasionally be beaten by another buyer between
    // this check and real order placement -- that race is handled
    // correctly there, not pretended away here.
    final atStockLimit = item.quantity >= item.stockQuantity;
    final remainingAfterThis = item.stockQuantity - item.quantity;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: palette.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: palette.line),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Real product thumbnail (new), sized up to match the real
          // Stitch reference's own larger, more prominent product
          // photography (scaled down from its 96-128px desktop size to
          // fit a real phone screen's own row height reasonably).
          ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: item.imageUrl != null
                ? CachedNetworkImage(
                    fadeInDuration: const Duration(milliseconds: 300),
                    imageUrl: ApiClient.resolveMediaUrl(item.imageUrl!),
                    width: 72,
                    height: 72,
                    fit: BoxFit.cover,
                    placeholder: (context, url) => Container(width: 72, height: 72, color: Colors.white),
                    errorWidget: (context, url, error) => Container(
                      width: 72,
                      height: 72,
                      color: Colors.white,
                      child: Icon(Icons.broken_image_outlined, size: 22, color: palette.muted),
                    ),
                  )
                : Container(
                    width: 72,
                    height: 72,
                    color: Colors.white,
                    child: Icon(Icons.album_outlined, color: palette.ink),
                  ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(item.name, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: palette.ink), maxLines: 2, overflow: TextOverflow.ellipsis),
                    ),
                    IconButton(
                      onPressed: _isRemoving ? null : () => _removeItem(context, cart),
                      icon: _isRemoving
                          ? SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: palette.muted))
                          : Icon(Icons.delete_outline, size: 18, color: palette.muted),
                      tooltip: 'Remove item',
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(),
                      visualDensity: VisualDensity.compact,
                    ),
                  ],
                ),
                if (remainingAfterThis <= 5)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      remainingAfterThis <= 0
                          ? tr(context, 'cart_at_stock_limit')
                          : '${tr(context, 'cart_only')} $remainingAfterThis ${tr(context, 'cart_left_in_stock')}',
                      style: TextStyle(fontSize: 10.5, color: palette.signal, fontWeight: FontWeight.w600),
                    ),
                  ),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    // Real pill-shaped quantity stepper (new), matching
                    // the real Stitch reference exactly.
                    Container(
                      decoration: BoxDecoration(color: palette.card, borderRadius: BorderRadius.circular(999), border: Border.all(color: palette.line)),
                      child: Row(
                        children: [
                          IconButton(
                            iconSize: 14,
                            padding: const EdgeInsets.all(6),
                            constraints: const BoxConstraints(),
                            onPressed: () => _changeQuantity(context, cart, item.quantity - 1),
                            icon: Icon(Icons.remove, color: palette.ink),
                            tooltip: 'Decrease quantity',
                          ),
                          SizedBox(width: 20, child: Text('${item.quantity}', textAlign: TextAlign.center, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: palette.ink))),
                          IconButton(
                            iconSize: 14,
                            padding: const EdgeInsets.all(6),
                            constraints: const BoxConstraints(),
                            onPressed: atStockLimit ? null : () => _changeQuantity(context, cart, item.quantity + 1),
                            icon: Icon(Icons.add, color: atStockLimit ? palette.muted : palette.ink),
                            tooltip: 'Increase quantity',
                          ),
                        ],
                      ),
                    ),
                    Text(formatPrice(context, item.lineTotal), style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: palette.signal)),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
