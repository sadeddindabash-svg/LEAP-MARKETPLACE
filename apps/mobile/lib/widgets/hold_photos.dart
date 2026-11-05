import 'dart:async';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../core/theme.dart';
import '../services/api_client.dart';

/// A product card's photo (confirmed with the person via mockup): hold a finger on it for half a second and the product's other photos slide by,
/// one about every second, in a loop, with dots and "2 / 4"; letting go brings back the first photo. While the finger is down a gold ring fills;
/// at half a second the phone gives a small tick and the photo gets a gold edge. A quick tap still opens the product (the hold wins over the tap,
/// so letting go after it does not open it); moving the finger (scrolling) cancels. One photo: nothing happens. Arabic: the photos come from the
/// other side. Reduce motion: they change without sliding.
class HoldPhotos extends StatefulWidget {
  final List<String> images;
  const HoldPhotos({super.key, required this.images});

  @override
  State<HoldPhotos> createState() => _HoldPhotosState();
}

class _HoldPhotosState extends State<HoldPhotos> with SingleTickerProviderStateMixin {
  static const _gold = Color(0xFFF9B317);
  late final AnimationController _ring = AnimationController(vsync: this, duration: const Duration(milliseconds: 500));
  Timer? _cycle;
  bool _showing = false;
  int _index = 0;
  Offset? _down;

  int get _count => widget.images.length;

  void _press(PointerDownEvent e) {
    if (_count < 2) return;
    _down = e.position;
    _ring.forward(from: 0);
  }

  void _move(PointerMoveEvent e) {
    if (_down != null && !_showing && (e.position - _down!).distance > 12) _reset();
  }

  void _start() {
    if (_count < 2) return;
    _ring.reset();
    HapticFeedback.selectionClick();
    setState(() {
      _showing = true;
      _index = 1;
    });
    _cycle?.cancel();
    _cycle = Timer.periodic(const Duration(milliseconds: 1000), (_) {
      if (mounted) setState(() => _index = (_index + 1) % _count);
    });
  }

  void _reset() {
    _down = null;
    _ring.reset();
    _cycle?.cancel();
    if (mounted && (_showing || _index != 0)) {
      setState(() {
        _showing = false;
        _index = 0;
      });
    }
  }

  @override
  void didUpdateWidget(HoldPhotos old) {
    super.didUpdateWidget(old);
    if (_index >= _count) _index = 0;
  }

  @override
  void dispose() {
    _cycle?.cancel();
    _ring.dispose();
    super.dispose();
  }

  Widget _photo(String url) => CachedNetworkImage(
        imageUrl: ApiClient.resolveMediaUrl(url),
        fit: BoxFit.cover,
        width: double.infinity,
        height: double.infinity,
        fadeInDuration: const Duration(milliseconds: 300),
        placeholder: (context, url) => Container(color: const Color(0xFFF5F6F8)),
        errorWidget: (context, url, error) => const Icon(Icons.broken_image_outlined, color: LeapColors.muted),
      );

  @override
  Widget build(BuildContext context) {
    if (widget.images.isEmpty) return const Icon(Icons.album_outlined, size: 32, color: LeapColors.muted);
    final still = MediaQuery.of(context).disableAnimations;
    final rtl = Directionality.of(context) == TextDirection.rtl;
    final current = ValueKey(_index);
    return Listener(
      onPointerDown: _press,
      onPointerMove: _move,
      onPointerUp: (_) => _reset(),
      onPointerCancel: (_) => _reset(),
      child: GestureDetector(
        // the hold (0.5 s) wins over the card's tap, so letting go after it does not open the product
        onLongPressStart: _count < 2 ? null : (_) => _start(),
        onLongPressEnd: _count < 2 ? null : (_) => _reset(),
        child: Stack(
          fit: StackFit.expand,
          children: [
            AnimatedSwitcher(
              duration: Duration(milliseconds: still ? 0 : 420),
              layoutBuilder: (cur, prev) => Stack(fit: StackFit.expand, children: [...prev, if (cur != null) cur]),
              transitionBuilder: (child, anim) => child.key == current
                  ? SlideTransition(
                      position: Tween<Offset>(begin: Offset(rtl ? -1 : 1, 0), end: Offset.zero).animate(CurvedAnimation(parent: anim, curve: const Cubic(0.2, 0.8, 0.2, 1))),
                      child: child,
                    )
                  : FadeTransition(opacity: anim, child: child),
              child: KeyedSubtree(key: current, child: _photo(widget.images[_index.clamp(0, _count - 1)])),
            ),
            if (_count > 1)
              AnimatedBuilder(
                animation: _ring,
                builder: (context, _) => _ring.value == 0 || _showing
                    ? const SizedBox.shrink()
                    : Center(
                        child: SizedBox(
                          width: 42,
                          height: 42,
                          child: CircularProgressIndicator(value: _ring.value, strokeWidth: 4, color: _gold, backgroundColor: const Color(0x330B3146)),
                        ),
                      ),
              ),
            if (_showing) ...[
              IgnorePointer(child: DecoratedBox(decoration: BoxDecoration(border: Border.all(color: _gold, width: 2), borderRadius: BorderRadius.circular(8)))),
              PositionedDirectional(
                top: 6,
                end: 6,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(color: const Color(0xCC0B3146), borderRadius: BorderRadius.circular(8)),
                  child: Text('${_index + 1} / $_count', textDirection: TextDirection.ltr, style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w800)),
                ),
              ),
              Positioned(
                left: 0,
                right: 0,
                bottom: 6,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    for (var i = 0; i < _count; i++)
                      AnimatedContainer(
                        duration: const Duration(milliseconds: 250),
                        margin: const EdgeInsets.symmetric(horizontal: 2),
                        width: i == _index ? 14 : 6,
                        height: 6,
                        decoration: BoxDecoration(color: i == _index ? _gold : const Color(0x400B3146), borderRadius: BorderRadius.circular(3)),
                      ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
