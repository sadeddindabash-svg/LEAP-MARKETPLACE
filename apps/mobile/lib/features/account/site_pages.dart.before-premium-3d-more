import 'dart:convert';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../core/theme.dart';
import '../../core/language_state.dart';
import '../../services/api_client.dart';

/// The storefront's footer, inside the app (confirmed with the person via mockup): the SAME data the website footer shows, edited once in the
/// admin portal (Settings): the tagline, the "Help" and "Useful links" titles and wording (a link the admin hid is hidden here too), the
/// social media icons, the copyright line, and the six pages (About us, Terms, Delivery & Shipping, Refund, Privacy, Cancellation).
/// Read from GET /platform-settings/footer and /platform-settings/footer/pages/:key, the same as apps/web-storefront.
/// Each language shows ONLY its own text: an empty English text uses the app's own English wording (never the Arabic), and the other way.

const List<String> kSitePageKeys = ['about', 'terms', 'delivery', 'refund', 'privacy', 'cancellation'];
/// The page's address on the website (a link inside a page to /about-us opens that page here).
const Map<String, String> kSitePageSlugs = {
  'about': 'about-us', 'terms': 'terms-conditions', 'delivery': 'delivery-shipping-policy', 'refund': 'refund-policy',
  'privacy': 'privacy-policy', 'cancellation': 'cancellation-replacement-policy',
};

/// The website's own wording (apps/web-storefront/lib/i18n.ts), used wherever the admin has not set a text in that language.
const Map<String, Map<String, String>> _w = {
  'en': {
    'tagline': 'Real parts, direct from verified suppliers.', 'copyright': 'Copyright © Leap Auto Parts {year}', 'help': 'Help', 'useful': 'Useful links',
    'social': 'Follow us', 'support': 'Support', 'contact': 'Contact us', 'updated': 'Last updated: {date}',
    'preparing': 'This page is being prepared. Please check back soon.', 'back': 'Back',
    'about': 'About us', 'terms': 'Terms & Conditions', 'delivery': 'Delivery & Shipping', 'refund': 'Refund', 'privacy': 'Privacy Policy', 'cancellation': 'Cancellation',
  },
  'ar': {
    'tagline': 'قطع حقيقية مباشرة من موردين موثوقين.', 'copyright': 'حقوق النشر © ليب لقطع السيارات {year}', 'help': 'المساعدة', 'useful': 'روابط مفيدة',
    'social': 'تابعنا', 'support': 'الدعم', 'contact': 'تواصل معنا', 'updated': 'آخر تحديث: {date}',
    'preparing': 'هذه الصفحة قيد الإعداد. يرجى العودة قريباً.', 'back': 'رجوع',
    'about': 'من نحن', 'terms': 'الشروط والأحكام', 'delivery': 'التوصيل والشحن', 'refund': 'الاسترداد', 'privacy': 'سياسة الخصوصية', 'cancellation': 'الإلغاء',
  },
};
String _word(bool ar, String key) => _w[ar ? 'ar' : 'en']![key] ?? key;

/// The admin's text in THIS language only (null when empty).
String? _own(dynamic pair, bool ar) {
  if (pair is! Map) return null;
  final v = pair[ar ? 'ar' : 'en'];
  return v is String && v.trim().isNotEmpty ? v.trim() : null;
}

const _icons = <String, IconData>{
  'about': Icons.info_outline, 'terms': Icons.gavel_outlined, 'delivery': Icons.local_shipping_outlined, 'refund': Icons.undo,
  'privacy': Icons.lock_outline, 'cancellation': Icons.cancel_outlined,
};

class SiteFooterApi {
  static Future<Map<String, dynamic>?> footer() => _get('/platform-settings/footer');
  static Future<Map<String, dynamic>?> page(String key) => _get('/platform-settings/footer/pages/${Uri.encodeComponent(key)}');

