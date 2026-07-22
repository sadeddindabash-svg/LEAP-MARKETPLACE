import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../core/app_strings.dart';
import '../../core/auth_state.dart';
import '../../core/language_state.dart';
import '../../services/api_client.dart';

class AccountScreen extends StatefulWidget {
  const AccountScreen({super.key});

  @override
  State<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends State<AccountScreen> {
  int _unreadCount = 0;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _loadUnreadCount();
  }

  Future<void> _loadUnreadCount() async {
    final token = context.read<AuthState>().token;
    if (token == null) return;
    try {
      final count = await ApiClient().fetchUnreadNotificationCount(token);
      if (mounted) setState(() => _unreadCount = count);
    } catch (_) {} // non-critical -- the badge just stays at 0 rather than breaking the page
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();

    final rows = [
      (icon: Icons.directions_car_outlined, label: tr(context, 'my_garage'), route: '/garage'),
      (icon: Icons.location_on_outlined, label: tr(context, 'addresses'), route: '/addresses'),
      (icon: Icons.favorite_border, label: tr(context, 'wishlist'), route: '/wishlist'),
      (icon: Icons.bookmark_outlined, label: tr(context, 'saved_searches'), route: '/saved-searches'),
      (icon: Icons.card_giftcard_outlined, label: tr(context, 'referrals'), route: '/referrals'),
      (icon: Icons.inventory_2_outlined, label: tr(context, 'orders_and_returns'), route: '/orders'),
      (icon: Icons.chat_bubble_outline, label: tr(context, 'leap_support'), route: '/support'),
    ];

    return Scaffold(
      appBar: AppBar(
        title: Text(tr(context, 'account')),
        actions: [
          if (auth.isLoggedIn)
            Stack(
              children: [
                IconButton(
                  icon: const Icon(Icons.notifications_none),
                  onPressed: () => context.push('/notifications').then((_) => _loadUnreadCount()),
                ),
                if (_unreadCount > 0)
                  Positioned(
                    right: 6,
                    top: 6,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                      decoration: BoxDecoration(color: LeapColors.signal, borderRadius: BorderRadius.circular(8)),
                      constraints: const BoxConstraints(minWidth: 16),
                      child: Text(
                        _unreadCount > 9 ? '9+' : '$_unreadCount',
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700),
                      ),
                    ),
                  ),
              ],
            ),
        ],
      ),
      body: ListView(
        children: [
          if (auth.isLoading)
            const Padding(
              padding: EdgeInsets.all(24),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (auth.isLoggedIn)
            _LoggedInHeader(user: auth.user!)
          else
            _LoggedOutHeader(),
          const Divider(height: 1),
          ...rows.map((r) => ListTile(
                leading: Icon(r.icon, color: LeapColors.ink),
                title: Text(r.label),
                trailing: const Icon(Icons.chevron_right),
                onTap: r.route == null ? null : () => context.push(r.route!),
              )),
          const Divider(height: 1),
          const _LanguageSection(),
          if (auth.isLoggedIn)
            ListTile(
              leading: const Icon(Icons.logout, color: LeapColors.muted),
              title: Text(tr(context, 'log_out')),
              onTap: () => context.read<AuthState>().logout(),
            ),
        ],
      ),
    );
  }
}

class _LoggedInHeader extends StatelessWidget {
  final Map<String, dynamic> user;
  const _LoggedInHeader({required this.user});

  @override
  Widget build(BuildContext context) {
    final name = (user['name'] as String?) ?? (user['email'] as String);
    return Container(
      color: LeapColors.ink,
      padding: const EdgeInsets.all(20),
      child: Row(
        children: [
          const CircleAvatar(radius: 24, backgroundColor: Color(0xFF2A2F38), child: Icon(Icons.person, color: Colors.white)),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 16)),
                const SizedBox(height: 2),
                Text(user['email'] as String, style: const TextStyle(color: Color(0xFF9AA1AC), fontSize: 12)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _LoggedOutHeader extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(tr(context, 'guest_browsing'), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
          const SizedBox(height: 4),
          Text(
            tr(context, 'guest_prompt'),
            style: const TextStyle(color: LeapColors.muted, fontSize: 12.5),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: ElevatedButton(onPressed: () => context.push('/login'), child: Text(tr(context, 'log_in'))),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton(onPressed: () => context.push('/signup'), child: Text(tr(context, 'sign_up'))),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Real, persistent app-wide language setting — see LanguageState's
/// header comment for exactly what this does and doesn't affect.
class _LanguageSection extends StatelessWidget {
  const _LanguageSection();

  @override
  Widget build(BuildContext context) {
    final languageState = context.watch<LanguageState>();
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(tr(context, 'language'), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: LeapColors.muted)),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: _LanguageOption(
                  label: 'English',
                  selected: !languageState.isArabic,
                  onTap: () => context.read<LanguageState>().setLanguage('en'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _LanguageOption(
                  label: 'العربية',
                  selected: languageState.isArabic,
                  onTap: () => context.read<LanguageState>().setLanguage('ar'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _LanguageOption extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _LanguageOption({required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          border: Border.all(color: selected ? LeapColors.signal : LeapColors.line, width: selected ? 2 : 1),
          borderRadius: BorderRadius.circular(8),
          color: selected ? LeapColors.signal.withOpacity(0.06) : Colors.transparent,
        ),
        child: Center(
          child: Text(
            label,
            style: TextStyle(fontWeight: FontWeight.w700, color: selected ? LeapColors.signal : LeapColors.ink),
          ),
        ),
      ),
    );
  }
}
