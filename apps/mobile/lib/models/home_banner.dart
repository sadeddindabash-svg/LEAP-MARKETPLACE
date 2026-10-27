// The home banner (new): the advertisement photos the admin chose for the home page. The website's home page shows EITHER its headline OR this banner (one switch in the admin portal); the app follows the same switch,
// so it shows the banner only when the server says mode == 'banner' and there is at least one photo. This file is plain Dart (no Flutter), so it can be tested on its own.
//
// What the server sends (GET /platform-settings/home-banner, public):
//   { "mode": "headline" | "banner", "slides": [ { "id", "imageEn", "imageAr", "altEn", "altAr", "link": { "type": "none"|"part"|"category"|"url", "value" }, "seconds" } ] }

/// One advertisement photo: an English and an Arabic picture, how long it stays on screen, and where it leads.
class BannerSlide {
  static const int defaultSeconds = 5;
  static const int minSeconds = 2;
  static const int maxSeconds = 30;

  final String id;
  final String? imageEn;
  final String? imageAr;
  final String altEn;
  final String altAr;
  final String linkType; // 'none', 'part', 'category' or 'url'
  final String linkValue;
  final int seconds;

  const BannerSlide({
    required this.id,
    this.imageEn,
    this.imageAr,
    this.altEn = '',
    this.altAr = '',
    this.linkType = 'none',
    this.linkValue = '',
    this.seconds = defaultSeconds,
  });

  factory BannerSlide.fromJson(Map<String, dynamic> json) {
    var type = 'none';
    var value = '';
    final link = json['link'];
    if (link is Map) {
      final t = link['type'];
      final v = link['value'];
      if (t is String && v is String && v.trim().isNotEmpty && (t == 'part' || t == 'category' || t == 'url')) {
        type = t;
        value = v.trim();
      }
    }
    // A web address is only ever opened when it really is an http(s) address; anything else is "no link".
    if (type == 'url') {
      final uri = Uri.tryParse(value);
      if (uri == null || !(uri.scheme == 'https' || uri.scheme == 'http') || uri.host.isEmpty) {
        type = 'none';
        value = '';
      }
    }
    final rawSeconds = json['seconds'];
    var seconds = defaultSeconds;
    if (rawSeconds is num && rawSeconds.isFinite) {
      final whole = rawSeconds.round();
      seconds = whole < minSeconds ? minSeconds : (whole > maxSeconds ? maxSeconds : whole);
    }
    return BannerSlide(
      id: '${json['id'] ?? ''}',
      imageEn: _picture(json['imageEn']),
      imageAr: _picture(json['imageAr']),
      altEn: _words(json['altEn']),
      altAr: _words(json['altAr']),
      linkType: type,
      linkValue: value,
      seconds: seconds,
    );
  }

  /// The picture for the language of the app: the Arabic one in Arabic, the English one in English; when that language has none, the other one.
  String? imageFor({required bool arabic}) => arabic ? (imageAr ?? imageEn) : (imageEn ?? imageAr);

  /// The description read aloud to people who cannot see the picture (same fallback as the picture).
  String altFor({required bool arabic}) {
    if (arabic) return altAr.isNotEmpty ? altAr : altEn;
    return altEn.isNotEmpty ? altEn : altAr;
  }

  bool get hasLink => route != null || webAddress != null;

  /// The app screen a part or category link opens (the app's own routes), or null.
  String? get route {
    if (linkType == 'part') return '/product/${Uri.encodeComponent(linkValue)}';
    if (linkType == 'category') return '/category/${Uri.encodeComponent(linkValue)}';
    return null;
  }

  /// The web page a web link opens (in the phone's browser), or null.
  Uri? get webAddress => linkType == 'url' ? Uri.tryParse(linkValue) : null;
}

/// What the home screen needs: whether to show the banner, and its slides.
class HomeBannerData {
  static const int maxSlides = 10;

  final String mode; // 'headline' or 'banner'
  final List<BannerSlide> slides;

  const HomeBannerData({required this.mode, required this.slides});

  /// Nothing to show (also what the app uses while loading, or when the server cannot be read).
  static const HomeBannerData none = HomeBannerData(mode: 'headline', slides: <BannerSlide>[]);

  /// The same switch as the website: the banner only when the admin chose it AND there is a photo to show.
  bool get showBanner => mode == 'banner' && slides.isNotEmpty;

  factory HomeBannerData.fromJson(Map<String, dynamic> json) {
    final raw = json['slides'];
    final slides = <BannerSlide>[];
    if (raw is List) {
      for (final item in raw) {
        if (item is! Map) continue;
        final slide = BannerSlide.fromJson(Map<String, dynamic>.from(item));
        if (slide.imageEn == null && slide.imageAr == null) continue; // a slide without any picture cannot be shown
        slides.add(slide);
        if (slides.length >= maxSlides) break;
      }
    }
    return HomeBannerData(mode: json['mode'] == 'banner' ? 'banner' : 'headline', slides: slides);
  }
}

String? _picture(Object? value) => value is String && value.trim().isNotEmpty ? value.trim() : null;
String _words(Object? value) => value is String ? value.trim() : '';
