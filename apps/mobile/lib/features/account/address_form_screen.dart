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
    super.dispose();
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