  /// null when the shop cannot be reached: the app then uses its own wording, like the website.
  static Future<Map<String, dynamic>?> _get(String path) async {
    try {
      final res = await http.get(Uri.parse('${ApiClient().baseUrl}$path')).timeout(const Duration(seconds: 20));
      if (res.statusCode != 200) return null;
      final body = jsonDecode(res.body);
      return body is Map<String, dynamic> ? body : null;
    } catch (_) {
      return null;
    }
  }
}

Future<void> _openOutside(String url) async {
  final uri = Uri.tryParse(url);
  if (uri == null) return;
  try {
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  } catch (_) {
    // no app can open it: nothing happens
  }
}

/// At the bottom of the Account screen: Help, Useful links, and the navy card (logo, tagline, social media, copyright).
class SiteFooterSection extends StatefulWidget {
  const SiteFooterSection({super.key});

  @override
  State<SiteFooterSection> createState() => _SiteFooterSectionState();
}

class _SiteFooterSectionState extends State<SiteFooterSection> {
  Map<String, dynamic>? _footer;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final data = await SiteFooterApi.footer();
    if (mounted && data != null) setState(() => _footer = data);
  }

  @override
  Widget build(BuildContext context) {
    final ar = context.watch<LanguageState>().isArabic;
    final palette = LeapPalette.of(context);
    final text = _footer?['text'] is Map ? _footer!['text'] as Map : const {};
    final titles = text['titles'] is Map ? text['titles'] as Map : const {};
    final links = text['links'] is Map ? text['links'] as Map : const {};
    final social = (_footer?['social'] is List ? _footer!['social'] as List : const [])
        .whereType<Map>()
        .where((s) => s['url'] is String && (s['url'] as String).trim().isNotEmpty)
        .toList();
    final year = DateTime.now().year.toString();
    final copyright = (_own(text['copyright'], ar) ?? _word(ar, 'copyright')).replaceAll('{year}', year);

    Widget heading(String s) => Padding(
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 8),
          child: Text(s.toUpperCase(), style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 0.5, color: palette.muted)),
        );

    final pageRows = <Widget>[];
    for (final key in kSitePageKeys) {
      final setting = links[key];
      if (setting is Map && setting['shown'] == false) continue;      // the admin hid this link
      pageRows.add(_FooterRow(
        key: Key('site-page-$key'),
        icon: _icons[key]!,
        label: _own(setting, ar) ?? _word(ar, key),
        onTap: () => context.push('/page/$key'),
      ));
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        heading(_own(titles['help'], ar) ?? _word(ar, 'help')),
        _FooterRow(icon: Icons.support_agent_outlined, label: _word(ar, 'support'), onTap: () => context.push('/support')),
        _FooterRow(icon: Icons.mail_outline, label: _word(ar, 'contact'), onTap: () => context.push('/contact-us')),
        if (pageRows.isNotEmpty) ...[
          heading(_own(titles['useful'], ar) ?? _word(ar, 'useful')),
          ...pageRows,
        ],
        Container(
          key: const Key('site-footer-card'),
          margin: const EdgeInsets.fromLTRB(16, 14, 16, 24),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color: const Color(0xFF0F2A3A), borderRadius: BorderRadius.circular(16)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  ClipOval(child: Image.asset('assets/images/leap_logo.png', width: 40, height: 40, fit: BoxFit.cover)),
                  const SizedBox(width: 12),
                  Expanded(child: Text(_own(text['tagline'], ar) ?? _word(ar, 'tagline'), style: const TextStyle(fontSize: 13, color: Color(0xFFA9BAC6)))),
                ],
              ),
              if (social.isNotEmpty) ...[
                const SizedBox(height: 14),
                Text(_word(ar, 'social').toUpperCase(), style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, letterSpacing: 0.5, color: Color(0xFFF2A71B))),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: social.map((s) {
                    final icon = s['icon'] is String && (s['icon'] as String).isNotEmpty ? s['icon'] as String : null;
                    return Semantics(
                      button: true,
                      label: s['name']?.toString() ?? '',
                      child: InkWell(
                        customBorder: const CircleBorder(),
                        onTap: () => _openOutside((s['url'] as String).trim()),
                        child: ClipOval(
                          child: Container(
                            width: 38,
                            height: 38,
                            color: const Color(0xFF1B3A4D),
                            child: icon != null
                                ? CachedNetworkImage(imageUrl: ApiClient.resolveMediaUrl(icon), fit: BoxFit.cover, errorWidget: (_, __, ___) => Image.asset('assets/images/leap_logo.png', fit: BoxFit.cover))
                                : Image.asset('assets/images/leap_logo.png', fit: BoxFit.cover),
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ],
              const SizedBox(height: 14),
              Text(copyright, style: const TextStyle(fontSize: 11.5, color: Color(0xFFA9BAC6))),
            ],
          ),
        ),
      ],
    );
  }
}

