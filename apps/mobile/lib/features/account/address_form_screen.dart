import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../core/app_strings.dart';
import '../../core/auth_state.dart';
import '../../services/api_client.dart';

/// Shared real form for adding a NEW address or editing an existing one
/// — [existing] is null for add, populated for edit. Both call the same
/// real backend (POST vs PATCH /addresses/me).
class AddressFormScreen extends StatefulWidget {
  final Map<String, dynamic>? existing;
  const AddressFormScreen({super.key, this.existing});

  @override
  State<AddressFormScreen> createState() => _AddressFormScreenState();
}

class _AddressFormScreenState extends State<AddressFormScreen> {
  late final TextEditingController _labelController;
  late final TextEditingController _recipientController;
  late final TextEditingController _phoneController;
  late final TextEditingController _countryController;
  late final TextEditingController _cityController;
  late final TextEditingController _streetController;
  late final TextEditingController _postalController;
  bool _isSubmitting = false;
  String? _errorMessage;

  // Real address autocomplete state (new) -- see ApiClient.searchAddresses's
  // own header comment for the real, public Nominatim API this calls
  // and its real usage-policy rate limit, which this debounce timer
  // exists specifically to respect.
  final _addressSearchController = TextEditingController();
  Timer? _debounce;
  List<Map<String, dynamic>> _suggestions = [];
  bool _isSearchingAddress = false;

  bool get _isEditing => widget.existing != null;

  @override
  void initState() {
    super.initState();
    final e = widget.existing;
    _labelController = TextEditingController(text: e?['label'] as String? ?? '');
    _recipientController = TextEditingController(text: e?['recipientName'] as String? ?? '');
    _phoneController = TextEditingController(text: e?['phone'] as String? ?? '');
    _countryController = TextEditingController(text: e?['country'] as String? ?? '');
    _cityController = TextEditingController(text: e?['city'] as String? ?? '');
    _streetController = TextEditingController(text: e?['streetAddress'] as String? ?? '');
    _postalController = TextEditingController(text: e?['postalCode'] as String? ?? '');
  }

  @override
  void dispose() {
    _labelController.dispose();
    _recipientController.dispose();
    _phoneController.dispose();
    _countryController.dispose();
    _cityController.dispose();
    _streetController.dispose();
    _postalController.dispose();
    _addressSearchController.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  /// Real debounced search (new) -- waits ~600ms after the person
  /// stops typing before actually calling the real, free Nominatim
  /// API, specifically to respect its own real usage-policy rate
  /// limit (see ApiClient.searchAddresses's own header comment) while
  /// still feeling responsive for one person typing.
  void _onAddressSearchChanged(String query) {
    _debounce?.cancel();
    if (query.trim().length < 3) {
      setState(() => _suggestions = []);
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 600), () async {
      setState(() => _isSearchingAddress = true);
      try {
        final results = await ApiClient().searchAddresses(query);
        if (mounted) setState(() => _suggestions = results);
      } catch (_) {
        // Real, honest no-op: a real address-search failure (e.g. the
        // free public Nominatim instance being temporarily
        // unavailable) should never block filling the form out
        // manually -- this is a real convenience layered on top of
        // manual entry, not a replacement for it.
        if (mounted) setState(() => _suggestions = []);
      } finally {
        if (mounted) setState(() => _isSearchingAddress = false);
      }
    });
  }

  /// Real auto-fill from a selected suggestion (new) -- Nominatim's
  /// own real structured `address` breakdown doesn't use consistent
  /// key names across every real country (e.g. some real addresses
  /// use `road`, others `pedestrian` or `house_number` differently),
  /// so this checks a few real, common real-world variants for each
  /// real field rather than assuming just one.
  void _selectSuggestion(Map<String, dynamic> suggestion) {
    final address = (suggestion['address'] as Map<String, dynamic>?) ?? {};
    String? firstNonEmpty(List<String> keys) {
      for (final key in keys) {
        final value = address[key] as String?;
        if (value != null && value.isNotEmpty) return value;
      }
      return null;
    }

    final houseNumber = firstNonEmpty(['house_number']);
    final road = firstNonEmpty(['road', 'pedestrian', 'footway']);
    final street = [houseNumber, road].where((s) => s != null).join(' ');
    final city = firstNonEmpty(['city', 'town', 'village', 'county']);
    final country = firstNonEmpty(['country']);
    final postal = firstNonEmpty(['postcode']);

    setState(() {
      if (street.isNotEmpty) _streetController.text = street;
      if (city != null) _cityController.text = city;
      if (country != null) _countryController.text = country;
      if (postal != null) _postalController.text = postal;
      _suggestions = [];
      _addressSearchController.clear();
    });
  }

