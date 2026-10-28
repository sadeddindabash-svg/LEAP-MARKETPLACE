import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../core/app_strings.dart';
import '../core/auth_state.dart';
import '../core/theme.dart';
import '../core/wishlist_state.dart';

enum WishlistHeartVariant { card, appBar }

/// The heart that saves a part to the wishlist: an outline when it is not saved, red when it is. On a [card] it is a round button for the photo's corner (put it in a PositionedDirectional so it flips in Arabic) and a press
/// never opens the part; in the [appBar] it is an icon button. Signed out, a press opens the sign-in screen. Every colour comes from the app's palette (readable in dark mode); only the red of a saved heart is fixed.
class WishlistHeart extends StatefulWidget {
  final String productId;
  final WishlistHeartVariant variant;
  const WishlistHeart({super.key, required this.productId, this.variant = WishlistHeartVariant.card});

  @override
  State<WishlistHeart> createState() => _WishlistHeartState();
}

class _WishlistHeartState extends State<WishlistHeart> {
  static const _savedRed = Color(0xFFD92D20);

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // follows sign-in and sign-out (it listens to the sign-in state) and loads the shared list when it is missing or old
    WishlistState.instance.ensureLoaded(context.read<AuthState>().token);
  }

  void _press(String? token) {
    if (token == null) {
      context.push('/login');
      return;
    }
    WishlistState.instance.toggle(widget.productId, token);
  }

  @override
  Widget build(BuildContext context) {
    final palette = LeapPalette.of(context);
    final token = context.watch<AuthState>().token;
    return AnimatedBuilder(
      animation: WishlistState.instance,
      builder: (context, _) {
        final state = WishlistState.instance;
        final saved = token != null && state.isSaved(widget.productId);
        final waiting = token != null && !state.ready;
        final label = token == null ? tr(context, 'wishlist_login') : tr(context, saved ? 'wishlist_unsave' : 'wishlist_save');
        final icon = Icon(saved ? Icons.favorite : Icons.favorite_border, size: widget.variant == WishlistHeartVariant.card ? 19 : 24, color: saved ? _savedRed : palette.ink);
        if (widget.variant == WishlistHeartVariant.appBar) {
          return IconButton(onPressed: waiting ? null : () => _press(token), icon: icon, tooltip: label);
        }
        return Tooltip(
          message: label,
          child: Material(
            color: palette.chalk,
            shape: CircleBorder(side: BorderSide(color: palette.line)),
            elevation: 1.5,
            child: InkWell(
              customBorder: const CircleBorder(),
              onTap: waiting ? null : () => _press(token),
              child: SizedBox(width: 34, height: 34, child: Center(child: icon)),
            ),
          ),
        );
      },
    );
  }
}