class _FooterRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  const _FooterRow({super.key, required this.icon, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final palette = LeapPalette.of(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: onTap,
          child: Container(
            decoration: BoxDecoration(color: palette.card, borderRadius: BorderRadius.circular(14)),
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(color: isDark ? palette.signal.withValues(alpha: 0.12) : palette.signal, borderRadius: BorderRadius.circular(8)),
                  child: Icon(icon, size: 16, color: isDark ? palette.signal : palette.onSignal),
                ),
                const SizedBox(width: 10),
                Expanded(child: Text(label, style: TextStyle(fontSize: 14, color: palette.ink))),
                Icon(Icons.chevron_right, size: 16, color: palette.muted),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

const _monthsEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const _monthsAr = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
String _date(String iso, bool ar) {
  final d = DateTime.tryParse(iso)?.toLocal();
  if (d == null) return '';
  return '${d.day} ${(ar ? _monthsAr : _monthsEn)[d.month - 1]} ${d.year}';
}

/// One of the six pages, inside the app: the admin's title and text in this language only, or "This page is being prepared".
class SitePageScreen extends StatefulWidget {
  final String pageKey;
  const SitePageScreen({super.key, required this.pageKey});

  @override
  State<SitePageScreen> createState() => _SitePageScreenState();
}

class _SitePageScreenState extends State<SitePageScreen> {
  late Future<Map<String, dynamic>?> _page;

  @override
  void initState() {
    super.initState();
    _page = kSitePageKeys.contains(widget.pageKey) ? SiteFooterApi.page(widget.pageKey) : Future.value(null);
  }

  @override
  Widget build(BuildContext context) {
    final ar = context.watch<LanguageState>().isArabic;
    final palette = LeapPalette.of(context);
    final key = kSitePageKeys.contains(widget.pageKey) ? widget.pageKey : 'about';
    return FutureBuilder<Map<String, dynamic>?>(
      future: _page,
      builder: (context, snap) {
        final page = snap.data;
        final title = _own(page?['title'], ar) ?? _word(ar, key);
        final body = _own(page?['body'], ar);
        final updated = page?['updatedAt'] is String ? _date(page!['updatedAt'] as String, ar) : '';
        Widget content;
        if (snap.connectionState != ConnectionState.done) {
          content = const Center(child: Padding(padding: EdgeInsets.all(40), child: CircularProgressIndicator()));
        } else if (body == null) {
          content = Padding(
            key: const Key('site-page-preparing'),
            padding: const EdgeInsets.fromLTRB(24, 60, 24, 24),
            child: Column(
              children: [
                Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(color: palette.signal.withValues(alpha: 0.15), shape: BoxShape.circle),
                  child: Icon(Icons.edit_note, size: 32, color: palette.signal),
                ),
                const SizedBox(height: 14),
                Text(title, textAlign: TextAlign.center, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: palette.ink)),
                const SizedBox(height: 8),
                Text(_word(ar, 'preparing'), textAlign: TextAlign.center, style: TextStyle(fontSize: 14, color: palette.muted)),
                const SizedBox(height: 22),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(onPressed: () => context.pop(), child: Text(_word(ar, 'back'))),
                ),
              ],
            ),
          );
        } else {
          content = Padding(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 32),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: palette.ink)),
                if (updated.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(_word(ar, 'updated').replaceAll('{date}', updated), style: TextStyle(fontSize: 12, color: palette.muted)),
                ],
                const SizedBox(height: 12),
                MiniMarkdown(source: body),
              ],
            ),
          );
        }
        return Scaffold(
          appBar: AppBar(title: Text(title)),
          body: SingleChildScrollView(child: content),
        );
      },
    );
  }
}

