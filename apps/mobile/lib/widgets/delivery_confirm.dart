import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/theme.dart';
import '../core/language_state.dart';

/// Proof of delivery for the BUYER (migration 120), used by the order page and by Track your package:
///  * [DeliveryCodeCard]      the 4-digit code the buyer gives the driver; shown only while the parcel is on its way;
///  * [DeliveryAttemptNotice] the driver came but could not deliver (not home, wrong address ...);
///  * [DeliveryProofSummary]  who received it and "confirmed with your code".
/// "Your delivery code" in ONE box that changes in place (the same as the website): "Is the driver at your door?" → Yes → (the same box) "Did you
/// check the parcel?" → Yes → "Show the code" → the code. "Hide the code" starts again. Three small dots show how far the buyer is.
/// A phone set to reduce motion sees the same box without movement.
class DeliveryCodeCard extends StatefulWidget {
  final String code;
  const DeliveryCodeCard({super.key, required this.code});

  @override
  State<DeliveryCodeCard> createState() => _DeliveryCodeCardState();
}

class _DeliveryCodeCardState extends State<DeliveryCodeCard> with SingleTickerProviderStateMixin {
  static const _gold = Color(0xFFF9B317);
  static const _green = Color(0xFF0F6B49);
  static const _navy = Color(0xFF0B3146);
  static const _cream = Color(0xFFFFFAEB);
  int _stage = 0; // 0: driver at the door? · 1: parcel checked? · 2: show the code · 3: the code
  late final AnimationController _pulse = AnimationController(vsync: this, duration: const Duration(milliseconds: 800));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.of(context).disableAnimations) {
      _pulse.stop();
    } else if (!_pulse.isAnimating) {
      _pulse.repeat(reverse: true);
    }
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ar = context.watch<LanguageState>().isArabic;
    final palette = LeapPalette.of(context);
    final still = MediaQuery.of(context).disableAnimations;
    return Container(
      key: const Key('delivery-code-card'),
      margin: const EdgeInsets.only(top: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: palette.card, borderRadius: BorderRadius.circular(16), border: Border.all(color: palette.line), boxShadow: const [BoxShadow(color: Color(0x140B3146), blurRadius: 10, offset: Offset(0, 2))]),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(ar ? 'رمز التسليم' : 'Your delivery code', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: palette.ink)),
          const SizedBox(height: 10),
          AnimatedContainer(
            key: const Key('delivery-code-box'),
            duration: const Duration(milliseconds: 300),
            width: double.infinity,
            constraints: const BoxConstraints(minHeight: 172),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: _stage == 3 ? Colors.white : _cream,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: _gold, width: _stage == 3 ? 2 : 1.5),
            ),
            child: ClipRect(
              child: AnimatedSwitcher(
                duration: Duration(milliseconds: still ? 0 : 400),
                switchInCurve: const Cubic(0.2, 0.8, 0.2, 1),
                layoutBuilder: (current, previous) => Stack(alignment: Alignment.center, children: [if (current != null) current]),
                transitionBuilder: (child, anim) => FadeTransition(
                  opacity: anim,
                  child: SlideTransition(position: Tween<Offset>(begin: Offset(ar ? -0.08 : 0.08, 0), end: Offset.zero).animate(anim), child: child),
                ),
                child: KeyedSubtree(key: ValueKey(_stage), child: _page(context, ar)),
              ),
            ),
          ),
          const SizedBox(height: 8),
          Center(child: Text(ar ? 'لا ترسل الرمز أبداً برسالة أو مكالمة.' : 'Never send the code by message or phone call.', textAlign: TextAlign.center, style: TextStyle(fontSize: 11.5, color: palette.muted))),
        ],
      ),
    );
  }

  Widget _page(BuildContext context, bool ar) {
    final palette = LeapPalette.of(context);
    final tell = ar ? 'أخبر السائق بهذا الرمز' : 'Tell the driver this code';
    final title = TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: _navy);
    if (_stage == 3) {
      return Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('🗣️ $tell', textAlign: TextAlign.center, style: title),
          const SizedBox(height: 10),
          Directionality(
            textDirection: TextDirection.ltr,
            child: Row(
              key: const Key('delivery-code-digits'),
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                for (final digit in widget.code.split(''))
                  Container(
                    width: 46,
                    height: 54,
                    margin: const EdgeInsets.symmetric(horizontal: 4),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(color: const Color(0xFFF4F6F8), borderRadius: BorderRadius.circular(10)),
                    child: Text(digit, style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: _navy, fontFamily: 'monospace')),
                  ),
              ],
            ),
          ),
          TextButton(
            key: const Key('delivery-code-hide'),
            onPressed: () => setState(() => _stage = 0),
            child: Text(ar ? 'إخفاء الرمز' : 'Hide the code', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: palette.muted, decoration: TextDecoration.underline)),
          ),
        ],
      );
    }
    final (icon, question, sub) = switch (_stage) {
      0 => ('🚚', ar ? 'هل السائق عند بابك؟' : 'Is the driver at your door?', ar ? 'قابله بنفسك' : 'Meet him yourself'),
      1 => ('📦', ar ? 'هل تحققت من الطرد؟' : 'Did you check the parcel?', ar ? 'عليه ملصق ليب واسمك' : 'The Leap label and your name are on it'),
      _ => ('🔒', tell, ''),
    };
    final showCode = _stage == 2;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 52,
          height: 52,
          alignment: Alignment.center,
          decoration: const BoxDecoration(color: _navy, shape: BoxShape.circle, boxShadow: [BoxShadow(color: _gold, spreadRadius: 6), BoxShadow(color: Colors.white, spreadRadius: 4)]),
          child: Text(icon, style: const TextStyle(fontSize: 24)),
        ),
        const SizedBox(height: 12),
        Text(question, textAlign: TextAlign.center, style: title),
        if (sub.isNotEmpty) ...[const SizedBox(height: 2), Text(sub, textAlign: TextAlign.center, style: TextStyle(fontSize: 12.5, color: palette.muted))],
        const SizedBox(height: 10),
        ScaleTransition(
          scale: Tween<double>(begin: 1, end: 1.04).animate(CurvedAnimation(parent: _pulse, curve: Curves.easeInOut)),
          child: FilledButton(
            key: Key(showCode ? 'delivery-code-show' : 'delivery-code-yes'),
            style: FilledButton.styleFrom(
              backgroundColor: showCode ? _gold : _navy,
              foregroundColor: showCode ? _navy : Colors.white,
              minimumSize: const Size(140, 44),
              padding: const EdgeInsets.symmetric(horizontal: 20),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              textStyle: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800),
            ),
            onPressed: () => setState(() => _stage++),
            child: Text(showCode ? '🔓 ${ar ? 'إظهار الرمز' : 'Show the code'}' : (ar ? 'نعم' : 'Yes')),
          ),
        ),
        const SizedBox(height: 8),
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (var i = 0; i < 3; i++)
              AnimatedContainer(
                duration: const Duration(milliseconds: 300),
                margin: const EdgeInsets.symmetric(horizontal: 2.5),
                width: i == _stage ? 18 : 7,
                height: 7,
                decoration: BoxDecoration(color: i < _stage ? _green : i == _stage ? _gold : const Color(0xFFE6D7AD), borderRadius: BorderRadius.circular(4)),
              ),
          ],
        ),
      ],
    );
  }
}

