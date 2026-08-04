import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../core/app_strings.dart';
import '../../core/auth_state.dart';
import '../../core/language_state.dart';
import '../../core/app_lock_state.dart';
import '../../core/push_state.dart';
import '../../core/theme_state.dart';
import '../../services/api_client.dart';

class AccountScreen extends StatefulWidget {
  const AccountScreen({super.key});

  @override
  State<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends State<AccountScreen> {
  int _unreadCount = 0;
  // Real, honestly-computed profile stats (new) -- matches the real
  // Stitch reference's own stats bento concept, but only for the
  // three counts genuinely computable from real data (each fetched
  // fresh here). The reference's fourth stat, "Points," is
  // deliberately NOT shown -- no loyalty-points system exists
  // anywhere in the real backend (Referrals tracks a real reward
  // count, not points, and that's a separate real concept already
  // shown on its own real screen).
  int? _vehicleCount;
  int? _orderCount;
  int? _wishlistCount;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _loadUnreadCount();
    _loadStats();
    // Real push registration (new) -- covers the "already logged in,
    // reopening the app" case (the login screen's own call covers a
    // fresh login). Safe to call every time this screen loads: has
    // its own internal one-time guard, and does nothing at all
    // without a real logged-in session (see PushState's own header
    // comment).
    PushState.initialize(context);
  }

  Future<void> _loadUnreadCount() async {
    final token = context.read<AuthState>().token;
    if (token == null) return;
    try {
      final count = await ApiClient().fetchUnreadNotificationCount(token);
      if (mounted) setState(() => _unreadCount = count);
    } catch (_) {} // non-critical -- the badge just stays at 0 rather than breaking the page
  }

  Future<void> _loadStats() async {
    final token = context.read<AuthState>().token;
    if (token == null) return;
    try {
      final results = await Future.wait([
        ApiClient().fetchMyGarage(token),
        ApiClient().fetchMyOrders(token),
        ApiClient().fetchWishlist(token),
      ]);
      if (mounted) {
        setState(() {
          _vehicleCount = (results[0] as List).length;
          _orderCount = (results[1] as List).length;
          _wishlistCount = (results[2] as List).length;
        });
      }
    } catch (_) {} // non-critical -- stats just stay hidden rather than breaking the page
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
      (icon: Icons.assignment_return_outlined, label: tr(context, 'my_returns'), route: '/returns'),
      (icon: Icons.chat_bubble_outline, label: tr(context, 'leap_support'), route: '/support'),
      (icon: Icons.alternate_email, label: tr(context, 'change_email'), route: '/account/change-email'),
      (icon: Icons.shield_outlined, label: 'Two-factor authentication', route: '/account/two-factor'),
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
                  tooltip: 'Notifications',
                  onPressed: () => context.push('/notifications').then((_) => _loadUnreadCount()),
                ),
                if (_unreadCount > 0)
                  Positioned(
                    right: 6,
                    top: 6,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                      decoration: BoxDecoration(color: LeapPalette.of(context).signal, borderRadius: BorderRadius.circular(8)),
                      constraints: const BoxConstraints(minWidth: 16),
                      child: Text(
                        _unreadCount > 9 ? '9+' : '$_unreadCount',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: LeapPalette.of(context).onSignal, fontSize: 10, fontWeight: FontWeight.w700),
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
          // Real stats bento grid (new) -- only shown once real counts
          // have genuinely loaded, never a placeholder/fake number in
          // the meantime.
          if (auth.isLoggedIn && _vehicleCount != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
              child: Row(
                children: [
                  Expanded(child: _ProfileStat(value: '$_vehicleCount', label: tr(context, 'vehicles_stat'))),
                  const SizedBox(width: 10),
                  Expanded(child: _ProfileStat(value: '$_orderCount', label: tr(context, 'orders_stat'))),
                  const SizedBox(width: 10),
                  Expanded(child: _ProfileStat(value: '$_wishlistCount', label: tr(context, 'wishlist_stat'))),
                ],
              ),
            ),
          const Divider(height: 24),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: Text(
              tr(context, 'account_settings_header').toUpperCase(),
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: LeapPalette.of(context).signalDark, letterSpacing: 1),
            ),
          ),
          ...rows.map((r) => ListTile(
                leading: Icon(r.icon, color: LeapPalette.of(context).ink),
                title: Text(r.label),
                trailing: const Icon(Icons.chevron_right),
                onTap: r.route == null ? null : () => context.push(r.route!),
              )),
          const Divider(height: 1),
          const _LanguageSection(),
          const _ThemeSection(),
          if (auth.isLoggedIn) const _AppLockSection(),
          if (auth.isLoggedIn)
            ListTile(
              leading: Icon(Icons.logout, color: LeapPalette.of(context).muted),
              title: Text(tr(context, 'log_out')),
              onTap: () => context.read<AuthState>().logout(),
            ),
        ],
      ),
    );
  }
}

