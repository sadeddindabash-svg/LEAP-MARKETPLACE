import 'dart:async';
import 'package:flutter/material.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import '../app.dart' show appRouter;

/// Opens what a notification points to (the same places as the Notifications list) (patch-push-banners).
void openPushLink(Map<String, dynamic> data) {
  final type = (data['linkType'] as String?) ?? '';
  final id = (data['linkId'] as String?) ?? '';
  String path = '/notifications';
  if (type == 'order' && id.isNotEmpty) {
    path = '/orders/$id';
  } else if (type == 'ticket' && id.isNotEmpty) {
    path = '/support/$id';
  } else if (type == 'product' && id.isNotEmpty) {
    path = '/product/$id';
  } else if (type == 'saved_search') {
    path = '/saved-searches';
  } else if (type == 'promo_code') {
    path = '/referrals';
  }
  try {
    appRouter.push(path);
  } catch (err) {
    debugPrint('[push] could not open $path: $err');
  }
}

/// The gold strip at the top while LEAP is open (confirmed with the person via mockup): order notifications only,
/// for 5 seconds; "View" opens the order. Price drops and back-in-stock alerts stay quiet (choice A).
class PushBanner {
  static OverlayEntry? _entry;
  static Timer? _timer;

  static void show(RemoteMessage message) {
    final n = message.notification;
    if (n == null) return;
    final overlay = appRouter.routerDelegate.navigatorKey.currentState?.overlay;
    if (overlay == null) return;
    hide();
    _entry = OverlayEntry(
      builder: (context) => _Strip(
        title: n.title ?? '',
        body: n.body,
        onView: () {
          hide();
          openPushLink(message.data);
        },
        onClose: hide,
      ),
    );
    overlay.insert(_entry!);
    _timer = Timer(const Duration(seconds: 5), hide);
  }

  static void hide() {
    _timer?.cancel();
    _timer = null;
    _entry?.remove();
    _entry = null;
  }
}

class _Strip extends StatelessWidget {
  final String title;
  final String? body;
  final VoidCallback onView;
  final VoidCallback onClose;
  const _Strip({required this.title, required this.body, required this.onView, required this.onClose});

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final isAr = Directionality.of(context) == TextDirection.rtl;
    const gold = Color(0xFFC9A24A);
    const navy = Color(0xFF0B3146);
    final card = dark ? const Color(0xFF171C24) : Colors.white;
    final ink = dark ? const Color(0xFFE7EBF1) : const Color(0xFF16202C);
    final muted = dark ? const Color(0xFF98A2B3) : const Color(0xFF667085);
    return Positioned(
      top: 0,
      left: 0,
      right: 0,
      child: SafeArea(
        child: TweenAnimationBuilder<double>(
          tween: Tween(begin: -1, end: 0),
          duration: const Duration(milliseconds: 260),
          curve: Curves.easeOut,
          builder: (context, v, child) => FractionalTranslation(translation: Offset(0, v), child: child),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
            child: Dismissible(
              key: const ValueKey('push-strip'),
              direction: DismissDirection.up,
              onDismissed: (_) => onClose(),
              child: Material(
                color: card,
                elevation: 8,
                shadowColor: Colors.black38,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14), side: const BorderSide(color: gold, width: 1.5)),
                child: InkWell(
                  borderRadius: BorderRadius.circular(14),
                  onTap: onView,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    child: Row(
                      children: [
                        Container(
                          width: 30,
                          height: 30,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(color: navy, borderRadius: BorderRadius.circular(8), border: Border.all(color: gold, width: 1.2)),
                          child: const Text('L', style: TextStyle(color: gold, fontWeight: FontWeight.w800, fontSize: 14)),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: ink)),
                              if (body != null && body!.isNotEmpty)
                                Text(body!, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, color: muted)),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(isAr ? 'عرض' : 'View', style: const TextStyle(fontWeight: FontWeight.w700, color: gold, fontSize: 13.5)),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
