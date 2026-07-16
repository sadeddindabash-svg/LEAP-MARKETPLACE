import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../core/app_strings.dart';
import '../../core/auth_state.dart';
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(tr(context, 'referrals'))),
      body: _errorMessage != null
          ? Center(child: Text(_errorMessage!, style: const TextStyle(color: LeapColors.muted)))
          : _info == null
              ? const Center(child: CircularProgressIndicator())
              : Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        tr(context, 'referral_explainer'),
                        style: const TextStyle(fontSize: 13, color: LeapColors.muted),
                      ),
                      const SizedBox(height: 20),
                      Text(tr(context, 'your_referral_code'), style: const TextStyle(fontSize: 11.5, color: LeapColors.muted, fontWeight: FontWeight.w700)),
                      const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(color: LeapColors.chalk, borderRadius: BorderRadius.circular(10), border: Border.all(color: LeapColors.line)),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(_info!['code'] as String, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, letterSpacing: 1)),
                            OutlinedButton.icon(onPressed: _copyCode, icon: const Icon(Icons.copy, size: 15), label: Text(tr(context, 'copy_code'))),
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),
                      Row(
                        children: [
                          Expanded(
                            child: Container(
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(border: Border.all(color: LeapColors.line), borderRadius: BorderRadius.circular(10)),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('${_info!['totalReferred']}', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
                                  Text(tr(context, 'people_referred'), style: const TextStyle(fontSize: 11.5, color: LeapColors.muted)),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Container(
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(border: Border.all(color: LeapColors.line), borderRadius: BorderRadius.circular(10)),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('${_info!['rewardsEarned']}/${_info!['maxRewards']}', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
                                  Text(tr(context, 'rewards_earned'), style: const TextStyle(fontSize: 11.5, color: LeapColors.muted)),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                      if (_info!['capReached'] == true) ...[
                        const SizedBox(height: 16),
                        Text(tr(context, 'referral_cap_reached'), style: const TextStyle(fontSize: 12.5, color: LeapColors.muted)),
                      ],
                    ],
                  ),
                ),
    );
  }
}
