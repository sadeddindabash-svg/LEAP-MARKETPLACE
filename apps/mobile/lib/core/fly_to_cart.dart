import 'dart:math' as math;
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

/// "Fly to cart", the same motion as the website: when a part is added, a small copy of its photo lifts off the screen, arcs to the cart and lands there; the
/// cart then bounces and its number goes up.
///
/// The places a part can land are [FlyCartTarget]s: the Cart tab of the bottom bar, and the cart button at the top of a product's screen. The part flies to the
/// one on the screen the buyer is looking at; when there is none (or the buyer asked the phone to reduce motion) it lands at once: the number simply goes up.
/// While a part is in the air the cart's number waits ([FlyToCart.held]), so it goes up the moment the part lands, not before.
class FlyToCart {
  FlyToCart._();

  static const duration = Duration(milliseconds: 750);

  /// The cart number to show while a part is in the air (null: show the real one).
  static final ValueNotifier<int?> held = ValueNotifier<int?>(null);

  /// Goes up by one each time a part lands: the cart bounces.
  static final ValueNotifier<int> landings = ValueNotifier<int>(0);

  static final List<GlobalKey> _targets = [];
  static void _register(GlobalKey key) => _targets.add(key);
  static void _unregister(GlobalKey key) => _targets.remove(key);

  /// The cart number the badge shows: the held one while a part flies, else the real one.
  static int shown(int itemCount) => held.value ?? itemCount;

  /// The point of the arc at [t] (0..1): from [from], up over a high point, down onto [to] (a quadratic curve).
  static Offset arcPoint(double t, Offset from, Offset to, {double lift = 90}) {
    final c = Offset((from.dx + to.dx) / 2, math.min(from.dy, to.dy) - lift);
    final q = 1 - t;
    return Offset(q * q * from.dx + 2 * q * t * c.dx + t * t * to.dx, q * q * from.dy + 2 * q * t * c.dy + t * t * to.dy);
  }

  static Rect? _rectOf(GlobalKey key) {
    final box = key.currentContext?.findRenderObject();
    if (box is! RenderBox || !box.hasSize || !box.attached) return null;
    return box.localToGlobal(Offset.zero) & box.size;
  }

  /// The landing place on the screen being looked at: the newest target whose screen is the one on top.
  static GlobalKey? _targetOnScreen() {
    for (final key in _targets.reversed) {
      final ctx = key.currentContext;
      if (ctx == null) continue;
      final route = ModalRoute.of(ctx);
      if (route != null && !route.isCurrent) continue;
      if (_rectOf(key) != null) return key;
    }
    return null;
  }

  static void _land() {
    held.value = null;
    landings.value++;
  }

  /// Sends a part to the cart. [source] is the photo that flies (its place on screen), [imageUrl] the photo itself (null: a gold chip flies).
  /// [itemCountBefore] is the cart's number before the add: it is held until the part lands.
  static void fly(BuildContext context, {required GlobalKey source, String? imageUrl, required int itemCountBefore}) {
    held.value ??= itemCountBefore;
    final target = _targetOnScreen();
    final from = _rectOf(source);
    final to = target == null ? null : _rectOf(target);
    final overlay = Overlay.maybeOf(context, rootOverlay: true);
    if (from == null || to == null || overlay == null || (MediaQuery.maybeOf(context)?.disableAnimations ?? false)) {
      _land();
      return;
    }
    late OverlayEntry entry;
    entry = OverlayEntry(
      builder: (_) => _Flyer(
        from: from,
        to: to,
        imageUrl: imageUrl,
        onDone: () {
          entry.remove();
          _land();
        },
      ),
    );
    overlay.insert(entry);
  }
}

class _Flyer extends StatefulWidget {
  final Rect from;
  final Rect to;
  final String? imageUrl;
  final VoidCallback onDone;
  const _Flyer({required this.from, required this.to, required this.imageUrl, required this.onDone});

  @override
  State<_Flyer> createState() => _FlyerState();
}

class _FlyerState extends State<_Flyer> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: FlyToCart.duration)
    ..addStatusListener((s) {
      if (s == AnimationStatus.completed) widget.onDone();
    })
    ..forward();
  late final Animation<double> _t = CurvedAnimation(parent: _c, curve: Curves.easeInOut);

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final startSize = math.max(math.min(widget.from.width, widget.from.height) * 0.55, 40.0);
    const endSize = 26.0;
    return IgnorePointer(
      child: AnimatedBuilder(
        animation: _c,
        builder: (context, _) {
          final t = _t.value;
          final at = FlyToCart.arcPoint(t, widget.from.center, widget.to.center);
          final size = startSize + (endSize - startSize) * t;
          final opacity = _c.value > 0.9 ? (1 - (_c.value - 0.9) * 10).clamp(0.0, 1.0) : 1.0;
          return Stack(children: [
            Positioned(
              left: at.dx - size / 2,
              top: at.dy - size / 2,
              width: size,
              height: size,
              child: Opacity(
                opacity: opacity,
                child: Container(
                  decoration: BoxDecoration(
                    color: widget.imageUrl == null ? const Color(0xFFF9B317) : Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFF9B317), width: 2),
                    boxShadow: const [BoxShadow(color: Color(0x4D0B3146), blurRadius: 24, offset: Offset(0, 10))],
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: widget.imageUrl == null ? null : CachedNetworkImage(imageUrl: widget.imageUrl!, fit: BoxFit.cover),
                ),
              ),
            ),
          ]);
        },
      ),
    );
  }
}

/// A place a part can land: the cart. Bounces (bigger, a little tilt, back) each time a part lands.
class FlyCartTarget extends StatefulWidget {
  final Widget child;
  const FlyCartTarget({super.key, required this.child});

  @override
  State<FlyCartTarget> createState() => _FlyCartTargetState();
}

class _FlyCartTargetState extends State<FlyCartTarget> with SingleTickerProviderStateMixin {
  final GlobalKey _key = GlobalKey();
  late final AnimationController _bounce = AnimationController(vsync: this, duration: const Duration(milliseconds: 360));

  void _onLanding() {
    if (!mounted || (MediaQuery.maybeOf(context)?.disableAnimations ?? false)) return;
    if (FlyToCart._targetOnScreen() != _key) return;          // only the cart the part landed on bounces
    _bounce.forward(from: 0);
  }

  @override
  void initState() {
    super.initState();
    FlyToCart._register(_key);
    FlyToCart.landings.addListener(_onLanding);
  }

  @override
  void dispose() {
    FlyToCart.landings.removeListener(_onLanding);
    FlyToCart._unregister(_key);
    _bounce.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _bounce,
      child: KeyedSubtree(key: _key, child: widget.child),
      builder: (context, child) {
        final k = math.sin(_bounce.value * math.pi) * 0.28;
        return Transform.rotate(angle: -k * 0.5, child: Transform.scale(scale: 1 + k, child: child));
      },
    );
  }
}

/// The cart's number, as the badges show it: it waits while a part is in the air (see [FlyToCart.held]).
class FlyCartCount extends StatelessWidget {
  final int itemCount;
  final Widget Function(BuildContext context, int count) builder;
  const FlyCartCount({super.key, required this.itemCount, required this.builder});

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<int?>(
      valueListenable: FlyToCart.held,
      builder: (context, held, _) => builder(context, held ?? itemCount),
    );
  }
}
