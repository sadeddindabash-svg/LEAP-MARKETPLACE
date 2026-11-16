import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/language_state.dart';

/// The product's title in parts (patch-name-car-part, confirmed with the person via mockup):
///   name · brand model · version (years) or All versions (years) · Part No.
/// [full] false (product cards, basket lines): 2 rows. When it does not fit, the first row stays and the second row slides to its end
/// (to the left in English, to the right in Arabic), pauses, and slides back, again and again. "Remove animations" in the phone's settings keeps it still.
/// [full] true (the product page): everything, on as many rows as it needs.
/// Without a fitTitle (an older server) the plain name is shown, as before.
class ProductTitle extends StatelessWidget {
  final Map<String, dynamic>? title;
  final String name;
  final TextStyle style;
  final bool full;
  const ProductTitle({super.key, required this.title, required this.name, required this.style, this.full = false});

  @override
  Widget build(BuildContext context) {
    final isAr = context.watch<LanguageState>().isArabic;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final toks = _titleTokens(title, name, isAr);
    // the same font the text is drawn with, so the measuring matches what is shown
    final look = _Look(DefaultTextStyle.of(context).style.merge(style), dark);
    if (full) return Text.rich(_spans(toks, look, isAr));
    return LayoutBuilder(builder: (context, box) => _CardTitle(toks: toks, look: look, isAr: isAr, maxWidth: box.maxWidth));
  }
}

class _Tok {
  final String kind;      // n, fit, yr, more, sep, pn
  final String text;
  const _Tok(this.kind, this.text);
}

List<_Tok> _words(String? text, String kind) =>
    (text ?? '').split(RegExp(r'\s+')).where((w) => w.isNotEmpty).map((w) => _Tok(kind, w)).toList();

String _more(int n, bool isAr) {
  if (!isAr) return n == 1 ? '+ 1 more car' : '+ $n more cars';
  if (n == 1) return '+ سيارة أخرى';
  if (n == 2) return '+ سيارتان أخريان';
  return '+ $n سيارات أخرى';
}

List<_Tok> _titleTokens(Map<String, dynamic>? t, String name, bool isAr) {
  if (t == null) return _words(name, 'n');
  const sep = _Tok('sep', '·');
  final out = <_Tok>[..._words((t['name'] as String?)?.isNotEmpty == true ? t['name'] as String : name, 'n')];
  final brand = t['brand'] as String?;
  final model = t['model'] as String?;
  if (t['allCars'] == true) {
    out..add(sep)..addAll(_words(isAr ? 'جميع السيارات' : 'All cars', 'fit'));
  } else if (brand != null || model != null) {
    out..add(sep)..addAll(_words([brand, model].whereType<String>().join(' '), 'fit'))..add(sep);
    final listed = (t['versions'] as List?)?.whereType<String>().toList() ?? const <String>[];
    final count = (t['versionCount'] as num?)?.toInt() ?? listed.length;
    final String version;
    if (t['allVersions'] == true || count == 0) {
      version = isAr ? 'جميع الفئات' : 'All versions';
    } else if (count > listed.length) {
      version = isAr ? '$count فئات' : '$count versions';
    } else {
      version = listed.join(' / ');
    }
    out.addAll(_words(version, 'fit'));
    final from = (t['yearFrom'] as num?)?.toInt();
    final to = (t['yearTo'] as num?)?.toInt();
    if (from != null) out.add(_Tok('yr', to != null && to != from ? '($from–$to)' : '($from)'));
    final more = (t['moreCars'] as num?)?.toInt() ?? 0;
    if (more > 0) out.addAll(_words(_more(more, isAr), 'more'));
  }
  final pn = (t['partNumber'] as String?)?.trim();
  if (pn != null && pn.isNotEmpty) out..add(sep)..add(_Tok('pn', pn));
  return out;
}

class _Look {
  final TextStyle base;
  final bool dark;
  const _Look(this.base, this.dark);
  TextStyle get name => base.copyWith(fontWeight: FontWeight.w700);
  TextStyle get fit => base.copyWith(fontWeight: FontWeight.w500);
  TextStyle get more => base.copyWith(fontWeight: FontWeight.w500, color: dark ? const Color(0xFF98A2B3) : const Color(0xFF667085));
  TextStyle get sep => base.copyWith(fontWeight: FontWeight.w700, color: const Color(0xFFC9A24A));
  Paint get chip => Paint()..color = dark ? const Color(0xFF2A2414) : const Color(0xFFF1ECE0);
  TextStyle get pnLabel => base.copyWith(fontWeight: FontWeight.w500, fontSize: (base.fontSize ?? 14) * 0.86, color: dark ? const Color(0xFFC9A24A) : const Color(0xFF8A7440), background: chip);
  TextStyle get pn => base.copyWith(fontWeight: FontWeight.w500, fontSize: (base.fontSize ?? 14) * 0.86, fontFamily: 'monospace', color: dark ? const Color(0xFFE9CF8A) : const Color(0xFF5B4A1D), background: chip);
}

// LRI ... PDI: years and part numbers read left to right inside Arabic text
const _lri = '\u2066';
const _pdi = '\u2069';

