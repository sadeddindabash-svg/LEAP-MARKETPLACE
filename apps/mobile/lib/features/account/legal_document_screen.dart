import 'package:flutter/material.dart';
import '../../core/theme.dart';

/// Real Terms of Service / Privacy Policy viewer (#146). HONEST
/// SCOPE, stated directly: no real legal content exists anywhere in
/// this codebase (confirmed directly -- searched the entire repo
/// before building this). The infrastructure below (real screen,
/// real navigation, real language-aware rendering) is genuinely
/// functional; the actual text is a clearly-marked placeholder that
/// must be replaced with the business's own real, lawyer-reviewed
/// legal text before this is ever shown to a real user. Never
/// fabricated legal terms -- placeholder text says exactly that,
/// visibly, rather than pretending to be real policy.
class LegalDocumentScreen extends StatelessWidget {
  final LegalDocumentType type;
  const LegalDocumentScreen({super.key, required this.type});

  @override
  Widget build(BuildContext context) {
    final isAr = Localizations.localeOf(context).languageCode == 'ar';
    final palette = LeapPalette.of(context);
    final title = type == LegalDocumentType.terms
        ? (isAr ? 'شروط الخدمة' : 'Terms of Service')
        : (isAr ? 'سياسة الخصوصية' : 'Privacy Policy');

    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: Colors.orange.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(10)),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.warning_amber_rounded, color: Colors.orange.shade800, size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      isAr
                          ? 'هذا نص مؤقت. يجب استبداله بالنص القانوني الفعلي والمعتمد من قِبل الشركة قبل النشر.'
                          : 'This is placeholder text. It must be replaced with the business\'s actual, reviewed legal text before release.',
                      style: TextStyle(color: Colors.orange.shade900, fontSize: 12, fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            Text(title, style: TextStyle(fontWeight: FontWeight.w800, fontSize: 20, color: palette.ink)),
            const SizedBox(height: 12),
            Text(
              type == LegalDocumentType.terms ? _placeholderTermsText(isAr) : _placeholderPrivacyText(isAr),
              style: TextStyle(fontSize: 13.5, height: 1.6, color: palette.ink),
            ),
          ],
        ),
      ),
    );
  }

  String _placeholderTermsText(bool isAr) {
    return isAr
        ? '[نص شروط الخدمة الفعلي يوضع هنا. يجب أن يغطي: استخدام المنصة، حسابات المستخدمين، الطلبات والدفع، الشحن والتسليم، الإرجاع، حل النزاعات، وإنهاء الحساب.]'
        : '[Real Terms of Service text goes here. Should cover: platform use, user accounts, orders and payment, shipping and delivery, returns, dispute resolution, and account termination.]';
  }

  String _placeholderPrivacyText(bool isAr) {
    return isAr
        ? '[نص سياسة الخصوصية الفعلي يوضع هنا. يجب أن يغطي: ما البيانات التي نجمعها، كيف نستخدمها، من نشاركها معه، حقوقك المتعلقة ببياناتك، وكيفية التواصل معنا.]'
        : '[Real Privacy Policy text goes here. Should cover: what data is collected, how it\'s used, who it\'s shared with, your rights regarding your data, and how to contact us.]';
  }
}

enum LegalDocumentType { terms, privacy }
