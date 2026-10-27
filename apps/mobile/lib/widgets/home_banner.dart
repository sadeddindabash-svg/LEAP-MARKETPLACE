import 'dart:async';
import 'dart:convert';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../core/config/app_config.dart';
import '../core/language_state.dart';
import '../models/home_banner.dart';
import '../services/api_client.dart';

/// The home banner (new): the advertisement photos the admin chose, above the "Shopping for" card. The same switch as the website's home page: it appears only when the admin chose the banner (and there is a photo) -- when
/// the headline is chosen, or the server cannot be read, it takes NO space at all (never an empty gap, never an error).
///
/// Each photo stays for ITS OWN seconds, then the next one slides in (forward for ever: the list has no end); the English or the Arabic photo is shown by the language of the app. It holds still while a finger is on it, while the app
/// is in the background, and for someone whose phone is set to reduce animation (a swipe still changes photo). A photo with a link opens a part, a category, or a web page in the phone's browser.
class HomeBanner extends StatefulWidget {
  /// [client] is only for tests (a fake server); the app passes nothing.
  const HomeBanner({super.key, this.client});

  final http.Client? client;

  @override
  State<HomeBanner> createState() => _HomeBannerState();
}

class _HomeBannerState extends State<HomeBanner> with WidgetsBindingObserver {
  static const double _aspect = 5 / 2; // the photos are 1250 x 500
  static const int _startPage = 10000; // in the middle of a very long list, so it can slide forward for ever

  HomeBannerData _data = HomeBannerData.none;
  PageController? _controller;
  Timer? _timer;
  int _page = 0;
  bool _held = false; // a finger is on the banner
  bool _inForeground = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _load();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _timer?.cancel();
    _controller?.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _inForeground = state == AppLifecycleState.resumed;
    _schedule();
  }

  Future<void> _load() async {
    final client = widget.client ?? http.Client();
    try {
      final response = await client.get(Uri.parse('${AppConfig.apiBaseUrl}/platform-settings/home-banner')).timeout(const Duration(seconds: 10));
      if (response.statusCode != 200) return;
      final data = HomeBannerData.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
      if (!mounted || !data.showBanner) return;
      final start = _startPage - (_startPage % data.slides.length); // a multiple of the number of photos: it starts on the first one
      setState(() {
        _data = data;
        _page = start;
        _controller = PageController(initialPage: start);
      });
      _schedule();
    } catch (_) {
      // The banner is optional: if it cannot be read, the home screen simply goes without it.
    } finally {
      if (widget.client == null) client.close();
    }
  }

  /// Starts the wait for the photo that is on show (its own seconds). Anything that holds the banner, or a change of photo, starts the wait again.
  void _schedule() {
    _timer?.cancel();
    final slides = _data.slides;
    if (!mounted || !_data.showBanner || slides.length < 2 || _held || !_inForeground) return;
    if (MediaQuery.maybeOf(context)?.disableAnimations ?? false) return; // someone who asked for less movement: no automatic sliding
    final seconds = slides[_page % slides.length].seconds;
    _timer = Timer(Duration(seconds: seconds), _advance);
  }

  Future<void> _advance() async {
    final controller = _controller;
    if (!mounted || controller == null || !controller.hasClients) return;
    await controller.nextPage(duration: const Duration(milliseconds: 500), curve: Curves.easeInOut);
    if (mounted) _schedule(); // the next wait starts when the photo has arrived
  }

  Future<void> _open(BannerSlide slide) async {
    final route = slide.route;
    if (route != null) {
      context.push(route);
      return;
    }
    final web = slide.webAddress;
    if (web == null) return;
    try {
      await launchUrl(web, mode: LaunchMode.externalApplication);
    } catch (_) {
      // No browser, or the address could not be opened: nothing to show.
    }
  }

  Widget _picture(BannerSlide slide, bool arabic) {
    const placeholder = ColoredBox(color: Color(0xFFE6EDF2));
    final path = slide.imageFor(arabic: arabic);
    if (path == null) return placeholder;
    return CachedNetworkImage(
      imageUrl: ApiClient.resolveMediaUrl(path),
      fit: BoxFit.cover,
      width: double.infinity,
      height: double.infinity,
      fadeInDuration: const Duration(milliseconds: 150),
      placeholder: (context, url) => placeholder,
      errorWidget: (context, url, error) => placeholder,
    );
  }

  Widget _slide(BannerSlide slide, bool arabic) {
    final description = slide.altFor(arabic: arabic);
    return Semantics(
      label: description.isEmpty ? null : description,
      image: true,
      button: slide.hasLink,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: slide.hasLink ? () => _open(slide) : null,
        child: _picture(slide, arabic),
      ),
    );
  }

  Widget _dots(int count) {
    return ExcludeSemantics(
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          for (var i = 0; i < count; i++)
            Container(
              width: 7,
              height: 7,
              margin: const EdgeInsets.symmetric(horizontal: 2.5),
              decoration: BoxDecoration(shape: BoxShape.circle, color: i == _page % count ? Colors.white : Colors.white54),
            ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final controller = _controller;
    if (!_data.showBanner || controller == null) return const SizedBox.shrink();
    final arabic = context.watch<LanguageState>().isArabic;
    final slides = _data.slides;
    final count = slides.length;
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: AspectRatio(
        aspectRatio: _aspect,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(14),
          child: Stack(
            children: [
              Listener(
                onPointerDown: (_) {
                  _held = true;
                  _timer?.cancel();
                },
                onPointerUp: (_) {
                  _held = false;
                  _schedule();
                },
                onPointerCancel: (_) {
                  _held = false;
                  _schedule();
                },
                child: PageView.builder(
                  controller: controller,
                  onPageChanged: (page) {
                    setState(() => _page = page);
                    _schedule();
                  },
                  itemBuilder: (context, index) => _slide(slides[index % count], arabic),
                ),
              ),
              if (count > 1) Positioned(left: 0, right: 0, bottom: 8, child: _dots(count)),
            ],
          ),
        ),
      ),
    );
  }
}
