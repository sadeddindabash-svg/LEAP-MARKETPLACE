import 'dart:io';
import 'package:flutter_test/flutter_test.dart';

// Free shipping is celebrated every time the cart is opened with shipping already free, and the moment it becomes free (then the bar first runs to the end):
// the note turns green (glow, pulse, confetti), the pill pops onto Checkout and its truck drives; afterwards only a shine crosses the pill. With "Remove
// animations" on nothing moves. Reads the source text, so it needs no device.
void main() {
  final w = File('lib/widgets/free_shipping.dart').readAsStringSync();
  test('CRITICAL: the celebration starts only when the cart changes from not free to free', () {
    expect(w.contains('!_done(old.shipping) && _done(widget.shipping) && !_noMotion(context)'), isTrue);
    expect(w.contains('if (!old.shipping.isFree && widget.shipping.isFree && !_noMotion(context))'), isTrue);
  });
  test('CRITICAL: opening the cart with shipping already free celebrates too (the green part, and the pill pops)', () {
    expect(w.contains('if (mounted && !_noMotion(context)) _c.forward(from: 0.35);'), isTrue);
    expect(w.contains("Future.delayed(const Duration(milliseconds: 250), () { if (mounted) _pop.forward(from: 0); });"), isTrue);
  });
  test('the bar first runs to the end, then the note is green with a glow and confetti', () {
    expect(w.contains('final filling = playing && t < 0.35;'), isTrue);
    expect(w.contains('_ConfettiPainter(g)'), isTrue);
    expect(w.contains('BoxShadow(color: _green.withValues(alpha: 0.55 * glow)'), isTrue);
  });
  test('the pill pops with a bounce, and a shine crosses it every 2.2 seconds', () {
    expect(w.contains('Curves.easeOutBack'), isTrue);
    expect(w.contains('Duration(milliseconds: 2200)'), isTrue);
    expect(w.contains('_shine.repeat();'), isTrue);
  });
  test('"Remove animations" stops it all', () {
    expect(w.contains('MediaQuery.maybeOf(context)?.disableAnimations ?? false'), isTrue);
    expect(w.contains('final on = widget.shipping.isFree && !_noMotion(context);'), isTrue);
  });
}
