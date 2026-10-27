import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../core/app_strings.dart';
import '../core/language_state.dart';
import '../models/search_hints.dart';

/// The home search bar, exactly like the website's: a navy banner with a white box and a gold "Search" button, and the four suggestions sliding up one at a time (3 s each, a 0.5 s slide). It sits at the bottom of the home
/// screen's top bar. Pressing anywhere on it opens the search screen (the real typing happens there). Arabic is mirrored. With "reduce motion" on in the phone's settings the suggestions do not move: the plain hint is shown.
const Color _navy = Color(0xFF0B3146);
const Color _gold = Color(0xFFF9B317);

class HomeSearchBar extends StatefulWidget {
  /// 12 px above and below a 48 px box.
  static const double height = 72;
  const HomeSearchBar({super.key});

  @override
  State<HomeSearchBar> createState() => _HomeSearchBarState();
}

class _HomeSearchBarState extends State<HomeSearchBar> {
  Timer? _timer;
  int _tick = 0;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(milliseconds: searchHintShowMs), (_) {
      if (mounted) setState(() => _tick++);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isAr = context.watch<LanguageState>().isArabic;
    final reduceMotion = MediaQuery.of(context).disableAnimations;
    final hint = reduceMotion ? tr(context, 'search_hint') : searchHintAt(isAr, _tick);
    return Directionality(
      textDirection: isAr ? TextDirection.rtl : TextDirection.ltr,
      child: Container(
        height: HomeSearchBar.height,
        width: double.infinity,
        color: _navy,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Semantics(
          button: true,
          label: tr(context, 'search_label'),
          excludeSemantics: true,
          child: Material(
            color: Colors.white,
            borderRadius: BorderRadius.circular(10),
            child: InkWell(
              borderRadius: BorderRadius.circular(10),
              onTap: () => context.push('/search'),
              child: Row(
                children: [
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                      child: ClipRect(
                        child: AnimatedSwitcher(
                          duration: const Duration(milliseconds: searchHintSlideMs),
                          transitionBuilder: (child, animation) {
                            // The new suggestion comes up from below; the old one leaves upwards (its animation runs backwards).
                            final incoming = child.key == ValueKey<String>(hint);
                            final offset = Tween<Offset>(begin: Offset(0, incoming ? 1 : -1), end: Offset.zero).animate(animation);
                            return SlideTransition(position: offset, child: child);
                          },
                          child: Align(
                            key: ValueKey<String>(hint),
                            alignment: AlignmentDirectional.centerStart,
                            child: Text(hint, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 15, color: Color(0xFF53636F))),
                          ),
                        ),
                      ),
                    ),
                  ),
                  Container(
                    margin: const EdgeInsets.all(4),
                    padding: const EdgeInsets.symmetric(horizontal: 22),
                    decoration: BoxDecoration(color: _gold, borderRadius: BorderRadius.circular(8)),
                    alignment: Alignment.center,
                    child: Text(tr(context, 'search_label'), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: _navy)),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