class _ProfileStat extends StatelessWidget {
  final String value;
  final String label;
  const _ProfileStat({required this.value, required this.label});

  @override
  Widget build(BuildContext context) {
    final palette = LeapPalette.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 14),
      decoration: BoxDecoration(color: palette.chalk, borderRadius: BorderRadius.circular(12), border: Border.all(color: palette.line)),
      child: Column(
        children: [
          Text(value, style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: palette.signal)),
          const SizedBox(height: 2),
          Text(label.toUpperCase(), style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: palette.muted, letterSpacing: 0.5)),
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
    final palette = LeapPalette.of(context);
    return Container(
      // Deliberately, always dark regardless of the active theme --
      // a real design choice matching the reference's own dark hero
      // header across both light and dark mode, not a bug. Uses a
      // proper named dark color (LeapColorsDark.background), not
      // palette.ink, which is semantically a text color being misused
      // as a background would be a real mistake.
      color: LeapColorsDark.background,
      padding: const EdgeInsets.all(20),
      child: Row(
        children: [
          // Real gold accent ring (new) matching the reference's own
          // gold-ringed avatar treatment.
          Container(
            padding: const EdgeInsets.all(2),
            decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: palette.signal, width: 2)),
            child: const CircleAvatar(radius: 22, backgroundColor: Color(0xFF2A2F38), child: Icon(Icons.person, color: Colors.white)),
          ),
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
            style: TextStyle(color: LeapPalette.of(context).muted, fontSize: 12.5),
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
          Text(tr(context, 'language'), style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: LeapPalette.of(context).muted)),
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

// Real dark mode toggle (new) -- closes a real, confirmed gap, the
// single most commonly-requested item from this session's own
// suggestions list. Reuses _LanguageOption for visual consistency
// with the language toggle right above it.
class _ThemeSection extends StatelessWidget {
  const _ThemeSection();

  @override
  Widget build(BuildContext context) {
    final themeState = context.watch<ThemeState>();
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(tr(context, 'appearance'), style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: LeapPalette.of(context).muted)),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: _LanguageOption(
                  label: tr(context, 'light_mode'),
                  selected: themeState.mode == ThemeMode.light,
                  onTap: () => context.read<ThemeState>().setMode(ThemeMode.light),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _LanguageOption(
                  label: tr(context, 'dark_mode'),
                  selected: themeState.mode == ThemeMode.dark,
                  onTap: () => context.read<ThemeState>().setMode(ThemeMode.dark),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _LanguageOption(
                  label: tr(context, 'system_default'),
                  selected: themeState.mode == ThemeMode.system,
                  onTap: () => context.read<ThemeState>().setMode(ThemeMode.system),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// Real biometric app lock toggle (new) -- closes a real gap: no
// optional security setting existed to lock the app behind Face ID/
// fingerprint before showing real account/order info. Only ever
// rendered at all when AppLockState.isSupported is genuinely true --
// no dead toggle shown on a real platform (like web) or a real device
// with no enrolled biometrics AND no device passcode set, where it
// couldn't do anything anyway.
class _AppLockSection extends StatelessWidget {
  const _AppLockSection();

  Future<void> _handleToggle(BuildContext context, bool wantsEnabled) async {
    final lockState = context.read<AppLockState>();
    if (wantsEnabled) {
      // Real, required authentication check before turning this ON --
      // see AppLockState.enable()'s own header comment for why.
      final success = await lockState.enable();
      if (!success && context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(trRead(context, 'app_lock_enable_failed'))),
        );
      }
    } else {
      await lockState.disable();
    }
  }

  @override
  Widget build(BuildContext context) {
    final lockState = context.watch<AppLockState>();
    if (!lockState.isReady || !lockState.isSupported) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(tr(context, 'app_lock_title'), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                const SizedBox(height: 2),
                Text(tr(context, 'app_lock_subtitle'), style: TextStyle(fontSize: 11.5, color: LeapPalette.of(context).muted)),
              ],
            ),
          ),
          Switch(
            value: lockState.isEnabled,
            onChanged: (value) => _handleToggle(context, value),
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
          border: Border.all(color: selected ? LeapPalette.of(context).signal : LeapPalette.of(context).line, width: selected ? 2 : 1),
          borderRadius: BorderRadius.circular(8),
          color: selected ? LeapPalette.of(context).signal.withValues(alpha: 0.06) : Colors.transparent,
        ),
        child: Center(
          child: Text(
            label,
            style: TextStyle(fontWeight: FontWeight.w700, color: selected ? LeapPalette.of(context).signal : LeapPalette.of(context).ink),
          ),
        ),
      ),
    );
  }
}