// ---- The simple formatting the six pages are written with: the same rules as apps/web-storefront/lib/miniMarkdown.ts ----
//   ## Heading   ### Smaller heading   (a blank line starts a new paragraph; a single line break stays a line break)
//   - item   * item   (a bullet list)   1. item   (a numbered list)   **bold**   [words](https://address)
// A link is kept only for https:, http:, mailto:, tel: or a page of the website (/something); any other address leaves just its words.

class _Inline {
  final String kind;      // text, bold, link
  final String text;
  final String? href;
  const _Inline(this.kind, this.text, [this.href]);
}

class _Block {
  final String kind;      // h2, h3, p, ul, ol
  final List<List<_Inline>> lines;
  const _Block(this.kind, this.lines);
}

String? _safeHref(String href) {
  final h = href.trim();
  if (RegExp(r'^(https?://|mailto:|tel:)', caseSensitive: false).hasMatch(h)) return h;
  if (RegExp(r'^/(?!/)').hasMatch(h)) return h;
  return null;
}

final _inlineRe = RegExp(r'\*\*([^*]{1,500})\*\*|\[([^\]]{1,300})\]\(([^)\s]{1,500})\)');
List<_Inline> _parseInline(String text) {
  final out = <_Inline>[];
  var last = 0;
  for (final m in _inlineRe.allMatches(text)) {
    if (m.start > last) out.add(_Inline('text', text.substring(last, m.start)));
    if (m.group(1) != null) {
      out.add(_Inline('bold', m.group(1)!));
    } else {
      final href = _safeHref(m.group(3)!);
      out.add(href != null ? _Inline('link', m.group(2)!, href) : _Inline('text', m.group(2)!));
    }
    last = m.end;
  }
  if (last < text.length) out.add(_Inline('text', text.substring(last)));
  return out;
}

List<_Block> _parseMarkdown(String source) {
  final blocks = <_Block>[];
  List<List<_Inline>>? para;
  String? listKind;
  List<List<_Inline>>? items;
  void close() {
    if (para != null) blocks.add(_Block('p', para!));
    if (items != null) blocks.add(_Block(listKind!, items!));
    para = null;
    items = null;
    listKind = null;
  }

  for (final raw in source.replaceAll('\r\n', '\n').replaceAll('\r', '\n').split('\n')) {
    final line = raw.trim();
    RegExpMatch? m;
    if (line.isEmpty) {
      close();
      continue;
    }
    if ((m = RegExp(r'^(#{3,})\s+(.*)$').firstMatch(line)) != null) {
      close();
      blocks.add(_Block('h3', [_parseInline(m!.group(2)!)]));
      continue;
    }
    if ((m = RegExp(r'^#{1,2}\s+(.*)$').firstMatch(line)) != null) {
      close();
      blocks.add(_Block('h2', [_parseInline(m!.group(1)!)]));
      continue;
    }
    if ((m = RegExp(r'^[-*]\s+(.*)$').firstMatch(line)) != null) {
      if (items == null || listKind != 'ul') {
        close();
        listKind = 'ul';
        items = [];
      }
      items!.add(_parseInline(m!.group(1)!));
      continue;
    }
    if ((m = RegExp(r'^\d+[.)]\s+(.*)$').firstMatch(line)) != null) {
      if (items == null || listKind != 'ol') {
        close();
        listKind = 'ol';
        items = [];
      }
      items!.add(_parseInline(m!.group(1)!));
      continue;
    }
    if (items != null) close();
    para ??= [];
    para!.add(_parseInline(line));
  }
  close();
  return blocks;
}

