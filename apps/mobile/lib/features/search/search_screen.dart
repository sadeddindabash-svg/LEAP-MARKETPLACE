import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../core/language_state.dart';
import '../../core/auth_state.dart';
import '../../models/product.dart';
import '../../services/api_client.dart';
import 'vehicle_filter_sheet.dart';

/// BUY-0xx: real product search — part name, OEM number, category, or
/// vehicle brand/model. Was a dead, read-only text field on the home
/// screen before this ("TODO: wire to search screen") — this is that
/// wiring, plus the actual results screen.
class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final _controller = TextEditingController();
  Timer? _debounce;
  List<Product>? _results;
  bool _isSearching = false;
  String? _error;
  String _lastQuery = '';
  // Real Brand/Model/Generation(Year) filter (new) -- see
  // vehicle_filter_sheet.dart. Null means no vehicle filter applied.
  VehicleFilterSelection? _vehicleFilter;

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _onChanged(String query) {
    _debounce?.cancel();
    // A vehicle filter alone is a real, meaningful search ("show me
    // everything that fits my F20") -- only bail out early when there's
    // truly nothing to search by, text OR filter.
    if (query.trim().isEmpty && _vehicleFilter == null) {
      setState(() { _results = null; _error = null; });
      return;
    }
    // Debounced rather than firing a real network request on every
    // keystroke — a real search-as-you-type still shouldn't hammer the
    // backend once per character typed.
    _debounce = Timer(const Duration(milliseconds: 400), () => _runSearch(query.trim()));
  }

  Future<void> _pickVehicleFilter() async {
    final selection = await showModalBottomSheet<VehicleFilterSelection>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const VehicleFilterSheet(),
    );
    if (selection == null) return;
    setState(() => _vehicleFilter = selection);
    _debounce?.cancel();
    _runSearch(_controller.text.trim());
  }

  void _clearVehicleFilter() {
    setState(() => _vehicleFilter = null);
    _debounce?.cancel();
    if (_controller.text.trim().isEmpty) {
      setState(() { _results = null; _error = null; });
    } else {
      _runSearch(_controller.text.trim());
    }
  }

  Future<void> _runSearch(String query) async {
    if (query.isEmpty && _vehicleFilter == null) return;
    _lastQuery = query;
    setState(() { _isSearching = true; _error = null; });
    try {
      final language = context.read<LanguageState>().language;
      final results = await ApiClient().searchProducts(
        query,
        lang: language,
        generationId: _vehicleFilter?.generationId,
        year: _vehicleFilter?.year,
      );
      if (_lastQuery == query && mounted) {
        setState(() { _results = results; _isSearching = false; });
      }
    } on ApiException catch (e) {
      if (mounted) setState(() { _error = e.message; _isSearching = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isAr = context.watch<LanguageState>().isArabic;
    final isLoggedIn = context.watch<AuthState>().isLoggedIn;
    final hasQuery = _controller.text.trim().isNotEmpty;
    return Scaffold(
      appBar: AppBar(
        title: TextField(
          controller: _controller,
          autofocus: true,
          onChanged: _onChanged,
          onSubmitted: (q) { _debounce?.cancel(); _runSearch(q.trim()); },
          decoration: InputDecoration(
            hintText: isAr ? 'ابحث عن قطعة أو ماركة أو رقم' : 'Search part, brand, or number',
            border: InputBorder.none,
          ),
        ),
        actions: [
          IconButton(
            icon: Icon(Icons.directions_car_filled_outlined, color: _vehicleFilter != null ? LeapColors.signal : null),
            tooltip: isAr ? 'تصفية حسب المركبة' : 'Filter by vehicle',
            onPressed: _pickVehicleFilter,
          ),
          if (isLoggedIn && hasQuery && _results != null)
            IconButton(
              icon: const Icon(Icons.bookmark_add_outlined),
              tooltip: isAr ? 'حفظ هذا البحث' : 'Save this search',
              onPressed: () => _showSaveSearchDialog(context, isAr),
            ),
        ],
      ),
      body: Column(
        children: [
          if (_vehicleFilter != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Chip(
                  avatar: const Icon(Icons.directions_car_filled_outlined, size: 16),
                  label: Text(_vehicleFilter!.label, style: const TextStyle(fontSize: 12.5)),
                  onDeleted: _clearVehicleFilter,
                ),
              ),
            ),
          Expanded(child: _buildBody(isAr)),
        ],
      ),
    );
  }

  // Real "Save this search" action (migration 039) -- prompts for a
  // real label, then saves via the real backend. Only shown once real
  // results have actually loaded, and only to a real logged-in buyer.
  Future<void> _showSaveSearchDialog(BuildContext context, bool isAr) async {
    final labelController = TextEditingController(text: _lastQuery);
    final saved = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(isAr ? 'حفظ هذا البحث' : 'Save this search'),
        content: TextField(
          controller: labelController,
          autofocus: true,
          decoration: InputDecoration(labelText: isAr ? 'اسم البحث' : 'Name this search'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: Text(isAr ? 'إلغاء' : 'Cancel')),
          TextButton(
            onPressed: () async {
              final token = context.read<AuthState>().token;
              if (token == null) return Navigator.pop(dialogContext, false);
              try {
                await ApiClient().createSavedSearch(token, searchTerm: _lastQuery, label: labelController.text.trim().isEmpty ? _lastQuery : labelController.text.trim());
                if (dialogContext.mounted) Navigator.pop(dialogContext, true);
              } on ApiException catch (e) {
                if (dialogContext.mounted) {
                  ScaffoldMessenger.of(dialogContext).showSnackBar(SnackBar(content: Text(e.message)));
                }
              }
            },
            child: Text(isAr ? 'حفظ' : 'Save'),
          ),
        ],
      ),
    );
    if (saved == true && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(isAr ? 'تم حفظ البحث — سنُعلمك بالنتائج الجديدة' : 'Search saved — we\'ll notify you of new matches')),
      );
    }
  }

  Widget _buildBody(bool isAr) {
    if (_controller.text.trim().isEmpty && _vehicleFilter == null) {
      return Center(
        child: Text(isAr ? 'ابدأ الكتابة للبحث' : 'Start typing to search', style: const TextStyle(color: LeapColors.muted)),
      );
    }
    if (_isSearching) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return Center(child: Text(_error!, style: const TextStyle(color: LeapColors.muted)));
    }
    if (_results != null && _results!.isEmpty) {
      return Center(
        child: Text(isAr ? 'لا توجد نتائج' : 'No results found', style: const TextStyle(color: LeapColors.muted)),
      );
    }
    if (_results == null) return const SizedBox.shrink();

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _results!.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (context, i) {
        final p = _results![i];
        return Card(
          child: ListTile(
            leading: const Icon(Icons.album_outlined, color: LeapColors.ink),
            title: Text(p.name, maxLines: 2, overflow: TextOverflow.ellipsis),
            subtitle: Text('${p.category} · \$${p.price.toStringAsFixed(2)} ${p.currencyCode}'),
            onTap: () => context.push('/product/${p.id}'),
          ),
        );
      },
    );
  }
}
