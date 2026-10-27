import 'package:flutter_test/flutter_test.dart';
import 'package:leap_mobile/models/home_banner.dart';

// The home banner's data: what the server sends, which language's photo is used, how long each photo stays, where it leads, and when the banner is shown at all.
// The model is plain Dart, so these tests need no device. (The package name is leap_mobile, as in pubspec.yaml.)
Map<String, dynamic> _slide({Object? id = 's1', Object? en = '/uploads/en.jpg', Object? ar = '/uploads/ar.jpg', Object? altEn = 'Summer sale', Object? altAr = 'تخفيضات', Object? link, Object? seconds = 5}) => {
      'id': id,
      'imageEn': en,
      'imageAr': ar,
      'altEn': altEn,
      'altAr': altAr,
      'link': link ?? {'type': 'none', 'value': ''},
      'seconds': seconds,
    };

void main() {
  group('a slide', () {
    test('reads the server\'s fields', () {
      final s = BannerSlide.fromJson(_slide(link: {'type': 'part', 'value': 'p1'}, seconds: 8));
      expect(s.id, equals('s1'));
      expect(s.imageEn, equals('/uploads/en.jpg'));
      expect(s.imageAr, equals('/uploads/ar.jpg'));
      expect(s.seconds, equals(8));
      expect(s.linkType, equals('part'));
      expect(s.linkValue, equals('p1'));
    });

    test('shows the English picture in English and the Arabic one in Arabic', () {
      final s = BannerSlide.fromJson(_slide());
      expect(s.imageFor(arabic: false), equals('/uploads/en.jpg'));
      expect(s.imageFor(arabic: true), equals('/uploads/ar.jpg'));
    });

    test('uses the other language\'s picture when one is missing (or blank)', () {
      expect(BannerSlide.fromJson(_slide(ar: null)).imageFor(arabic: true), equals('/uploads/en.jpg'));
      expect(BannerSlide.fromJson(_slide(ar: '   ')).imageFor(arabic: true), equals('/uploads/en.jpg'));
      expect(BannerSlide.fromJson(_slide(en: null)).imageFor(arabic: false), equals('/uploads/ar.jpg'));
    });

    test('describes the picture in the language of the app, with the same fallback', () {
      final both = BannerSlide.fromJson(_slide());
      expect(both.altFor(arabic: false), equals('Summer sale'));
      expect(both.altFor(arabic: true), equals('تخفيضات'));
      expect(BannerSlide.fromJson(_slide(altAr: '')).altFor(arabic: true), equals('Summer sale'));
      expect(BannerSlide.fromJson(_slide(altEn: '', altAr: '')).altFor(arabic: false), equals(''));
    });

    test('keeps the seconds between 2 and 30, as a whole number, and 5 when they are missing or not a number', () {
      expect(BannerSlide.fromJson(_slide(seconds: 1)).seconds, equals(2));
      expect(BannerSlide.fromJson(_slide(seconds: 2)).seconds, equals(2));
      expect(BannerSlide.fromJson(_slide(seconds: 30)).seconds, equals(30));
      expect(BannerSlide.fromJson(_slide(seconds: 99)).seconds, equals(30));
      expect(BannerSlide.fromJson(_slide(seconds: 4.6)).seconds, equals(5));
      expect(BannerSlide.fromJson(_slide(seconds: null)).seconds, equals(5));
      expect(BannerSlide.fromJson(_slide(seconds: 'soon')).seconds, equals(5));
      expect(BannerSlide.fromJson(_slide(seconds: double.nan)).seconds, equals(5));
    });

    test('a part opens the app\'s product screen, a category its category screen, a web page the browser', () {
      final part = BannerSlide.fromJson(_slide(link: {'type': 'part', 'value': 'p-1'}));
      expect(part.route, equals('/product/p-1'));
      expect(part.webAddress, isNull);
      expect(part.hasLink, isTrue);
      final category = BannerSlide.fromJson(_slide(link: {'type': 'category', 'value': 'brake'}));
      expect(category.route, equals('/category/brake'));
      final web = BannerSlide.fromJson(_slide(link: {'type': 'url', 'value': 'https://example.com/sale?a=1'}));
      expect(web.route, isNull);
      expect(web.webAddress.toString(), equals('https://example.com/sale?a=1'));
      expect(web.hasLink, isTrue);
    });

    test('an id with odd characters cannot change the screen that opens', () {
      final s = BannerSlide.fromJson(_slide(link: {'type': 'part', 'value': 'a/b?c=d'}));
      expect(s.route, equals('/product/a%2Fb%3Fc%3Dd'));
    });

    test('no link, an unknown kind, an empty value or a damaged link all mean "no link"', () {
      for (final link in <Object?>[
        {'type': 'none', 'value': ''},
        {'type': 'part', 'value': ''},
        {'type': 'part', 'value': '   '},
        {'type': 'rocket', 'value': 'x'},
        {'type': 'part'},
        {'type': 5, 'value': 'x'},
        'part:p1',
        null,
      ]) {
        final s = BannerSlide.fromJson(_slide(link: link));
        expect(s.hasLink, isFalse, reason: '$link');
        expect(s.linkType, equals('none'), reason: '$link');
        expect(s.linkValue, equals(''), reason: '$link');
        expect(s.route, isNull);
        expect(s.webAddress, isNull);
      }
    });

    test('a web link is only kept when it is a real http or https address', () {
      for (final bad in ['javascript:alert(1)', 'file:///etc/passwd', 'intent://x', 'example.com/sale', 'https://', 'ftp://example.com', '//example.com']) {
        final s = BannerSlide.fromJson(_slide(link: {'type': 'url', 'value': bad}));
        expect(s.hasLink, isFalse, reason: bad);
        expect(s.linkType, equals('none'), reason: bad);
      }
      expect(BannerSlide.fromJson(_slide(link: {'type': 'url', 'value': 'http://example.com'})).hasLink, isTrue);
    });
  });

  group('the banner', () {
    test('is shown only when the admin chose it AND there is a photo (the same switch as the website)', () {
      final banner = HomeBannerData.fromJson({'mode': 'banner', 'slides': [_slide()]});
      expect(banner.showBanner, isTrue);
      expect(HomeBannerData.fromJson({'mode': 'headline', 'slides': [_slide()]}).showBanner, isFalse);
      expect(HomeBannerData.fromJson({'mode': 'banner', 'slides': []}).showBanner, isFalse);
      expect(HomeBannerData.none.showBanner, isFalse);
    });

    test('a strange mode or a damaged answer shows nothing and does not crash', () {
      expect(HomeBannerData.fromJson({'mode': 'popup', 'slides': [_slide()]}).showBanner, isFalse);
      expect(HomeBannerData.fromJson({'mode': 'popup', 'slides': [_slide()]}).mode, equals('headline'));
      expect(HomeBannerData.fromJson({'slides': [_slide()]}).mode, equals('headline'));
      expect(HomeBannerData.fromJson({'slides': [_slide()]}).showBanner, isFalse);
      expect(HomeBannerData.fromJson({'mode': 'banner'}).showBanner, isFalse);
      expect(HomeBannerData.fromJson({'mode': 'banner', 'slides': 'oops'}).showBanner, isFalse);
      expect(HomeBannerData.fromJson({'mode': 'banner', 'slides': [5, 'x', null]}).showBanner, isFalse);
    });

    test('leaves out a slide that has no picture at all, and keeps the order of the others', () {
      final data = HomeBannerData.fromJson({
        'mode': 'banner',
        'slides': [_slide(id: 'a'), _slide(id: 'b', en: null, ar: null), _slide(id: 'c', en: null)],
      });
      expect(data.slides.map((s) => s.id).toList(), equals(['a', 'c']));
    });

    test('never takes more than 10 slides', () {
      final data = HomeBannerData.fromJson({'mode': 'banner', 'slides': [for (var i = 0; i < 14; i++) _slide(id: 'n$i')]});
      expect(data.slides.length, equals(10));
      expect(data.slides.last.id, equals('n9'));
    });
  });
}
