import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../core/app_strings.dart';
import '../../core/auth_state.dart';
import '../../services/api_client.dart';

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
      _load();
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

  @override
  Widget build(BuildContext context) {
    final atLimit = (_addresses?.length ?? 0) >= kMaxAddresses;
    return Scaffold(
      appBar: AppBar(title: Text(tr(context, 'addresses'))),
      body: _errorMessage != null
          ? Center(child: Text(_errorMessage!, style: const TextStyle(color: LeapColors.muted)))
          : _addresses == null
              ? const Center(child: CircularProgressIndicator())
              : _addresses!.isEmpty
                  ? Center(child: Text(tr(context, 'no_addresses_yet'), style: const TextStyle(color: LeapColors.muted)))
                  : ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: _addresses!.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 10),
                      itemBuilder: (context, i) {
                        final a = _addresses![i] as Map<String, dynamic>;
                        final isDefault = a['isDefault'] as bool;
                        return Card(
                          child: Padding(
                            padding: const EdgeInsets.all(14),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Row(children: [
                                      Text(a['label'] as String, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                                      if (isDefault) ...[
                                        const SizedBox(width: 8),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                          decoration: BoxDecoration(color: LeapColors.gauge.withOpacity(0.15), borderRadius: BorderRadius.circular(10)),
                                          child: Text(tr(context, 'default_label'), style: const TextStyle(fontSize: 10.5, color: LeapColors.gauge, fontWeight: FontWeight.w700)),
                                        ),
                                      ],
                                    ]),
                                    PopupMenuButton<String>(
                                      icon: const Icon(Icons.more_horiz, size: 20),
                                      onSelected: (action) {
                                        if (action == 'edit') context.push('/addresses/edit', extra: a).then((_) => _load());
                                        if (action == 'default') _setDefault(a['id'] as String);
                                        if (action == 'delete') _confirmDelete(a['id'] as String);
                                      },
                                      itemBuilder: (context) => [
                                        PopupMenuItem(value: 'edit', child: Text(tr(context, 'edit'))),
                                        if (!isDefault) PopupMenuItem(value: 'default', child: Text(tr(context, 'set_as_default'))),
                                        PopupMenuItem(value: 'delete', child: Text(tr(context, 'delete'))),
                                      ],
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 4),
                                Text(a['recipientName'] as String, style: const TextStyle(fontSize: 13)),
                                Text(a['phone'] as String, style: const TextStyle(fontSize: 12, color: LeapColors.muted)),
                                Text(
                                  '${a['streetAddress']}, ${a['city']}, ${a['country']}${a['postalCode'] != null ? ' ${a['postalCode']}' : ''}',
                                  style: const TextStyle(fontSize: 12, color: LeapColors.muted),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: atLimit
            ? () => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(tr(context, 'address_limit_reached'))))
            : () => context.push('/addresses/add').then((_) => _load()),
        backgroundColor: atLimit ? LeapColors.muted : LeapColors.signal,
        icon: const Icon(Icons.add),
        label: Text(tr(context, 'add_address')),
      ),
    );
  }
}
