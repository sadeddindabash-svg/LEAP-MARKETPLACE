import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../core/recent_searches.dart';
import '../../widgets/skeleton.dart';
import '../../widgets/product_card.dart';
import '../../core/language_state.dart';
import '../../core/auth_state.dart';
import '../../models/product.dart';
import '../../services/api_client.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;
import 'vehicle_filter_sheet.dart';
import 'sort_and_price_sheet.dart';

/// BUY-0xx: real product search — part name, OEM number, category, or
/// vehicle brand/model. Was a dead, read-only text field on the home
/// screen before this ("TODO: wire to search screen") — this is that
/// wiring, plus the actual results screen.
class SearchScreen extends StatefulWidget {
  // Real pre-filled query (new, #15) -- lets a real caller (Shop by
  // Symptom) land here with a real search already running, rather
  // than requiring the person to type it themselves.
  final String? initialQuery;
  const SearchScreen({super.key, this.initialQuery});

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
  // Real sort/price-range filter (new) -- see sort_and_price_sheet.dart.
  SortAndPriceSelection? _sortAndPrice;
  // Real recently-searched terms (new) -- see core/recent_searches.dart.
  List<String> _recentSearches = [];
  // Real trending searches (new) -- see ApiClient.fetchTrendingSearches's
  // own header comment; genuinely aggregated platform-wide data, not a
  // hardcoded example list.
  List<String> _trendingSearches = [];
  // Real voice search (#13) -- on-device speech-to-text, no cloud API
  // key needed. _isListening drives the mic icon's visual state.
  final stt.SpeechToText _speech = stt.SpeechToText();
  bool _isListening = false;
  bool _speechAvailable = false;

  @override
  void initState() {
    super.initState();
    RecentSearches.load().then((terms) {
      if (mounted) setState(() => _recentSearches = terms);
    });
    // Real, best-effort load -- a real failure here (e.g. no network
    // yet) should never block the rest of this screen; the section
    // simply stays hidden if it doesn't load, matching
    // _recentSearches' own null-safe empty-list default.
    ApiClient().fetchTrendingSearches().then((terms) {
      if (mounted) setState(() => _trendingSearches = terms);
    }).catchError((_) {});
    if (widget.initialQuery != null && widget.initialQuery!.isNotEmpty) {
      _controller.text = widget.initialQuery!;
      _runSearch(widget.initialQuery!);
    }
    // Real, best-effort init -- a real failure (no mic permission,
    // unsupported platform) just leaves the mic button hidden rather
    // than breaking the rest of this real screen.
    _speech.initialize().then((available) {
      if (mounted) setState(() => _speechAvailable = available);
    }).catchError((_) {});
  }

  Future<void> _toggleListening() async {
    if (_isListening) {
      await _speech.stop();
      if (mounted) setState(() => _isListening = false);
      return;
    }
    setState(() => _isListening = true);
    await _speech.listen(
      onResult: (result) {
        _controller.text = result.recognizedWords;
        _controller.selection = TextSelection.fromPosition(TextPosition(offset: _controller.text.length));
        if (result.finalResult) {
          setState(() => _isListening = false);
          _debounce?.cancel();
          _runSearch(result.recognizedWords.trim());
        }
      },
    );
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    if (_isListening) _speech.stop();
    super.dispose();
  }