TextSpan _spans(List<_Tok> toks, _Look look, bool isAr) {
  final children = <InlineSpan>[];
  for (var i = 0; i < toks.length; i++) {
    final t = toks[i];
    switch (t.kind) {
      case 'sep':
        children.add(TextSpan(text: t.text, style: look.sep));
        break;
      case 'yr':
        children.add(TextSpan(text: '$_lri${t.text}$_pdi', style: look.fit));
        break;
      case 'pn':
        children.add(TextSpan(text: '\u00A0${isAr ? 'رقم\u00A0القطعة' : 'Part\u00A0No.'}\u00A0', style: look.pnLabel));
        children.add(TextSpan(text: '$_lri${t.text}$_pdi\u00A0', style: look.pn));
        break;
      case 'more':
        children.add(TextSpan(text: t.text, style: look.more));
        break;
      case 'n':
        children.add(TextSpan(text: t.text, style: look.name));
        break;
      default:
        children.add(TextSpan(text: t.text, style: look.fit));
    }
    if (i < toks.length - 1) children.add(TextSpan(text: ' ', style: look.fit));
  }
  return TextSpan(children: children, style: look.base);
}

class _CardTitle extends StatelessWidget {
  final List<_Tok> toks;
  final _Look look;
  final bool isAr;
  final double maxWidth;
  const _CardTitle({required this.toks, required this.look, required this.isAr, required this.maxWidth});

  int _lines(BuildContext context, List<_Tok> part, double width) {
    final p = TextPainter(text: _spans(part, look, isAr), textDirection: Directionality.of(context), textScaler: MediaQuery.textScalerOf(context))..layout(maxWidth: width);
    final n = p.computeLineMetrics().length;
    p.dispose();
    return n;
  }

  @override
  Widget build(BuildContext context) {
    final all = _spans(toks, look, isAr);
    if (!maxWidth.isFinite || toks.length < 2 || _lines(context, toks, maxWidth) <= 2) {
      return Text.rich(all, maxLines: 2, overflow: TextOverflow.ellipsis);
    }
    // the words that fill the first row, as the browser would wrap them
    var first = 1;
    while (first < toks.length && _lines(context, toks.sublist(0, first + 1), maxWidth) == 1) {
      first++;
    }
    final rest = toks.sublist(first);
    final restSpan = _spans(rest, look, isAr);
    final p = TextPainter(text: restSpan, textDirection: Directionality.of(context), textScaler: MediaQuery.textScalerOf(context), maxLines: 1)..layout();
    final restWidth = p.width;
    final rowHeight = p.height;
    p.dispose();
    final distance = restWidth - maxWidth + 6;
    return Semantics(
      label: all.toPlainText(),
      excludeSemantics: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text.rich(_spans(toks.sublist(0, first), look, isAr), maxLines: 1, softWrap: false, overflow: TextOverflow.clip),
          _SlidingRow(
            key: ValueKey('${restSpan.toPlainText()}|${maxWidth.round()}'),
            width: maxWidth,
            height: rowHeight,
            distance: distance > 6 ? distance : 0,
            rtl: Directionality.of(context) == TextDirection.rtl,
            child: Text.rich(restSpan, maxLines: 1, softWrap: false),
          ),
        ],
      ),
    );
  }
}

class _SlidingRow extends StatefulWidget {
  final double width;
  final double height;
  final double distance;
  final bool rtl;
  final Widget child;
  const _SlidingRow({super.key, required this.width, required this.height, required this.distance, required this.rtl, required this.child});

  @override
  State<_SlidingRow> createState() => _SlidingRowState();
}

class _SlidingRowState extends State<_SlidingRow> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: Duration(milliseconds: ((4 + widget.distance / 25) * 1000).round()));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final still = MediaQuery.of(context).disableAnimations || widget.distance <= 0;
    if (still) {
      _c.stop();
    } else if (!_c.isAnimating) {
      _c.repeat();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  // 0-18% still, 18-50% slide to the end, 50-68% still, 68-100% slide back (the same as the website)
  double _at(double t) {
    if (t < 0.18) return 0;
    if (t < 0.5) return Curves.easeInOut.transform((t - 0.18) / 0.32);
    if (t < 0.68) return 1;
    return 1 - Curves.easeInOut.transform((t - 0.68) / 0.32);
  }

  @override
  Widget build(BuildContext context) {
    final row = ClipRect(
      child: SizedBox(
        width: widget.width,
        height: widget.height,
        child: OverflowBox(
          alignment: AlignmentDirectional.centerStart,
          minWidth: 0,
          maxWidth: double.infinity,
          child: AnimatedBuilder(
            animation: _c,
            builder: (context, child) => Transform.translate(offset: Offset((widget.rtl ? 1 : -1) * widget.distance * _at(_c.value), 0), child: child),
            child: widget.child,
          ),
        ),
      ),
    );
    if (widget.distance <= 0) return row;
    return ShaderMask(
      blendMode: BlendMode.dstIn,
      shaderCallback: (rect) => LinearGradient(
        begin: widget.rtl ? Alignment.centerRight : Alignment.centerLeft,
        end: widget.rtl ? Alignment.centerLeft : Alignment.centerRight,
        colors: const [Colors.white, Colors.white, Colors.transparent],
        stops: const [0, 0.85, 1],
      ).createShader(rect),
      child: row,
    );
  }
}
