import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:leap_mobile/core/fly_to_cart.dart';

// "Fly to cart": the path of the flying photo, the cart number that waits while a part is in the air, and where it is wired in.
void main() {
  group('the path', () {
    test('starts on the photo, ends on the cart, and rises above both on the way', () {
      const from = Offset(100, 600), to = Offset(200, 780);
      expect(FlyToCart.arcPoint(0, from, to), from);
      expect(FlyToCart.arcPoint(1, from, to), to);
      expect(FlyToCart.arcPoint(0.3, from, to).dy, lessThan(from.dy));
    });
  });

  group('the cart number', () {
    testWidgets('CRITICAL: waits (shows the number from before) while a part is in the air, then shows the real one', (tester) async {
      await tester.pumpWidget(MaterialApp(home: FlyCartCount(itemCount: 3, builder: (context, n) => Text('$n'))));
      expect(find.text('3'), findsOneWidget);
      FlyToCart.held.value = 2;
      await tester.pump();
      expect(find.text('2'), findsOneWidget);
      FlyToCart.held.value = null;
      await tester.pump();
      expect(find.text('3'), findsOneWidget);
    });

    testWidgets('with no cart on the screen the part lands at once: nothing is held', (tester) async {
      final source = GlobalKey();
      late BuildContext ctx;
      await tester.pumpWidget(MaterialApp(home: Builder(builder: (context) { ctx = context; return SizedBox(key: source, width: 100, height: 100); })));
      final before = FlyToCart.landings.value;
      FlyToCart.fly(ctx, source: source, imageUrl: null, itemCountBefore: 5);
      expect(FlyToCart.held.value, isNull);
      expect(FlyToCart.landings.value, before + 1);
    });

    testWidgets('CRITICAL: with a cart on the screen a photo flies, and when it lands the number is released', (tester) async {
      final source = GlobalKey();
      late BuildContext ctx;
      await tester.pumpWidget(MaterialApp(home: Scaffold(body: Builder(builder: (context) {
        ctx = context;
        return Column(children: [SizedBox(key: source, width: 100, height: 100), const FlyCartTarget(child: Icon(Icons.shopping_cart_outlined))]);
      }))));
      FlyToCart.fly(ctx, source: source, imageUrl: null, itemCountBefore: 5);
      expect(FlyToCart.held.value, 5);
      await tester.pump(const Duration(milliseconds: 300));
      expect(FlyToCart.held.value, 5);                       // still in the air
      await tester.pumpAndSettle();
      expect(FlyToCart.held.value, isNull);
    });
  });

  group('wired in', () {
    String read(String p) => File(p).readAsStringSync();
    test('the Cart tab and the product screen are landing places; the product screen and the cards send their photo', () {
      final app = read('lib/app.dart');
      expect(app, contains('icon: FlyCartTarget('));
      final product = read('lib/features/catalog/product_screen.dart');
      expect(product, contains('FlyCartTarget('));
      expect(product, contains('FlyToCart.fly(context, source: _photoKey'));
      expect(product, contains('KeyedSubtree(key: photoKey, child: _PhotoGallery('));
      final card = read('lib/widgets/product_card.dart');
      expect(card, contains('FlyToCart.fly(context,'));
      expect(card, contains('key: _photoKey,'));
    });
  });
}