  void _onChanged(String query) {
    _debounce?.cancel();
    // Real, lightweight rebuild (new) -- so the search field's own real
    // clear ("×") button shows/hides immediately as the buyer types,
    // independent of the debounced search below. No change to the
    // actual search-triggering logic itself.
    setState(() {});
    // A vehicle filter or a sort/price filter alone is a real, meaningful
    // search ("show me everything under $50") -- only bail out early
    // when there's truly nothing to search by: no text, no filters.
    if (query.trim().isEmpty && _vehicleFilter == null && (_sortAndPrice == null || _sortAndPrice!.isEmpty)) {
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
    if (_controller.text.trim().isEmpty && (_sortAndPrice == null || _sortAndPrice!.isEmpty)) {
      setState(() { _results = null; _error = null; });
    } else {
      _runSearch(_controller.text.trim());
    }
  }

  Future<void> _pickSortAndPrice() async {
    final selection = await showModalBottomSheet<SortAndPriceSelection>(
      context: context,
      isScrollControlled: true,
      builder: (_) => SortAndPriceSheet(initial: _sortAndPrice),
    );
    if (selection == null) return;
    setState(() => _sortAndPrice = selection.isEmpty ? null : selection);
    _debounce?.cancel();
    if (_controller.text.trim().isEmpty && _vehicleFilter == null && selection.isEmpty) {
      setState(() { _results = null; _error = null; });
    } else {
      _runSearch(_controller.text.trim());
    }
  }

  void _clearSortAndPrice() {
    setState(() => _sortAndPrice = null);
    _debounce?.cancel();
    if (_controller.text.trim().isEmpty && _vehicleFilter == null) {
      setState(() { _results = null; _error = null; });
    } else {
      _runSearch(_controller.text.trim());
    }
  }

  Future<void> _runSearch(String query) async {
    if (query.isEmpty && _vehicleFilter == null && (_sortAndPrice == null || _sortAndPrice!.isEmpty)) return;
    _lastQuery = query;
    // Real save to recent searches (new) -- only for a genuine real
    // text term, not a vehicle/sort-only search with no actual typed
    // query (there's no "term" to remember in that case).
    if (query.isNotEmpty) {
      RecentSearches.add(query).then((terms) {
        if (mounted) setState(() => _recentSearches = terms);
      });
    }
    setState(() { _isSearching = true; _error = null; });
    try {
      final language = context.read<LanguageState>().language;
      final results = await ApiClient().searchProducts(
        query,
        lang: language,
        generationId: _vehicleFilter?.generationId,
        year: _vehicleFilter?.year,
        sort: _sortAndPrice?.sort,
        minPrice: _sortAndPrice?.minPrice,
        maxPrice: _sortAndPrice?.maxPrice,
        maxDeliveryDays: _sortAndPrice?.maxDeliveryDays,
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
            // Real voice search (#13) -- only shown when real speech
            // recognition is genuinely available on this device.
            prefixIcon: _speechAvailable
                ? IconButton(
                    icon: Icon(_isListening ? Icons.mic : Icons.mic_none, color: _isListening ? LeapPalette.of(context).signal : null),
                    tooltip: isAr ? 'بحث صوتي' : 'Voice search',
                    onPressed: _toggleListening,
                  )
                : null,
            // Real "clear" button (new) -- closes a real, common gap:
            // no way to clear the search field except manually
            // selecting and deleting the text. Reuses the exact same
            // reset _onChanged('') already does for an emptied field,
            // rather than duplicating that logic here.
            suffixIcon: hasQuery
                ? IconButton(
                    icon: const Icon(Icons.clear, size: 18),
                    tooltip: isAr ? 'مسح' : 'Clear',
                    onPressed: () {
                      _controller.clear();
                      _onChanged('');
                    },
                  )
                : null,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.qr_code_scanner),
            tooltip: isAr ? 'مسح الرمز' : 'Scan barcode',
            onPressed: () => context.push('/scan-barcode'),
          ),
          IconButton(
            icon: const Icon(Icons.document_scanner_outlined),
            tooltip: isAr ? 'صورة رقم القطعة' : 'Photo of part number',
            onPressed: () => context.push('/scan-part-number'),
          ),
          IconButton(
            icon: Icon(Icons.directions_car_filled_outlined, color: _vehicleFilter != null ? LeapPalette.of(context).signal : null),
            tooltip: isAr ? 'تصفية حسب المركبة' : 'Filter by vehicle',
            onPressed: _pickVehicleFilter,
          ),
          IconButton(
            icon: Icon(Icons.tune, color: (_sortAndPrice != null && !_sortAndPrice!.isEmpty) ? LeapPalette.of(context).signal : null),
            tooltip: isAr ? 'الترتيب والسعر' : 'Sort & price',
            onPressed: _pickSortAndPrice,
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
          if (_vehicleFilter != null || (_sortAndPrice != null && !_sortAndPrice!.isEmpty))
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
              child: Wrap(
                spacing: 8,
                children: [
                  if (_vehicleFilter != null)
                    Chip(
                      avatar: const Icon(Icons.directions_car_filled_outlined, size: 16),
                      label: Text(_vehicleFilter!.label, style: const TextStyle(fontSize: 12.5)),
                      onDeleted: _clearVehicleFilter,
                    ),
                  if (_sortAndPrice != null && !_sortAndPrice!.isEmpty)
                    Chip(
                      avatar: const Icon(Icons.tune, size: 16),
                      label: Text(_sortAndPrice!.label, style: const TextStyle(fontSize: 12.5)),
                      onDeleted: _clearSortAndPrice,
                    ),
                ],
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
    if (_controller.text.trim().isEmpty && _vehicleFilter == null && (_sortAndPrice == null || _sortAndPrice!.isEmpty)) {
      return ListView(
        padding: const EdgeInsets.all(20),
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          const SizedBox(height: 40),
          Center(
            child: Text(isAr ? 'ابدأ الكتابة للبحث' : 'Start typing to search', style: TextStyle(color: LeapPalette.of(context).muted)),
          ),
          if (_recentSearches.isNotEmpty) ...[
            const SizedBox(height: 28),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  isAr ? 'عمليات بحث سابقة' : 'Recent searches',
                  style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: LeapPalette.of(context).muted),
                ),
                GestureDetector(
                  onTap: () {
                    RecentSearches.clear();
                    setState(() => _recentSearches = []);
                  },
                  child: Text(isAr ? 'مسح' : 'Clear', style: TextStyle(fontSize: 12, color: LeapPalette.of(context).signalDark)),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final term in _recentSearches)
                  ActionChip(
                    avatar: const Icon(Icons.history, size: 16),
                    label: Text(term, style: const TextStyle(fontSize: 12.5)),
                    onPressed: () {
                      _controller.text = term;
                      _debounce?.cancel();
                      _runSearch(term);
                    },
                  ),
              ],
            ),
          ],
          if (_trendingSearches.isNotEmpty) ...[
            const SizedBox(height: 28),
            Text(
              isAr ? 'الأكثر بحثًا' : 'Trending searches',
              style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: LeapPalette.of(context).muted),
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final term in _trendingSearches)
                  ActionChip(
                    avatar: Icon(Icons.trending_up, size: 16, color: LeapPalette.of(context).signal),
                    label: Text(term, style: const TextStyle(fontSize: 12.5)),
                    onPressed: () {
                      _controller.text = term;
                      _debounce?.cancel();
                      _runSearch(term);
                    },
                  ),
              ],
            ),
          ],
        ],
      );
    }
    if (_isSearching) {
      return const ProductGridSkeleton();
    }
    if (_error != null) {
      return Center(child: Text(_error!, style: TextStyle(color: LeapPalette.of(context).muted)));
    }
    if (_results != null && _results!.isEmpty) {
      return Center(
        child: Text(isAr ? 'لا توجد نتائج' : 'No results found', style: TextStyle(color: LeapPalette.of(context).muted)),
      );
    }
    if (_results == null) return const SizedBox.shrink();

    return GridView.builder(
      padding: const EdgeInsets.all(16),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: 10,
        crossAxisSpacing: 10,
        childAspectRatio: 0.62,
      ),
      itemCount: _results!.length,
      itemBuilder: (context, i) {
        final p = _results![i];
        // Real "confirmed fit" badge (new) -- shown only when a real
        // vehicle filter is genuinely active, matching the exact same
        // real rule already established on Home's own "My Car" filter
        // (these results are already fitment-filtered server-side
        // whenever a real vehicle filter is applied -- see
        // ApiClient().searchProducts's own generationId param above).
        return ProductCard(product: p, onTap: () => context.push('/product/${p.id}'), showConfirmedFitBadge: _vehicleFilter != null);
      },
    );
  }
}
