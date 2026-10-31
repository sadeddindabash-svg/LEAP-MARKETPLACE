import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../core/theme.dart';
import '../core/auth_state.dart';
import '../core/language_state.dart';
import '../services/api_client.dart';

/// Proof of delivery for the BUYER (migration 120), used by the order page and by Track your package:
///  * [DeliveryCodeCard]      the 4-digit code the buyer gives the driver; shown only while the parcel is on its way;
///  * [DeliveryAttemptNotice] the driver came but could not deliver (not home, wrong address ...);
///  * [DeliveryProofSummary]  who received it, "confirmed with your code", and "This isn't my parcel / I didn't receive it",
///                            which opens a support ticket for this order.
class DeliveryCodeCard extends StatelessWidget {
  final String code;
  const DeliveryCodeCard({super.key, required this.code});

  @override
  Widget build(BuildContext context) {
    final ar = context.watch<LanguageState>().isArabic;
    final palette = LeapPalette.of(context);
    return Container(
      key: const Key('delivery-code-card'),
      margin: const EdgeInsets.only(top: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: palette.card, borderRadius: BorderRadius.circular(12), border: Border.all(color: palette.torque, width: 1.5)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(ar ? 'رمز التسليم' : 'Your delivery code', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5, color: palette.ink)),
          const SizedBox(height: 4),
          Text(
            ar ? 'أعطِ هذا الرمز للسائق عندما تستلم طردك. لا يمكنه إتمام التسليم بدونه.' : "Give this code to the driver when you receive your parcel. The driver can't complete the delivery without it.",
            style: TextStyle(fontSize: 12, color: palette.muted),
          ),
          const SizedBox(height: 10),
          Directionality(
            textDirection: TextDirection.ltr,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                for (final digit in code.split(''))
                  Container(
                    width: 46,
                    height: 54,
                    margin: const EdgeInsets.symmetric(horizontal: 4),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(color: palette.torque.withValues(alpha: 0.10), borderRadius: BorderRadius.circular(10)),
                    child: Text(digit, style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: palette.torque)),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Text(ar ? 'لا تعطه إلا عندما يكون الطرد بين يديك.' : 'Only give it when the parcel is in your hands.', style: TextStyle(fontSize: 11, color: palette.muted)),
        ],
      ),
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
  bool _sending = false;

  static const _receivedEn = {'buyer': 'you', 'family': 'a family member', 'reception': 'the guard / reception', 'door': 'left at your door'};
  static const _receivedAr = {'buyer': 'أنت', 'family': 'أحد أفراد العائلة', 'reception': 'الحارس / الاستقبال', 'door': 'تُرك عند بابك'};

  Future<void> _report() async {
    final ar = context.read<LanguageState>().isArabic;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(ar ? 'لم تستلم طردك؟' : "Didn't receive your parcel?"),
        content: Text(ar
            ? 'سنفتح طلب دعم لهذا الطلب ونراجع صورة التسليم مع شركة التوصيل. سيتواصل معك فريقنا.'
            : "We'll open a support request for this order and check the delivery photo with the delivery company. Our team will contact you."),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(ar ? 'إلغاء' : 'Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: Text(ar ? 'إرسال' : 'Send')),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    setState(() => _sending = true);
    final auth = context.read<AuthState>();
    final messenger = ScaffoldMessenger.of(context);
    final router = GoRouter.of(context);
    try {
      final ticket = await ApiClient().createTicket(
        token: auth.token,
        guestEmail: auth.token == null ? widget.guestEmail : null,
        orderId: widget.orderId,
        subject: "I didn't receive my parcel (order ${widget.orderId})",
        message: 'Order ${widget.orderId} shows as delivered, but I did not receive this parcel (or the delivery photo is not my parcel). Please check with the delivery company.',
      );
      if (!mounted) return;
      messenger.showSnackBar(SnackBar(content: Text(ar ? 'تم الإرسال. سيتواصل معك فريقنا.' : 'Sent. Our team will contact you.')));
      final id = ticket['id'];
      if (id != null && auth.token != null) router.push('/support/$id');
    } catch (e) {
      if (!mounted) return;
      messenger.showSnackBar(SnackBar(content: Text(ar ? 'تعذّر الإرسال. حاول مرة أخرى.' : 'Could not send. Please try again.')));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

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
        Align(
          alignment: AlignmentDirectional.centerStart,
          child: TextButton(
            key: const Key('report-parcel'),
            onPressed: _sending ? null : _report,
            style: TextButton.styleFrom(padding: EdgeInsets.zero, foregroundColor: const Color(0xFFB42318)),
            child: Text(ar ? 'ليست طردي / لم أستلمه' : "This isn't my parcel / I didn't receive it", style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
          ),
        ),
      ],
    );
  }
}
