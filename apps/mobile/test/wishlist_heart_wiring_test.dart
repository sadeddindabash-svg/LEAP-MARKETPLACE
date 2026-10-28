import 'dart:io';
import 'package:flutter_test/flutter_test.dart';

// The wishlist heart in the app: on every card's photo corner (for everyone, flipping in Arabic), in the product screen's top bar, one shared list, the words in both languages, and colours from the palette.
// This reads the source text, so it needs no device. Run from the mobile app's folder (as `flutter test` does).
String _read(String path) => File(path).readAsStringSync();

void main() {
  final card = _read('lib/widgets/product_card.dart');
  final screen = _read('lib/features/catalog/product_screen.dart');
  final strings = _read('lib/core/app_strings.dart');
  final heart = _read('lib/widgets/wishlist_heart.dart');
  final state = _read('lib/core/wishlist_state.dart');

  group('the product card', () {
    test('the heart is on the photo: in the Stack of the photo, at the END corner (PositionedDirectional flips in Arabic)', () {
      expect(card.contains('PositionedDirectional(end: 6, bottom: 6, child: WishlistHeart(productId: p.id)),'), isTrue);
      expect(card.contains("import 'wishlist_heart.dart';"), isTrue);
      final stack = card.indexOf('Stack(');
      final photo = card.indexOf('AspectRatio(');
      final heartAt = card.indexOf('PositionedDirectional(');
      final name = card.indexOf('p.name,');
      expect(stack >= 0 && stack < photo && photo < heartAt && heartAt < name, isTrue, reason: 'Stack > photo > heart, all before the name');
    });
    test('the old heart (signed-in only, in the price row) and the per-card request are gone', () {
      for (final gone in ['_isWishlisted', '_isTogglingWishlist', '_toggleWishlist', '_checkWishlistState', 'isWishlisted(', 'addToWishlist', 'removeFromWishlist', 'Icons.favorite_border', 'if (isLoggedIn) ...[']) {
        expect(card.contains(gone), isFalse, reason: gone);
      }
    });
    test('the add-to-cart button of the card is still there', () {
      expect(card.contains('_addToCart'), isTrue);
      expect(card.contains('Icons.add_shopping_cart'), isTrue);
    });
  });

  group('the product screen', () {
    test('the heart is in the top bar, right before Share', () {
      expect(screen.contains('WishlistHeart(productId: widget.productId, variant: WishlistHeartVariant.appBar),\n          IconButton(icon: const Icon(Icons.share_outlined), onPressed: _shareProduct,'), isTrue);
      expect(screen.contains("import '../../widgets/wishlist_heart.dart';"), isTrue);
    });
    test('the Notify me button is still there', () {
      expect(screen.contains('_NotifyWhenInStockButton'), isTrue);
    });
  });

  group('one shared list', () {
    test('the heart reads the shared state, loads it for the signed-in buyer and follows sign-in and sign-out', () {
      expect(heart.contains('WishlistState.instance.ensureLoaded(context.read<AuthState>().token)'), isTrue);
      expect(heart.contains('context.watch<AuthState>().token'), isTrue);
      expect(heart.contains('animation: WishlistState.instance'), isTrue);
      expect(heart.contains('ApiClient'), isFalse, reason: 'a heart never calls the server itself: it goes through the shared state');
    });
    test('the shared state loads the wishlist once through the app\'s API and saves and removes through it', () {
      expect(state.contains('ApiClient().fetchWishlist(t)'), isTrue);
      expect(state.contains('ApiClient().addToWishlist(token, id)'), isTrue);
      expect(state.contains('ApiClient().removeFromWishlist(token, id)'), isTrue);
    });
  });

  group('the heart itself', () {
    test('signed out, a press opens the sign-in screen and never saves', () {
      expect(heart.contains("if (token == null) {\n      context.push('/login');\n      return;\n    }"), isTrue);
    });
    test('outline when not saved, red when saved; the unsaved colour and the circle come from the palette', () {
      expect(heart.contains('saved ? Icons.favorite : Icons.favorite_border'), isTrue);
      expect(heart.contains('saved ? _savedRed : palette.ink'), isTrue);
      expect(heart.contains('color: palette.chalk,'), isTrue);
      expect(heart.contains('BorderSide(color: palette.line)'), isTrue);
    });
    test('the only fixed colour is the red of a saved heart: no Colors.x, no other Color(0x...)', () {
      expect(heart.contains('Colors.'), isFalse);
      expect(RegExp(r'Color\(0x[0-9A-Fa-f]{8}\)').allMatches(heart).map((m) => m.group(0)).toSet(), equals({'Color(0xFFD92D20)'}));
    });
    test('it cannot be pressed until the list has loaded, and it is labelled (tooltip) with the action', () {
      expect(heart.contains('onTap: waiting ? null : () => _press(token)'), isTrue);
      expect(heart.contains("tr(context, 'wishlist_login')"), isTrue);
      expect(heart.contains("tr(context, saved ? 'wishlist_unsave' : 'wishlist_save')"), isTrue);
    });
  });

  group('the words', () {
    String? entry(String key) => RegExp("    '$key': \\{(.*)\\},").firstMatch(strings)?.group(1);
    test('all three exist in English and in Arabic', () {
      for (final k in ['wishlist_save', 'wishlist_unsave', 'wishlist_login']) {
        final e = entry(k);
        expect(e != null, isTrue, reason: k);
        expect(e!.contains("'en': '"), isTrue, reason: k);
        expect(RegExp(r'[\u0600-\u06FF]').hasMatch(e), isTrue, reason: k);
      }
    });
  });
}
