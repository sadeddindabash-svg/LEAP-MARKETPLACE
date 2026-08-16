import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../core/auth_state.dart';
import '../../services/api_client.dart';

/// Real two-factor setup/management screen (new) -- closes a real,
/// confirmed gap: the backend's own real setup/confirm/disable
/// endpoints (migration 051) and this app's own real ApiClient
/// methods (setupTwoFactor/confirmTwoFactor/disableTwoFactor) already
/// existed, and account_screen.dart's own menu already linked to
/// '/account/two-factor' -- but that route was never registered and
/// this screen never existed, so tapping it did nothing. This is that
/// missing screen.
///
/// Renders the backend's own real, ready-made QR code (a real,
/// complete PNG already encoded as a data URL, decoded directly here
/// via base64) rather than pulling in a separate QR-generation
/// package -- the backend already did that real work.
class TwoFactorSetupScreen extends StatefulWidget {
  const TwoFactorSetupScreen({super.key});

  @override
  State<TwoFactorSetupScreen> createState() => _TwoFactorSetupScreenState();
}

class _TwoFactorSetupScreenState extends State<TwoFactorSetupScreen> {
  bool? _isEnabled;
  Map<String, dynamic>? _pendingSetup;
  final _codeController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isBusy = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _isEnabled = context.read<AuthState>().user?['twoFactorEnabled'] as bool? ?? false;
  }

  @override
  void dispose() {
    _codeController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _startSetup() async {
    final auth = context.read<AuthState>();
    setState(() {
      _isBusy = true;
      _errorMessage = null;
    });
    try {
      final result = await ApiClient().setupTwoFactor(auth.token!);
      if (mounted) setState(() => _pendingSetup = result);
    } on ApiException catch (e) {
      setState(() => _errorMessage = e.message);
    } finally {
      if (mounted) setState(() => _isBusy = false);
    }
  }

  Future<void> _confirmSetup() async {
    if (_codeController.text.trim().isEmpty) return;
    final auth = context.read<AuthState>();
    setState(() {
      _isBusy = true;
      _errorMessage = null;
    });
    try {
      await ApiClient().confirmTwoFactor(auth.token!, _codeController.text.trim());
      // Real sync back to AuthState (new) -- re-fetches the real,
      // now-updated user record so the rest of the real app (this
      // screen included, on a future visit) sees the real, current
      // twoFactorEnabled state, not a stale cached one.
      final updatedUser = await ApiClient().getCurrentUser(auth.token!);
      await auth.updateSession(auth.token!, updatedUser);
      if (mounted) {
        setState(() {
          _isEnabled = true;
          _pendingSetup = null;
          _codeController.clear();
        });
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Two-factor authentication is now on.')));
      }
    } on ApiException catch (e) {
      setState(() => _errorMessage = e.message);
    } finally {
      if (mounted) setState(() => _isBusy = false);
    }
  }

  Future<void> _disable() async {
    if (_passwordController.text.isEmpty) return;
    final auth = context.read<AuthState>();
    setState(() {
      _isBusy = true;
      _errorMessage = null;
    });
    try {
      await ApiClient().disableTwoFactor(auth.token!, _passwordController.text);
      final updatedUser = await ApiClient().getCurrentUser(auth.token!);
      await auth.updateSession(auth.token!, updatedUser);
      if (mounted) {
        setState(() {
          _isEnabled = false;
          _passwordController.clear();
        });
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Two-factor authentication is now off.')));
      }
    } on ApiException catch (e) {
      setState(() => _errorMessage = e.message);
    } finally {
      if (mounted) setState(() => _isBusy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = LeapPalette.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Two-factor authentication')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (_isEnabled == true) ..._buildEnabledState(palette) else ..._buildDisabledState(palette),
          ],
        ),
      ),
    );
  }

  List<Widget> _buildDisabledState(LeapPalette palette) {
    if (_pendingSetup == null) {
      return [
        Icon(Icons.shield_outlined, size: 40, color: palette.signal),
        const SizedBox(height: 16),
        Text(
          'Add an extra layer of security. Once turned on, you\'ll need a code from your authenticator app (like Google Authenticator or Authy) every time you log in, in addition to your password.',
          style: TextStyle(color: palette.muted, fontSize: 13),
        ),
        const SizedBox(height: 20),
        if (_errorMessage != null) ...[
          Text(_errorMessage!, style: const TextStyle(color: Colors.red, fontSize: 12.5)),
          const SizedBox(height: 12),
        ],
        ElevatedButton(
          onPressed: _isBusy ? null : _startSetup,
          child: _isBusy
              ? SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: palette.onSignal))
              : const Text('Turn on two-factor authentication'),
        ),
      ];
    }
    // Real, ready-made QR code (new) -- decodes the backend's own
    // real "data:image/png;base64,..." string directly, no separate
    // QR-rendering package needed.
    final qrDataUrl = _pendingSetup!['qrCodeDataUrl'] as String;
    final base64Data = qrDataUrl.split(',').last;
    final imageBytes = base64Decode(base64Data);
    final secret = _pendingSetup!['secret'] as String;
    return [
      Text('Scan this code with your authenticator app:', style: TextStyle(color: palette.muted, fontSize: 13)),
      const SizedBox(height: 16),
      Center(child: Image.memory(imageBytes, width: 200, height: 200)),
      const SizedBox(height: 16),
      Text('Or enter this key manually:', style: TextStyle(color: palette.muted, fontSize: 12.5)),
      const SizedBox(height: 6),
      Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: palette.card, borderRadius: BorderRadius.circular(8)),
        child: SelectableText(secret, style: const TextStyle(fontWeight: FontWeight.w700, letterSpacing: 1)),
      ),
      const SizedBox(height: 24),
      Text('Then enter the 6-digit code it shows:', style: TextStyle(color: palette.muted, fontSize: 13)),
      const SizedBox(height: 10),
      TextField(
        controller: _codeController,
        keyboardType: TextInputType.number,
        maxLength: 6,
        textAlign: TextAlign.center,
        style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800, letterSpacing: 4),
        decoration: const InputDecoration(counterText: ''),
      ),
      if (_errorMessage != null) ...[
        const SizedBox(height: 12),
        Text(_errorMessage!, style: const TextStyle(color: Colors.red, fontSize: 12.5)),
      ],
      const SizedBox(height: 16),
      ElevatedButton(
        onPressed: _isBusy ? null : _confirmSetup,
        child: _isBusy
            ? SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: palette.onSignal))
            : const Text('Confirm and turn on'),
      ),
    ];
  }

  List<Widget> _buildEnabledState(LeapPalette palette) {
    return [
      Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: palette.gauge.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(10)),
        child: Row(
          children: [
            Icon(Icons.check_circle, color: palette.gauge),
            const SizedBox(width: 10),
            const Expanded(child: Text('Two-factor authentication is on.', style: TextStyle(fontWeight: FontWeight.w600))),
          ],
        ),
      ),
      const SizedBox(height: 24),
      Text('Enter your current password to turn it off:', style: TextStyle(color: palette.muted, fontSize: 13)),
      const SizedBox(height: 10),
      TextField(
        controller: _passwordController,
        obscureText: true,
        decoration: const InputDecoration(labelText: 'Current password', prefixIcon: Icon(Icons.lock_outline)),
      ),
      if (_errorMessage != null) ...[
        const SizedBox(height: 12),
        Text(_errorMessage!, style: const TextStyle(color: Colors.red, fontSize: 12.5)),
      ],
      const SizedBox(height: 16),
      OutlinedButton(
        onPressed: _isBusy ? null : _disable,
        child: _isBusy ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Turn off two-factor authentication'),
      ),
    ];
  }
}