/// Draws a page's text (always as text: what an admin types can never become code).
class MiniMarkdown extends StatefulWidget {
  final String source;
  const MiniMarkdown({super.key, required this.source});

  @override
  State<MiniMarkdown> createState() => _MiniMarkdownState();
}

class _MiniMarkdownState extends State<MiniMarkdown> {
  final List<TapGestureRecognizer> _taps = [];

  @override
  void dispose() {
    for (final t in _taps) {
      t.dispose();
    }
    super.dispose();
  }

  void _open(String href) {
    if (href.startsWith('/')) {
      // a page of the website: one of the six opens here; anything else opens nothing
      final slug = href.split(RegExp(r'[?#]')).first.replaceFirst(RegExp(r'^/(ar/)?'), '').replaceAll(RegExp(r'/+$'), '');
      for (final e in kSitePageSlugs.entries) {
        if (e.value == slug || (e.key == 'privacy' && slug == 'privecy-policy')) {
          context.push('/page/${e.key}');
          return;
        }
      }
      return;
    }
    _openOutside(href);
  }

  List<InlineSpan> _spans(List<_Inline> line, TextStyle base, Color link) => line.map((i) {
        if (i.kind == 'bold') return TextSpan(text: i.text, style: base.copyWith(fontWeight: FontWeight.w800));
        if (i.kind == 'link') {
          final tap = TapGestureRecognizer()..onTap = () => _open(i.href!);
          _taps.add(tap);
          return TextSpan(text: i.text, style: base.copyWith(color: link, decoration: TextDecoration.underline, fontWeight: FontWeight.w700), recognizer: tap);
        }
        return TextSpan(text: i.text, style: base);
      }).toList();

  @override
  Widget build(BuildContext context) {
    for (final t in _taps) {
      t.dispose();
    }
    _taps.clear();
    final palette = LeapPalette.of(context);
    final base = TextStyle(fontSize: 14.5, height: 1.6, color: palette.ink);
    final children = <Widget>[];
    for (final b in _parseMarkdown(widget.source)) {
      switch (b.kind) {
        case 'h2':
          children.add(Padding(padding: const EdgeInsets.only(top: 14, bottom: 4), child: Text.rich(TextSpan(children: _spans(b.lines.first, base.copyWith(fontSize: 18, fontWeight: FontWeight.w800, height: 1.3), palette.torque)))));
          break;
        case 'h3':
          children.add(Padding(padding: const EdgeInsets.only(top: 12, bottom: 2), child: Text.rich(TextSpan(children: _spans(b.lines.first, base.copyWith(fontSize: 16, fontWeight: FontWeight.w700, height: 1.3), palette.torque)))));
          break;
        case 'ul':
        case 'ol':
          for (var n = 0; n < b.lines.length; n++) {
            children.add(Padding(
              padding: const EdgeInsetsDirectional.only(start: 4, bottom: 4),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(width: 24, child: Text(b.kind == 'ul' ? '•' : '${n + 1}.', style: base.copyWith(fontWeight: FontWeight.w700))),
                  Expanded(child: Text.rich(TextSpan(children: _spans(b.lines[n], base, palette.torque)))),
                ],
              ),
            ));
          }
          children.add(const SizedBox(height: 6));
          break;
        default:      // a paragraph: its lines, each on its own line
          final spans = <InlineSpan>[];
          for (var n = 0; n < b.lines.length; n++) {
            if (n > 0) spans.add(TextSpan(text: '\n', style: base));
            spans.addAll(_spans(b.lines[n], base, palette.torque));
          }
          children.add(Padding(padding: const EdgeInsets.only(bottom: 10), child: Text.rich(TextSpan(children: spans))));
      }
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: children);
  }
}
