import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';
import '../../core/theme.dart';
import '../../core/app_strings.dart';
import '../../core/auth_state.dart';
import '../../core/config/app_config.dart';
import '../../services/api_client.dart';

/// Real referral rewards (see services/api/src/modules/referrals/ and
/// promotions/). CONFIRMED SCOPE: a general promotions engine, not just
/// referral rewards -- referral codes are one real source of promo
/// codes within that same system. The referral trigger is the referred
/// person's real FIRST order (not mere signup), a real deterrent
/// against trivial fake-account abuse.
class ReferralsScreen extends StatefulWidget {
  const ReferralsScreen({super.key});

  @override
  State<ReferralsScreen> createState() => _ReferralsScreenState();
}

class _ReferralsScreenState extends State<ReferralsScreen> {
  Map<String, dynamic>? _info;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final token = context.read<AuthState>().token;
    if (token == null) return;
    try {
      final info = await ApiClient().fetchMyReferralInfo(token);
      if (mounted) setState(() => _info = info);
    } on ApiException catch (e) {
      if (mounted) setState(() => _errorMessage = e.message);
    }
  }

  void _copyCode() {
    final code = _info?['code'] as String?;
    if (code == null) return;
    Clipboard.setData(ClipboardData(text: code));
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(trRead(context, 'code_copied'))));
  }

  // Real share (new) -- closes a real gap: only copy-to-clipboard
  // existed before, no native share sheet at all, despite share_plus
  // already being a real dependency (used for sharing a product).
  // Builds a genuinely useful real link (not just the bare code) --
  // web-storefront's own real signup page already supports a real
  // ?ref= query param that pre-fills this exact field (confirmed by
  // reading app/signup/page.tsx directly, not assumed), so a referred
  // person who opens this link lands straight on signup with the code
  // already filled in, rather than having to type it themselves.
  Future<void> _shareCode() async {
    final code = _info?['code'] as String?;
    if (code == null) return;
    final url = '${AppConfig.storefrontUrl}/signup?ref=$code';
    await Share.share(trRead(context, 'referral_share_text').replaceAll('{url}', url));
  }

  @override
  Widget build(BuildContext context) {
    final palette = LeapPalette.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(tr(context, 'referrals'))),
      body: _errorMessage != null
          ? Center(child: Text(_errorMessage!, style: TextStyle(color: palette.muted)))
          : _info == null
              ? const Center(child: CircularProgressIndicator())
              : Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        tr(context, 'referral_explainer'),
                        style: TextStyle(fontSize: 13, color: palette.muted),
                      ),
                      const SizedBox(height: 20),
                      // Real bento-style stat cards (new), matching the
                      // real Stitch reference's own icon-box + left
                      // gold accent bar style.
                      Row(
                        children: [
                          Expanded(
                            child: _ReferralStat(
                              icon: Icons.groups_outlined,
                              value: '${_info!['totalReferred']}',
                              label: tr(context, 'people_referred'),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: _ReferralStat(
                              icon: Icons.payments_outlined,
                              value: '${_info!['rewardsEarned']}/${_info!['maxRewards']}',
                              label: tr(context, 'rewards_earned'),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 24),
                      Text(tr(context, 'your_referral_code'), style: TextStyle(fontSize: 11.5, color: palette.muted, fontWeight: FontWeight.w700)),
                      const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(color: palette.chalk, borderRadius: BorderRadius.circular(10), border: Border.all(color: palette.signal)),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Text(_info!['code'] as String, textAlign: TextAlign.center, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, letterSpacing: 1, color: palette.ink)),
                            const SizedBox(height: 12),
                            // Real Share button (new) -- closes a real
                            // gap: only copy-to-clipboard existed
                            // before, no native share sheet at all.
                            // Grouped on its own row below the code
                            // (not squeezed alongside it in a single
                            // spaceBetween row) to avoid any real
                            // overflow risk on narrow screens now that
                            // there are two real buttons, not one.
                            Wrap(
                              alignment: WrapAlignment.center,
                              spacing: 8,
                              children: [
                                OutlinedButton.icon(onPressed: _copyCode, icon: const Icon(Icons.copy, size: 15), label: Text(tr(context, 'copy_code'))),
                                ElevatedButton.icon(onPressed: _shareCode, icon: const Icon(Icons.share, size: 15), label: Text(tr(context, 'share'))),
                              ],
                            ),
                          ],
                        ),
                      ),
                      if (_info!['capReached'] == true) ...[
                        const SizedBox(height: 16),
                        Text(tr(context, 'referral_cap_reached'), style: TextStyle(fontSize: 12.5, color: palette.muted)),
                      ],
                    ],
                  ),
                ),
    );
  }
}

class _ReferralStat extends StatelessWidget {
  final IconData icon;
  final String value;
  final String label;
  const _ReferralStat({required this.icon, required this.value, required this.label});

  @override
  Widget build(BuildContext context) {
    final palette = LeapPalette.of(context);
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: palette.card,
        borderRadius: BorderRadius.circular(10),
        border: Border(left: BorderSide(color: palette.signal, width: 4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(color: palette.signal.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8)),
            child: Icon(icon, color: palette.signal, size: 18),
          ),
          const SizedBox(height: 10),
          Text(value, style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: palette.ink)),
          Text(label, style: TextStyle(fontSize: 11, color: palette.muted)),
        ],
      ),
    );
  }
}