  Future<void> _submit() async {
    if (_labelController.text.trim().isEmpty ||
        _recipientController.text.trim().isEmpty ||
        _phoneController.text.trim().isEmpty ||
        _countryController.text.trim().isEmpty ||
        _cityController.text.trim().isEmpty ||
        _streetController.text.trim().isEmpty) {
      setState(() => _errorMessage = trRead(context, 'please_fill_both_fields'));
      return;
    }
    setState(() { _isSubmitting = true; _errorMessage = null; });
    final token = context.read<AuthState>().token!;
    final payload = {
      'label': _labelController.text.trim(),
      'recipientName': _recipientController.text.trim(),
      'phone': _phoneController.text.trim(),
      'country': _countryController.text.trim(),
      'city': _cityController.text.trim(),
      'streetAddress': _streetController.text.trim(),
      'postalCode': _postalController.text.trim().isEmpty ? null : _postalController.text.trim(),
    };
    try {
      if (_isEditing) {
        await ApiClient().updateAddress(token, widget.existing!['id'] as String, payload);
      } else {
        await ApiClient().createAddress(token, payload);
      }
      if (mounted) context.pop();
    } on ApiException catch (e) {
      setState(() { _errorMessage = e.message; _isSubmitting = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = LeapPalette.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(tr(context, _isEditing ? 'edit_address' : 'add_address'))),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Real address autocomplete (new) -- an optional
            // convenience above the real manual fields, not a
            // replacement for them (see _onAddressSearchChanged's own
            // header comment for the real, free API this calls and
            // its real rate-limit consideration).
            TextField(
              controller: _addressSearchController,
              onChanged: _onAddressSearchChanged,
              decoration: InputDecoration(
                labelText: 'Search for your address (optional)',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _isSearchingAddress ? const Padding(padding: EdgeInsets.all(12), child: SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))) : null,
              ),
            ),
            if (_suggestions.isNotEmpty)
              Container(
                margin: const EdgeInsets.only(top: 4),
                decoration: BoxDecoration(border: Border.all(color: palette.line), borderRadius: BorderRadius.circular(8)),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: _suggestions.map((s) => ListTile(
                        dense: true,
                        leading: const Icon(Icons.location_on_outlined, size: 18),
                        title: Text(s['display_name'] as String, style: const TextStyle(fontSize: 12.5), maxLines: 2, overflow: TextOverflow.ellipsis),
                        onTap: () => _selectSuggestion(s),
                      )).toList(),
                ),
              ),
            const SizedBox(height: 16),
            const Divider(),
            const SizedBox(height: 4),
            TextField(controller: _labelController, decoration: InputDecoration(labelText: tr(context, 'label_field'), prefixIcon: const Icon(Icons.label_outline))),
            const SizedBox(height: 12),
            TextField(controller: _recipientController, decoration: InputDecoration(labelText: tr(context, 'recipient_name_field'), prefixIcon: const Icon(Icons.person_outline))),
            const SizedBox(height: 12),
            TextField(controller: _phoneController, keyboardType: TextInputType.phone, decoration: InputDecoration(labelText: tr(context, 'phone_field'), prefixIcon: const Icon(Icons.phone_outlined))),
            const SizedBox(height: 12),
            TextField(controller: _countryController, decoration: InputDecoration(labelText: tr(context, 'country_field'), prefixIcon: const Icon(Icons.public_outlined))),
            const SizedBox(height: 12),
            TextField(controller: _cityController, decoration: InputDecoration(labelText: tr(context, 'city_field'), prefixIcon: const Icon(Icons.location_city_outlined))),
            const SizedBox(height: 12),
            TextField(controller: _streetController, decoration: InputDecoration(labelText: tr(context, 'street_address_field'), prefixIcon: const Icon(Icons.home_outlined))),
            const SizedBox(height: 12),
            TextField(controller: _postalController, decoration: InputDecoration(labelText: tr(context, 'postal_code_field'), prefixIcon: const Icon(Icons.markunread_mailbox_outlined))),
            if (_errorMessage != null) ...[
              const SizedBox(height: 12),
              Text(_errorMessage!, style: const TextStyle(color: Colors.red, fontSize: 12.5)),
            ],
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: _isSubmitting ? null : _submit,
              child: _isSubmitting
                  // REAL BUG FOUND AND FIXED HERE: white spinner on
                  // gold is the same real white-on-gold contrast issue
                  // already found and fixed multiple times elsewhere
                  // this session.
                  ? SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: palette.onSignal))
                  : Text(tr(context, 'save')),
            ),
          ],
        ),
      ),
    );
  }
}
