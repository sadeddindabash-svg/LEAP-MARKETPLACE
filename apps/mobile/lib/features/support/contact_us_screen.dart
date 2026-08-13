import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme.dart';

/// Real Contact Us screen (#148) -- consolidates only the real
/// support channels that actually exist in this app. HONEST SCOPE:
/// no real support email or phone number is configured anywhere in
/// this codebase (confirmed directly) -- neither is shown here,
/// never a fabricated contact method.
class ContactUsScreen extends StatelessWidget {
  const ContactUsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final palette = LeapPalette.of(context);
    final isAr = Localizations.localeOf(context).languageCode == 'ar';
    return Scaffold(
      appBar: AppBar(title: Text(isAr ? 'تواصل معنا' : 'Contact us')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: ListTile(
              leading: Icon(Icons.chat_bubble_outline, color: palette.signal),
              title: Text(isAr ? 'الدعم' : 'Support'),
              subtitle: Text(isAr ? 'تحدث معنا حول طلب أو مشكلة' : 'Chat with us about an order or issue'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => context.push('/support'),
            ),
          ),
          Card(
            child: ListTile(
              leading: Icon(Icons.bug_report_outlined, color: palette.signal),
              title: Text(isAr ? 'الإبلاغ عن مشكلة' : 'Report a bug'),
              subtitle: Text(isAr ? 'أخبرنا بما لم يعمل بشكل صحيح' : 'Tell us what went wrong with the app'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => context.push('/report-bug'),
            ),
          ),
        ],
      ),
    );
  }
}
