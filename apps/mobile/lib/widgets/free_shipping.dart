import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../core/app_strings.dart';
import '../core/currency_state.dart';
import '../core/theme.dart';
import '../models/cart_shipping.dart';

/// Free shipping above a limit, three small pieces (the same as on the website). Each draws nothing when the rule is off or the server sent nothing.
///   ShippingFeeRow        a line of the order summary: "Shipping fees +$5" under the limit; at or above it the fee is struck through and says "Free"
///   FreeShippingHint      a note with a progress bar: "Add $30 more for free shipping"; "You've reached $50: shipping is free"; or "Free shipping with your promo code"
///   FreeShippingBadgeOver puts a green "Free shipping" pill over the corner of the Checkout button once shipping is free
///
/// Free shipping is celebrated every time the cart is opened with shipping already free, and the moment it becomes free: the note turns green with a soft
/// glow, a short pulse and a few pieces of confetti (when it has just become free, the progress bar first runs to the end), then the pill pops onto Checkout
/// with a bounce and its truck drives. After that only a light shine crosses the pill every few seconds. With "Remove animations" on in the phone's settings nothing moves: it is simply green.
const Color _green = Color(0xFF1E9D6B);

String _withAmount(BuildContext context, String key, double usd) => tr(context, key).replaceAll('{amount}', formatPrice(context, usd));

class ShippingFeeRow extends StatelessWidget {
  final CartShipping shipping;
  final EdgeInsetsGeometry padding;
  const ShippingFeeRow({super.key, required this.shipping, this.padding = const EdgeInsets.fromLTRB(14, 0, 14, 10)});

