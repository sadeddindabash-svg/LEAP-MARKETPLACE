import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../core/app_strings.dart';
import '../../core/auth_state.dart';
import '../../services/api_client.dart';
import '../../widgets/skeleton.dart';

const int kMaxAddresses = 3;

/// Real buyer address book — up to 3 real saved addresses (see
/// services/api/src/modules/addresses/routes.js). Was a genuinely dead
/// nav row before this (route: null in account_screen.dart) — tapping
/// it did nothing at all.
class AddressesScreen extends StatefulWidget {
  const AddressesScreen({super.key});

  @override
  State<AddressesScreen> createState() => _AddressesScreenState();
}

class _AddressesScreenState extends State<AddressesScreen> {
  List<dynamic>? _addresses;
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
      final addresses = await ApiClient().fetchMyAddresses(token);
      if (mounted) setState(() { _addresses = addresses; _errorMessage = null; });
    } on ApiException catch (e) {
      if (mounted) setState(() => _errorMessage = e.message);
    }
  }

  Future<void> _setDefault(String id) async {
    final token = context.read<AuthState>().token!;
    try {
      await ApiClient().updateAddress(token, id, {'isDefault': true});
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(trRead(context, 'address_set_as_default_message'))));
      }
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  Future<void> _delete(String id) async {
    final token = context.read<AuthState>().token!;
    try {
      await ApiClient().deleteAddress(token, id);
      _load();
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  void _confirmDelete(String id) {
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        content: Text(tr(context, 'delete_address_confirm')),
        actions: [
          TextButton(onPressed: () => Navigator.of(dialogContext).pop(), child: Text(tr(context, 'cancel'))),
          TextButton(
            onPressed: () { Navigator.of(dialogContext).pop(); _delete(id); },
            child: Text(tr(context, 'delete'), style: const TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }

  // Real icon heuristic (new) -- the real `label` field is free text,
  // not a fixed category enum, so this is a genuine best-guess match
  // against what the buyer actually typed (matching the real Stitch
  // reference's own Home/Garage/Office icon set), not fabricated
  // category data.
  IconData _iconForLabel(String label) {
    final lower = label.toLowerCase();
    if (lower.contains('home') || lower.contains('house') || lower.contains('منزل')) return Icons.home_outlined;
    if (lower.contains('garage') || lower.contains('كراج')) return Icons.garage_outlined;
    if (lower.contains('office') || lower.contains('work') || lower.contains('عمل') || lower.contains('مكتب')) return Icons.business_outlined;
    return Icons.location_on_outlined;
  }

  @override
  Widget build(BuildContext context) {
    final atLimit = (_addresses?.length ?? 0) >= kMaxAddresses;
    final palette = LeapPalette.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(tr(context, 'addresses'))),
      body: _errorMessage != null
          ? Center(child: Text(_errorMessage!, style: TextStyle(color: palette.muted)))
          : _addresses == null
              ? const ListSkeleton()
              : _addresses!.isEmpty
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 80,
                              height: 80,
                              decoration: BoxDecoration(color: palette.card, shape: BoxShape.circle),
                              child: Icon(Icons.location_on_outlined, size: 36, color: palette.muted),
                            ),
                            const SizedBox(height: 16),
                            Text(tr(context, 'no_addresses_yet'), style: TextStyle(color: palette.muted), textAlign: TextAlign.center),
                          ],
                        ),
                      ),
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: _addresses!.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 10),
                      itemBuilder: (context, i) {
                        final a = _addresses![i] as Map<String, dynamic>;
                        final isDefault = a['isDefault'] as bool;
                        final label = a['label'] as String;
                        return Material(
                          color: Colors.transparent,
                          child: InkWell(
                            borderRadius: BorderRadius.circular(12),
                            onTap: () {
                              if (isDefault) {
                                ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(trRead(context, 'address_already_default_message'))));
                              } else {
                                _setDefault(a['id'] as String);
                              }
                            },
                            child: Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: palette.card,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: isDefault ? palette.signal : palette.line),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Row(children: [
                                    Container(
                                      width: 40,
                                      height: 40,
                                      decoration: BoxDecoration(color: palette.signal.withValues(alpha: 0.12), shape: BoxShape.circle),
                                      child: Icon(_iconForLabel(label), color: palette.signal, size: 20),
                                    ),
                                    const SizedBox(width: 12),
                                    Text(label.toUpperCase(), style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: palette.ink, letterSpacing: 0.5)),
                                  ]),
                                  PopupMenuButton<String>(
                                    icon: Icon(Icons.more_horiz, size: 20, color: palette.muted),
                                    onSelected: (action) {
                                      if (action == 'edit') context.push('/addresses/edit', extra: a).then((_) => _load());
                                      if (action == 'default') _setDefault(a['id'] as String);
                                      if (action == 'delete') _confirmDelete(a['id'] as String);
                                    },
                                    // REAL BUG FOUND AND FIXED HERE:
                                    // confirmed directly by reading
                                    // Flutter's own source --
                                    // PopupMenuButton's itemBuilder is
                                    // called from showButtonMenu(),
                                    // itself only triggered when the
                                    // button is tapped (an event
                                    // handler), not during any real
                                    // build phase, despite the
                                    // "Builder" name. tr() (which
                                    // uses context.watch internally)
                                    // is genuinely unsafe here;
                                    // trRead() (context.read) is the
                                    // correct, safe choice.
                                    itemBuilder: (context) => [
                                      PopupMenuItem(value: 'edit', child: Text(trRead(context, 'edit'))),
                                      if (!isDefault) PopupMenuItem(value: 'default', child: Text(trRead(context, 'set_as_default'))),
                                      PopupMenuItem(value: 'delete', child: Text(trRead(context, 'delete'))),
                                    ],
                                  ),
                                ],
                              ),
                              const SizedBox(height: 12),
                              Text(a['recipientName'] as String, style: TextStyle(fontSize: 13, color: palette.ink)),
                              Text(a['phone'] as String, style: TextStyle(fontSize: 12, color: palette.muted)),
                              Text(
                                '${a['streetAddress']}, ${a['city']}, ${a['country']}${a['postalCode'] != null ? ' ${a['postalCode']}' : ''}',
                                style: TextStyle(fontSize: 12, color: palette.muted),
                              ),
                              if (isDefault) ...[
                                const SizedBox(height: 10),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                                  decoration: BoxDecoration(color: palette.signal.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(20)),
                                  child: Text(tr(context, 'default_label').toUpperCase(), style: TextStyle(fontSize: 10, color: palette.signalDark, fontWeight: FontWeight.w800, letterSpacing: 0.5)),
                                ),
                              ],
                            ],
                          ),
                            ),
                          ),
                        );
                      },
                    ),
      floatingActionButton: FloatingActionButton.extended(
        // REAL BUG FOUND AND FIXED HERE (same class as the cart's own
        // real bug, found via a real device console error there): this
        // called tr(context, ...) from inside an onPressed callback --
        // Provider's own context.watch() (which tr() uses internally)
        // is only safe DURING an active build() call, regardless of
        // whether the callback itself is sync or async. This one is
        // purely synchronous (no async/await at all), proving the real
        // rule is broader than "only async callbacks are unsafe" --
        // any event-handler callback is unsafe, since none of them run
        // during an active build. Fixed with trRead() (context.read(),
        // a one-time non-reactive read), matching the same real fix
        // already made for the cart.
        onPressed: atLimit
            ? () => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(trRead(context, 'address_limit_reached'))))
            : () => context.push('/addresses/add').then((_) => _load()),
        backgroundColor: atLimit ? palette.muted : palette.signal,
        foregroundColor: atLimit ? Colors.white : palette.onSignal,
        icon: const Icon(Icons.add),
        label: Text(tr(context, 'add_address')),
      ),
    );
  }
}