class DeliveryAttemptNotice extends StatelessWidget {
  final Map<String, dynamic> attempt;
  const DeliveryAttemptNotice({super.key, required this.attempt});

  static const _en = {
    'not_home': "The driver came but couldn't reach you. Our team will contact you to arrange a new delivery time.",
    'wrong_address': "The driver couldn't find your address. Please check the address in your order; our team will contact you.",
    'refused': 'The driver reported that the parcel was refused. Contact us if this is a mistake.',
    'other': "The driver couldn't deliver your parcel. Our team will contact you.",
  };
  static const _ar = {
    'not_home': 'حضر السائق لكنه لم يتمكن من الوصول إليك. سيتواصل معك فريقنا لترتيب موعد توصيل جديد.',
    'wrong_address': 'لم يتمكن السائق من الوصول إلى عنوانك. يرجى التحقق من العنوان في طلبك، وسيتواصل معك فريقنا.',
    'refused': 'أفاد السائق بأن الطرد رُفض. تواصل معنا إذا كان ذلك خطأ.',
    'other': 'لم يتمكن السائق من تسليم طردك. سيتواصل معك فريقنا.',
  };

  @override
  Widget build(BuildContext context) {
    final ar = context.watch<LanguageState>().isArabic;
    final reason = attempt['reason'] as String? ?? 'other';
    final text = (ar ? _ar : _en)[reason] ?? (ar ? _ar : _en)['other']!;
    return Container(
      key: const Key('delivery-attempt-notice'),
      margin: const EdgeInsets.only(top: 10),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: const Color(0xFFFFF4E5), borderRadius: BorderRadius.circular(10)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.info_outline, size: 18, color: Color(0xFFB54708)),
          const SizedBox(width: 8),
          Expanded(child: Text(text, style: const TextStyle(fontSize: 12, color: Color(0xFF7A4E00)))),
        ],
      ),
    );
  }
}

class DeliveryProofSummary extends StatefulWidget {
  final Map<String, dynamic> proof;
  final String orderId;
  final String? guestEmail;
  const DeliveryProofSummary({super.key, required this.proof, required this.orderId, this.guestEmail});

  @override
  State<DeliveryProofSummary> createState() => _DeliveryProofSummaryState();
}

class _DeliveryProofSummaryState extends State<DeliveryProofSummary> {
  static const _receivedEn = {'buyer': 'you', 'family': 'a family member', 'reception': 'the guard / reception', 'door': 'left at your door'};
  static const _receivedAr = {'buyer': 'أنت', 'family': 'أحد أفراد العائلة', 'reception': 'الحارس / الاستقبال', 'door': 'تُرك عند بابك'};

  @override
  Widget build(BuildContext context) {
    final ar = context.watch<LanguageState>().isArabic;
    final palette = LeapPalette.of(context);
    final receivedBy = widget.proof['receivedBy'] as String?;
    final verified = widget.proof['verified'] == true;
    final who = receivedBy == null ? null : (ar ? _receivedAr : _receivedEn)[receivedBy];
    return Column(
      key: const Key('delivery-proof-summary'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (who != null) ...[
          const SizedBox(height: 6),
          Text(
            ar ? 'استلمه: $who${verified ? ' · أكّده السائق برمزك' : ''}' : 'Received by: $who${verified ? ' · confirmed by the driver with your code' : ''}',
            style: TextStyle(fontSize: 12, color: palette.ink),
          ),
        ],
      ],
    );
  }
}
