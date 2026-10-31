import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:leap_mobile/widgets/product_gone_view.dart';

// A product the admin deleted: the product screen says it is no longer available.
void main() {
  test('recognises the server answer for a deleted product', () {
    expect(ProductGoneView.isGone(Exception('This product is no longer available')), isTrue);
    expect(ProductGoneView.isGone('HTTP 410'), isTrue);
    expect(ProductGoneView.isGone(Exception('Network error')), isFalse);
  });

  testWidgets('shows the message in English and Arabic', (tester) async {
    for (final lang in ['en', 'ar']) {
      final router = GoRouter(routes: [GoRoute(path: '/', builder: (_, __) => Scaffold(body: ProductGoneView(language: lang)))]);
      await tester.pumpWidget(MaterialApp.router(routerConfig: router));
      await tester.pumpAndSettle();
      expect(find.text(lang == 'ar' ? 'هذا المنتج لم يعد متوفراً' : 'This product is no longer available'), findsOneWidget);
    }
  });

  test('the product screen uses it', () {
    final src = File('lib/features/catalog/product_screen.dart').readAsStringSync();
    expect(src.contains('ProductGoneView.isGone(snapshot.error)'), isTrue);
  });
}
