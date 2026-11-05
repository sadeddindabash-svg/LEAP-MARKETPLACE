import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:csc_picker_plus/csc_picker_plus.dart';
import '../../core/theme.dart';
import '../../core/app_strings.dart';
import '../../core/auth_state.dart';
import '../../core/language_state.dart';
import '../../core/arabic_country_names.dart';
import '../../core/country_phone_codes.dart';
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
  late final TextEditingController _stateController;
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

  // Real cascading country/city selection (new) -- mirrors csc_picker's
  // own real callback values, kept in sync with the existing plain-text
  // controllers below (which the backend and any other code already
  // reads from) rather than replacing them outright.
  String? _selectedCountry;
  String? _selectedCity;
  String? _selectedState;
  // Real Saudi National Address field (new) -- Saudi Arabia's own
  // real short-address format: 4 letters + 4 digits (e.g. "RRRD2929"),
  // used by Saudi Post/SPL. Only ever shown when the selected real
  // country is genuinely Saudi Arabia.
  late final TextEditingController _nationalAddressController;
  static final RegExp _saudiNationalAddressPattern = RegExp(r'^[A-Za-z]{4}[0-9]{4}$');

  @override
  void initState() {
    super.initState();
    final e = widget.existing;
    _labelController = TextEditingController(text: e?['label'] as String? ?? '');
    _recipientController = TextEditingController(text: e?['recipientName'] as String? ?? '');
    _phoneController = TextEditingController(text: e?['phone'] as String? ?? '');
    _countryController = TextEditingController(text: e?['country'] as String? ?? '');
    _stateController = TextEditingController(text: e?['state'] as String? ?? '');
    _cityController = TextEditingController(text: e?['city'] as String? ?? '');
    _streetController = TextEditingController(text: e?['streetAddress'] as String? ?? '');
    _postalController = TextEditingController(text: e?['postalCode'] as String? ?? '');
    _nationalAddressController = TextEditingController(text: e?['nationalAddress'] as String? ?? '');
    _selectedCountry = e?['country'] as String?;
    _selectedCity = e?['city'] as String?;
    _selectedState = e?['state'] as String?;
  }

  @override
  void dispose() {
    _labelController.dispose();
    _recipientController.dispose();
    _phoneController.dispose();
    _countryController.dispose();
    _stateController.dispose();
    _cityController.dispose();
    _streetController.dispose();
    _postalController.dispose();
    _nationalAddressController.dispose();
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
    // Real Saudi National Address requirement (new) -- only enforced
    // when the real, selected country is genuinely Saudi Arabia.
    if (normalizeCountryNameToEnglish(_selectedCountry) == 'Saudi Arabia' && !_saudiNationalAddressPattern.hasMatch(_nationalAddressController.text.trim())) {
      setState(() => _errorMessage = trRead(context, 'national_address_format_error'));
      return;
    }
    setState(() { _isSubmitting = true; _errorMessage = null; });
    final token = context.read<AuthState>().token!;
    final payload = {
      'label': _labelController.text.trim(),
      'recipientName': _recipientController.text.trim(),
      'phone': _phoneController.text.trim(),
      'country': normalizeCountryNameToEnglish(_countryController.text.trim()),
      'state': _stateController.text.trim().isEmpty ? null : _stateController.text.trim(),
      'city': _cityController.text.trim(),
      'streetAddress': _streetController.text.trim(),
      'postalCode': _postalController.text.trim().isEmpty ? null : _postalController.text.trim(),
      if (normalizeCountryNameToEnglish(_selectedCountry) == 'Saudi Arabia') 'nationalAddress': _nationalAddressController.text.trim().toUpperCase(),
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
    final isAr = context.watch<LanguageState>().isArabic;
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
                labelText: tr(context, 'search_for_address_hint'),
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
            // Real cascading country -> city selection (new) --
            // csc_picker_plus's own real, bundled dataset, no network
            // call needed. Syncs into the existing _countryController /
            // _cityController the rest of this form (and the real
            // backend) already reads from, rather than replacing that
            // real, established pattern.
            CSCPickerPlus(
              layout: Layout.vertical,
              // Real, confirmed pivot: switches the picker's own
              // display language based on the app's own language
              // toggle. The real Saudi National Address detection
              // below is now normalized via
              // normalizeCountryNameToEnglish() so it keeps working
              // correctly regardless of which real language the
              // picker is currently showing.
              countryStateLanguage: isAr ? CountryStateLanguage.arabic : CountryStateLanguage.englishOrNative,
              // REAL BUG FOUND AND FIXED HERE: confirmed directly by
              // reading this fork's actual widget source -- the
              // default flagState (CountryFlag.ENABLE) embeds a real
              // flag emoji directly into the country name string
              // itself before it's ever passed to onCountryChanged
              // (e.g. "🇸🇦    Saudi Arabia", not plain "Saudi
              // Arabia"), which is exactly why the Saudi
              // Address-Code field below never appeared -- the
              // real string comparison never matched.
              //
              // SHOW_IN_DROP_DOWN_ONLY restores the real visual flag
              // icon in the dropdown list (a nicer real UX than no
              // flag at all) while this package's own source strips
              // it back off before calling onCountryChanged. BUT:
              // confirmed directly, mathematically, that this
              // package's own stripping is actually wrong -- the
              // real flag-plus-four-spaces prefix is genuinely 8
              // UTF-16 code units long (a flag emoji is 2 regional-
              // indicator symbols = 4 code units, plus 4 spaces),
              // while its own source only strips 6, leaving 2
              // leftover leading spaces in the real value. Rather
              // than trust that flawed offset, .trim() below cleans
              // this up reliably regardless of the exact leftover
              // whitespace, giving a genuinely clean country name
              // either way.
              flagState: CountryFlag.SHOW_IN_DROP_DOWN_ONLY,
              dropdownDecoration: BoxDecoration(
                color: palette.card,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: palette.line),
              ),
              disabledDropdownDecoration: BoxDecoration(
                color: palette.card,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: palette.line),
              ),
              currentCountry: _selectedCountry,
              currentCity: _selectedCity,
              onCountryChanged: (value) {
                setState(() {
                  _selectedCountry = value.trim();
                  _countryController.text = value.trim();
                  // Real, deliberate reset: a real city genuinely
                  // tied to the previous real country would otherwise
                  // stay selected against a new one it was never
                  // actually confirmed to belong to.
                  _selectedCity = null;
                  _cityController.text = '';
                });
              },
              onStateChanged: (value) {
                setState(() {
                  _selectedState = value ?? '';
                  _stateController.text = value ?? '';
                });
              },
              onCityChanged: (value) {
                setState(() {
                  _selectedCity = value ?? '';
                  _cityController.text = value ?? '';
                });
              },
            ),
            // Real Saudi National Address field (new) -- only shown
            // when the selected real country is genuinely Saudi
            // Arabia. Real format validation: exactly 4 letters
            // followed by 4 digits (e.g. "RRRD2929"), Saudi Post/SPL's
            // own real short-address standard.
            if (normalizeCountryNameToEnglish(_selectedCountry) == 'Saudi Arabia') ...[
              const SizedBox(height: 12),
              TextField(
                controller: _nationalAddressController,
                textCapitalization: TextCapitalization.characters,
                maxLength: 8,
                decoration: InputDecoration(
                  labelText: tr(context, 'national_address_field'),
                  hintText: 'RRRD2929',
                  prefixIcon: const Icon(Icons.badge_outlined),
                  counterText: '',
                  errorText: _nationalAddressController.text.isNotEmpty && !_saudiNationalAddressPattern.hasMatch(_nationalAddressController.text)
                      ? tr(context, 'national_address_format_error')
                      : null,
                ),
                onChanged: (_) => setState(() {}),
              ),
            ],
            const SizedBox(height: 12),
            TextField(controller: _streetController, decoration: InputDecoration(labelText: tr(context, 'street_address_field'), prefixIcon: const Icon(Icons.home_outlined))),
            const SizedBox(height: 12),
            TextField(controller: _postalController, decoration: InputDecoration(labelText: tr(context, 'postal_code_field'), prefixIcon: const Icon(Icons.markunread_mailbox_outlined))),
            const SizedBox(height: 12),
            TextField(
              controller: _phoneController,
              keyboardType: TextInputType.phone,
              decoration: InputDecoration(
                labelText: tr(context, 'phone_field'),
                prefixIcon: const Icon(Icons.phone_outlined),
                // Real phone-code auto-fill -- looks up the real dial
                // code for the currently-selected real country above.
                // Shown as a prefix label, not force-injected into the
                // real text itself, so a person editing an existing
                // real number (which may already include a real
                // country code) never has it silently duplicated or
                // overwritten.
                prefixText: _selectedCountry != null && kCountryPhoneCodes[normalizeCountryNameToEnglish(_selectedCountry)] != null
                    ? '${kCountryPhoneCodes[normalizeCountryNameToEnglish(_selectedCountry)]} '
                    : null,
              ),
            ),
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
