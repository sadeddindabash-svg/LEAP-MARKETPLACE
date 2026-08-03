import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../core/theme.dart';

/// Real, first-run onboarding walkthrough (new) -- closes a real gap:
/// nothing pointed a brand-new user at My Garage or vehicle-fitment
/// search, this app's own real differentiator, versus every other
/// generic parts-shopping app. Shown once, dismissible, never shown
/// again after that -- tracked with a simple flag in the same real
/// secure storage AuthState already uses (avoids adding a new
/// shared_preferences dependency just for one boolean).
class OnboardingOverlay {
  static const _storage = FlutterSecureStorage();
  static const _seenKey = 'has_seen_onboarding_v1';

  /// Real, one-time check -- shows the walkthrough only if this exact
  /// device has never seen it before. Call from a real, already-
  /// mounted screen's own initState (via a post-frame callback, so a
  /// real BuildContext is safely available to show a dialog with).
  static Future<void> showIfFirstRun(BuildContext context) async {
    final seen = await _storage.read(key: _seenKey);
    if (seen != null) return;
    if (!context.mounted) return;
    await showDialog(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => const _OnboardingDialog(),
    );
    await _storage.write(key: _seenKey, value: 'true');
  }
}

class _OnboardingDialog extends StatefulWidget {
  const _OnboardingDialog();

  @override
  State<_OnboardingDialog> createState() => _OnboardingDialogState();
}

class _OnboardingDialogState extends State<_OnboardingDialog> {
  final _pageController = PageController();
  int _page = 0;

  static const _slideCount = 3;

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  void _finish() => Navigator.of(context).pop();

  void _next() {
    if (_page == _slideCount - 1) {
      _finish();
    } else {
      _pageController.nextPage(duration: const Duration(milliseconds: 250), curve: Curves.easeOut);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isAr = Localizations.localeOf(context).languageCode == 'ar';
    final palette = LeapPalette.of(context);
    return Dialog(
      insetPadding: const EdgeInsets.all(20),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: SizedBox(
        height: 440,
        child: Column(
          children: [
            Align(
              alignment: isAr ? Alignment.centerLeft : Alignment.centerRight,
              child: TextButton(
                onPressed: _finish,
                child: Text(isAr ? 'تخطي' : 'Skip', style: TextStyle(color: palette.muted)),
              ),
            ),
            Expanded(
              child: PageView(
                controller: _pageController,
                onPageChanged: (i) => setState(() => _page = i),
                children: [
                  _OnboardingSlide(
                    icon: Icons.directions_car_outlined,
                    title: isAr ? 'أضف مركبتك' : 'Add your vehicle',
                    body: isAr
                        ? 'احفظ مركبتك في "مرآبي" مرة واحدة، وسنعرض لك فقط القطع المؤكد توافقها معها.'
                        : 'Save your car once in My Garage, and we\'ll show you only parts confirmed to fit it.',
                  ),
                  _OnboardingSlide(
                    icon: Icons.search,
                    title: isAr ? 'بحث مؤكد التوافق' : 'Fitment-confirmed search',
                    body: isAr
                        ? 'صفّي أي بحث حسب الماركة والموديل والجيل والسنة — لا مزيد من التخمين حول القطعة المناسبة.'
                        : 'Filter any search by brand, model, generation, and year — no more guessing whether a part actually fits.',
                  ),
                  _OnboardingSlide(
                    icon: Icons.shopping_bag_outlined,
                    title: isAr ? 'ابدأ التسوق' : 'Start shopping',
                    body: isAr
                        ? 'تصفح القطع الحقيقية المؤكدة التوافق لسيارتك بالضبط.'
                        : 'Browse real, fitment-confirmed parts for your exact car.',
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 0, 24, 20),
              child: Column(
                children: [
                  // Real pill-shaped dot indicators (new), matching the
                  // same real pattern already used on the product
                  // gallery -- a wider active pill, not a plain dot.
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(
                      _slideCount,
                      (i) => AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        margin: const EdgeInsets.symmetric(horizontal: 3),
                        width: i == _page ? 20 : 6,
                        height: 5,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(3),
                          color: i == _page ? palette.signal : palette.line,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: _next,
                      child: Text(_page == _slideCount - 1 ? (isAr ? 'ابدأ' : 'Get started') : (isAr ? 'التالي' : 'Continue').toUpperCase()),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _OnboardingSlide extends StatelessWidget {
  final IconData icon;
  final String title;
  final String body;

  const _OnboardingSlide({required this.icon, required this.title, required this.body});

  @override
  Widget build(BuildContext context) {
    final palette = LeapPalette.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 88,
            height: 88,
            decoration: BoxDecoration(color: palette.chalk, shape: BoxShape.circle),
            child: Icon(icon, size: 40, color: palette.signal),
          ),
          const SizedBox(height: 24),
          Text(title, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: palette.ink), textAlign: TextAlign.center),
          const SizedBox(height: 10),
          Text(body, style: TextStyle(fontSize: 13.5, color: palette.muted), textAlign: TextAlign.center),
        ],
      ),
    );
  }
}