  @override
  Widget build(BuildContext context) {
    if (!shipping.enabled) return const SizedBox.shrink();
    final palette = LeapPalette.of(context);
    final free = shipping.chargedUsd == 0;
    return Padding(
      padding: padding,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(tr(context, 'shipping_fees'), style: TextStyle(color: palette.muted, fontSize: 13)),
          if (free)
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(formatPrice(context, shipping.feeUsd), style: TextStyle(color: palette.muted, fontSize: 13, decoration: TextDecoration.lineThrough)),
                const SizedBox(width: 6),
                Text(tr(context, 'shipping_free'), style: const TextStyle(color: _green, fontSize: 13, fontWeight: FontWeight.w700)),
              ],
            )
          else
            Text('+${formatPrice(context, shipping.chargedUsd)}', style: TextStyle(color: palette.ink, fontSize: 13, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

bool _noMotion(BuildContext context) => MediaQuery.maybeOf(context)?.disableAnimations ?? false;

class FreeShippingHint extends StatefulWidget {
  final CartShipping shipping;
  final EdgeInsetsGeometry margin;
  const FreeShippingHint({super.key, required this.shipping, this.margin = const EdgeInsets.fromLTRB(14, 0, 14, 14)});

  @override
  State<FreeShippingHint> createState() => _FreeShippingHintState();
}

class _FreeShippingHintState extends State<FreeShippingHint> with SingleTickerProviderStateMixin {
  // 0.00-0.35 the bar runs to the end; 0.35-1.00 the note is green: glow, pulse and confetti.
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1300));
  double _fromProgress = 0;
  double _fromRemaining = 0;

  static bool _done(CartShipping s) => s.waivedByPromo || s.qualifies;

  @override
  void initState() {
    super.initState();
    // The cart is opened with shipping already free: the green part of the celebration plays (there is no bar to fill).
    if (widget.shipping.enabled && _done(widget.shipping)) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && !_noMotion(context)) _c.forward(from: 0.35);
      });
    }
  }

  @override
  void didUpdateWidget(covariant FreeShippingHint old) {
    super.didUpdateWidget(old);
    if (old.shipping.enabled && widget.shipping.enabled && !_done(old.shipping) && _done(widget.shipping) && !_noMotion(context)) {
      _fromProgress = old.shipping.progress;
      _fromRemaining = old.shipping.remainingUsd;
      _c.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final shipping = widget.shipping;
    if (!shipping.enabled) return const SizedBox.shrink();
    return AnimatedBuilder(
      animation: _c,
      builder: (context, _) {
        final playing = _c.isAnimating;
        final t = _c.value;
        final filling = playing && t < 0.35;                          // still showing the bar running to the end
        final done = _done(shipping) && !filling;
        final text = filling
            ? _withAmount(context, 'shipping_add_more', _fromRemaining)
            : shipping.waivedByPromo ? tr(context, 'shipping_promo_free') : (shipping.qualifies ? _withAmount(context, 'shipping_reached', shipping.thresholdUsd) : _withAmount(context, 'shipping_add_more', shipping.remainingUsd));
        final barValue = filling ? _fromProgress + (1 - _fromProgress) * Curves.easeOut.transform(t / 0.35) : shipping.progress;
        final g = playing && !filling ? (t - 0.35) / 0.65 : 1.0;    // 0..1 through the green part
        final glow = playing && !filling ? (1 - g) : 0.0;
        final pulse = playing && !filling && g < 0.4 ? 1 + 0.04 * math.sin(g / 0.4 * math.pi) : 1.0;
        final Color fg = done ? const Color(0xFF177A53) : const Color(0xFF8A5410);
        final card = Container(
          margin: widget.margin,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          // raised: lit from above, a soft deep shadow
          decoration: BoxDecoration(
            gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: done ? const [Color(0xFFF0FAF5), Color(0xFFDDF1E7)] : const [Color(0xFFFFF9EE), Color(0xFFFFEDD3)]),
            border: Border.all(color: Colors.white),
            borderRadius: BorderRadius.circular(12),
            boxShadow: [
              const BoxShadow(color: Color(0x140B3146), blurRadius: 4, offset: Offset(0, 2)),
              const BoxShadow(color: Color(0x290B3146), blurRadius: 20, spreadRadius: -4, offset: Offset(0, 10)),
              if (glow > 0) BoxShadow(color: _green.withValues(alpha: 0.55 * glow), blurRadius: 18 * glow + 2),
            ],
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.local_shipping_outlined, size: 18, color: fg),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(text, style: TextStyle(color: fg, fontSize: 13, fontWeight: FontWeight.w600)),
                    if (!done) ...[
                      const SizedBox(height: 7),
                      Semantics(
                        label: tr(context, 'shipping_fees'),
                        value: '${(barValue * 100).round()}%',
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(4),
                          child: LinearProgressIndicator(value: barValue, minHeight: 6, backgroundColor: const Color(0xFFF1DDBD), color: _green),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        );
        if (!playing || filling) return card;
        return Stack(
          clipBehavior: Clip.none,
          children: [
            Transform.scale(scale: pulse, child: card),
            Positioned.fill(child: IgnorePointer(child: CustomPaint(painter: _ConfettiPainter(g)))),
          ],
        );
      },
    );
  }
}

/// A few small gold and green pieces flying up out of the note and falling away (p: 0..1).
class _ConfettiPainter extends CustomPainter {
  final double p;
  _ConfettiPainter(this.p);

  static const _pieces = 14;

  @override
  void paint(Canvas canvas, Size size) {
    if (p <= 0 || p >= 1) return;
    final origin = Offset(size.width / 2, 18);
    final paint = Paint();
    for (var i = 0; i < _pieces; i++) {
      final a = -math.pi / 2 + (((i * 37) % 100) / 100 - 0.5) * 2.4;      // spread upwards, the same every time
      final v = 60 + ((i * 53) % 70).toDouble();
      final at = origin + Offset(math.cos(a) * v * p, math.sin(a) * v * p + 120 * p * p);
      paint.color = (i.isEven ? const Color(0xFFF9B317) : _green).withValues(alpha: 1 - p);
      canvas.save();
      canvas.translate(at.dx, at.dy);
      canvas.rotate(p * 7 + i);
      canvas.drawRRect(RRect.fromRectAndRadius(const Rect.fromLTWH(-3, -3, 6, 6), const Radius.circular(2)), paint);
      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(covariant _ConfettiPainter old) => old.p != p;
}

class FreeShippingBadgeOver extends StatefulWidget {
  final CartShipping shipping;
  final Widget child;
  const FreeShippingBadgeOver({super.key, required this.shipping, required this.child});

  @override
  State<FreeShippingBadgeOver> createState() => _FreeShippingBadgeOverState();
}

class _FreeShippingBadgeOverState extends State<FreeShippingBadgeOver> with TickerProviderStateMixin {
  // The pop (with the truck driving) when shipping BECOMES free, after the note's own celebration has started.
  late final AnimationController _pop = AnimationController(vsync: this, duration: const Duration(milliseconds: 900), value: 1);
  // The light shine crossing the pill, every 2.2 seconds while shipping is free.
  late final AnimationController _shine = AnimationController(vsync: this, duration: const Duration(milliseconds: 2200));

  @override
  void initState() {
    super.initState();
    // The cart is opened with shipping already free: the pill pops onto Checkout too.
    if (widget.shipping.isFree) {
      _pop.value = 0;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        if (_noMotion(context)) { _pop.value = 1; return; }
        Future.delayed(const Duration(milliseconds: 250), () { if (mounted) _pop.forward(from: 0); });
      });
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _syncShine();
  }

  @override
  void didUpdateWidget(covariant FreeShippingBadgeOver old) {
    super.didUpdateWidget(old);
    if (!old.shipping.isFree && widget.shipping.isFree && !_noMotion(context)) {
      _pop.value = 0;
      Future.delayed(const Duration(milliseconds: 450), () { if (mounted) _pop.forward(from: 0); });
    }
    _syncShine();
  }

  void _syncShine() {
    final on = widget.shipping.isFree && !_noMotion(context);
    if (on && !_shine.isAnimating) {
      _shine.repeat();
    } else if (!on && _shine.isAnimating) {
      _shine.stop();
      _shine.value = 0;
    }
  }

  @override
  void dispose() {
    _pop.dispose();
    _shine.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.shipping.isFree) return widget.child;
    return Stack(
      clipBehavior: Clip.none,
      children: [
        widget.child,
        // PositionedDirectional: the end corner, so it mirrors in Arabic.
        PositionedDirectional(
          top: -14,
          end: 14,
          child: IgnorePointer(
            child: Semantics(
              label: tr(context, 'shipping_free_badge'),
              excludeSemantics: true,
              child: AnimatedBuilder(
                animation: Listenable.merge([_pop, _shine]),
                builder: (context, _) {
                  final popT = _pop.value;
                  final scale = popT < 1 ? Curves.easeOutBack.transform((popT / 0.45).clamp(0.0, 1.0)) : 1.0;
                  final drive = popT < 1 && popT > 0.4 ? math.sin((popT - 0.4) / 0.6 * math.pi) * 6 : 0.0;
                  final s = _shine.value / (700 / 2200);                    // the shine crosses in the first 0.7 s of each 2.2 s
                  return Transform.scale(
                    scale: scale,
                    child: Container(
                      // raised green
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xFF34C785), _green]),
                        border: Border.all(color: Colors.white, width: 2),
                        borderRadius: BorderRadius.circular(999),
                        boxShadow: const [BoxShadow(color: Color(0x660F6B49), blurRadius: 10, offset: Offset(0, 4))],
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(999),
                        child: Stack(
                          children: [
                            Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Transform.translate(offset: Offset(Directionality.of(context) == TextDirection.rtl ? -drive : drive, 0), child: const Icon(Icons.local_shipping_outlined, size: 14, color: Colors.white)),
                                  const SizedBox(width: 6),
                                  Text(tr(context, 'shipping_free_badge'), style: const TextStyle(color: Colors.white, fontSize: 12.5, fontWeight: FontWeight.w700)),
                                ],
                              ),
                            ),
                            if (s > 0 && s < 1)
                              Positioned.fill(
                                child: FractionalTranslation(
                                  translation: Offset(-1 + 2 * s, 0),
                                  child: const DecoratedBox(
                                    decoration: BoxDecoration(
                                      gradient: LinearGradient(colors: [Color(0x00FFFFFF), Color(0xB3FFFFFF), Color(0x00FFFFFF)], stops: [0.35, 0.5, 0.65]),
                                    ),
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          ),
        ),
      ],
    );
  }
}
