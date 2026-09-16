import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../core/language_state.dart';
import '../../core/app_strings.dart';
import '../../services/api_client.dart';
import '../../widgets/skeleton.dart';

/// What the user picked, once they've drilled all the way down. `year`
/// is null when the generation spans a single year (nothing to choose)
/// or when the user explicitly picked "Any year in this generation" --
/// either way, the search then filters by generationId alone.
class VehicleFilterSelection {
  final String generationId;
  final String label; // e.g. "BMW · 1 Series · F20 (2015–2019)"
  final int? year;
  // The generation's own real starting year -- always present,
  // regardless of whether a specific `year` was picked. Search doesn't
  // need this (an unset `year` genuinely means "any year, don't
  // narrow"), but a caller that needs ONE definite year no matter what
  // (e.g. My Garage saving "my exact car") has a real, sensible
  // fallback here instead of a null.
  final int yearStart;
  const VehicleFilterSelection({required this.generationId, required this.label, required this.yearStart, this.year});
}

/// Real Brand -> Model -> Generation -> Year picker for the search
/// filter (see search_screen.dart). Same structured cascade the
/// supplier portal already uses to submit real fitment
/// (GET /fitment/brands -> /brands/:id/models -> /models/:id/generations,
/// migration 010) -- deliberately NOT the flat GET /fitment/makes|
/// vehicles pair My Garage uses, since no real product fitment is ever
/// stored against that flat table (confirmed directly, not assumed).
///
/// Four-step drill (brand -> model -> generation -> year). The year
/// step is skipped automatically when a generation only spans one
/// year, or answered as "Any year" without a real prompt when the
/// user doesn't care to narrow further. Also used directly from My
/// Garage's own add-vehicle flow (see garage_screen.dart's
/// _addVehicle) -- this is the one real picker sheet, not a separate,
/// simpler one (a stale comment here previously referenced a
/// separate "add_vehicle_screen.dart" with its own simpler pattern;
/// confirmed directly that file doesn't exist anywhere in this real
/// codebase, corrected rather than left to mislead the next read).
class VehicleFilterSheet extends StatefulWidget {
  const VehicleFilterSheet({super.key});

  @override
  State<VehicleFilterSheet> createState() => _VehicleFilterSheetState();
}

enum _Step { brand, model, generation, year }

class _VehicleFilterSheetState extends State<VehicleFilterSheet> {
  _Step _step = _Step.brand;
  Map<String, dynamic>? _selectedBrand;
  Map<String, dynamic>? _selectedModel;
  Map<String, dynamic>? _selectedGeneration;
  bool _isLookingUpVin = false;
  int? _pendingVinYear;

  late Future<List<dynamic>> _brandsFuture;
  Future<List<dynamic>>? _modelsFuture;
  Future<List<dynamic>>? _generationsFuture;

  @override
  void initState() {
    super.initState();
    _brandsFuture = ApiClient().fetchVehicleBrands();
  }

  void _selectBrand(Map<String, dynamic> brand) {
    setState(() {
      _selectedBrand = brand;
      _modelsFuture = ApiClient().fetchModelsForBrand(brand['id'] as String);
      _step = _Step.model;
    });
  }

  /// Real VIN lookup and resolution (new). Decodes the real VIN via
  /// the real backend (see ApiClient.decodeVin's own header comment).
  /// For a non-Chinese brand, the real backend's NHTSA fallback often
  /// includes a real model too -- resolves as far down as brand ->
  /// model -> generation when all three genuinely match, using the
  /// real decoded year to pick the right generation. For a Chinese
  /// brand (the real local WMI table), there's genuinely no model
  /// data at all -- an honest, deliberate limitation discussed
  /// directly with the person -- so this correctly stops at brand and
  /// hands off to that brand's own model list instead.
  ///
  /// Degrades gracefully at whichever real step doesn't find a match,
  /// rather than failing outright: a real brand match with no real
  /// model match still pre-selects the brand and lets the person pick
  /// the model themselves from there, and so on. Fuzzy-matched by a
  /// simple case-insensitive substring check -- the real backend's own
  /// naming (WMI table or NHTSA) won't always exactly match this
  /// app's own real brand/model names character-for-character (e.g.
  /// "Mercedes-Benz" vs "Mercedes").
  Future<void> _lookupByVin() async {
    final vin = await showDialog<String>(
      context: context,
      builder: (dialogContext) {
        final controller = TextEditingController();
        return AlertDialog(
          title: Text(tr(context, 'enter_your_vin')),
          content: TextField(
            controller: controller,
            autofocus: true,
            maxLength: 17,
            textCapitalization: TextCapitalization.characters,
            decoration: InputDecoration(hintText: tr(context, 'vin_hint'), border: const OutlineInputBorder()),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.of(dialogContext).pop(), child: Text(tr(context, 'cancel'))),
            FilledButton(onPressed: () => Navigator.of(dialogContext).pop(controller.text), child: Text(tr(context, 'look_up_button'))),
          ],
        );
      },
    );
    if (vin == null || vin.trim().isEmpty || !mounted) return;

    setState(() => _isLookingUpVin = true);
    try {
      final decoded = await ApiClient().decodeVin(vin);
      final decodedMake = decoded['make']!;
      final decodedModel = decoded['model'] ?? '';
      final decodedYear = int.tryParse(decoded['year'] ?? '');
      final decodedLabel = [decodedMake, if (decodedModel.isNotEmpty) decodedModel, if (decodedYear != null) '($decodedYear)'].join(' ');

      final brands = await ApiClient().fetchVehicleBrands();
      final matchedBrand = _firstMatch(brands.cast<Map<String, dynamic>>().where(
            (b) => (b['name'] as String).toLowerCase().contains(decodedMake.toLowerCase()) || decodedMake.toLowerCase().contains((b['name'] as String).toLowerCase()),
          ));
      if (matchedBrand == null || !mounted) {
        _showVinResultMessage('Decoded: $decodedLabel — but this brand isn\'t in our catalog yet. Please select your vehicle manually.');
        return;
      }

      final models = await ApiClient().fetchModelsForBrand(matchedBrand['id'] as String);
      final matchedModel = decodedModel.isEmpty
          ? null
          : _firstMatch(models.cast<Map<String, dynamic>>().where(
                (m) => (m['name'] as String).toLowerCase().contains(decodedModel.toLowerCase()) || decodedModel.toLowerCase().contains((m['name'] as String).toLowerCase()),
              ));
      if (matchedModel == null || !mounted) {
        // Real, honest handoff: no real model to match (Chinese-brand
        // local-table lookup), or the real decoded model didn't match
        // anything in this brand's own real model list. Lands on the
        // matched brand's own model list rather than pretending to
        // resolve further. _pendingVinYear carries the real decoded
        // year forward so _selectModel's own generation fetch can
        // pre-narrow once the person picks a model.
        _pendingVinYear = decodedYear;
        _showVinResultMessage('Decoded: $decodedLabel. Please pick your model below.');
        setState(() {
          _selectedBrand = matchedBrand;
          _modelsFuture = Future.value(models);
          _step = _Step.model;
        });
        return;
      }

      final generations = await ApiClient().fetchGenerationsForModel(matchedModel['id'] as String);
      final matchedGeneration = decodedYear == null
          ? null
          : _firstMatch(generations.cast<Map<String, dynamic>>().where((g) {
              final yearStart = g['yearStart'] as int;
              final yearEnd = g['yearEnd'] as int?;
              return decodedYear >= yearStart && (yearEnd == null || decodedYear <= yearEnd);
            }));
      if (matchedGeneration == null || !mounted) {
        _showVinResultMessage('Decoded: $decodedLabel — found the brand and model, but not the exact generation for that year. Please continue from here.');
        setState(() {
          _selectedBrand = matchedBrand;
          _selectedModel = matchedModel;
          _generationsFuture = Future.value(generations);
          _step = _Step.generation;
        });
        return;
      }

      // Full real resolution succeeded -- brand, model, and year all
      // genuinely matched. Same real completion path _selectGeneration
      // itself uses for a matched generation.
      _selectedBrand = matchedBrand;
      _selectedModel = matchedModel;
      _selectGeneration(matchedGeneration);
    } on ApiException catch (e) {
      _showVinResultMessage(e.message);
    } catch (e) {
      _showVinResultMessage('Could not look up this VIN. Please select your vehicle manually.');
    } finally {
      if (mounted) setState(() => _isLookingUpVin = false);
    }
  }

  void _showVinResultMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message), duration: const Duration(seconds: 5)));
  }

  /// Dependency-free null-safe "first match" (new) -- deliberately
  /// not `.firstOrNull` (a real `package:collection` extension method
  /// not confirmed available in this project's own real dependency
  /// tree), avoiding a real risk of a compile error over one small
  /// helper.
  Map<String, dynamic>? _firstMatch(Iterable<Map<String, dynamic>> items) {
    for (final item in items) return item;
    return null;
  }

  Future<void> _selectModel(Map<String, dynamic> model) async {
    setState(() {
      _selectedModel = model;
      _generationsFuture = ApiClient().fetchGenerationsForModel(model['id'] as String);
      _step = _Step.generation;
    });
    final pendingYear = _pendingVinYear;
    _pendingVinYear = null;
    if (pendingYear == null) return;
    try {
      final generations = await _generationsFuture!;
      final matchedGeneration = _firstMatch(generations.cast<Map<String, dynamic>>().where((g) {
        final yearStart = g['yearStart'] as int;
        final yearEnd = g['yearEnd'] as int?;
        return pendingYear >= yearStart && (yearEnd == null || pendingYear <= yearEnd);
      }));
      if (matchedGeneration != null && mounted) {
        _selectGeneration(matchedGeneration);
      }
    } catch (_) {
      // Real, deliberate no-op: a failure here just leaves the person
      // on the real, already-visible generation list to pick manually
      // -- no worse off than before the real VIN lookup ran.
    }
  }

  void _selectGeneration(Map<String, dynamic> generation) {
    final yearStart = generation['yearStart'] as int;
    final yearEnd = generation['yearEnd'] as int?;
    // A still-in-production generation (yearEnd null) or one spanning
    // more than one year genuinely needs a year picked; a single-year
    // generation has nothing left to ask.
    if (yearEnd != null && yearEnd == yearStart) {
      Navigator.of(context).pop(VehicleFilterSelection(
        generationId: generation['id'] as String,
        label: _labelFor(generation),
        yearStart: yearStart,
        year: yearStart,
      ));
      return;
    }
    setState(() {
      _selectedGeneration = generation;
      _step = _Step.year;
    });
  }

  String _labelFor(Map<String, dynamic> generation) {
    final brand = _selectedBrand?['name'] as String? ?? '';
    final model = _selectedModel?['name'] as String? ?? '';
    final genName = generation['name'] as String;
    final yearStart = generation['yearStart'];
    final yearEnd = generation['yearEnd'];
    final years = yearEnd == null ? '$yearStart–present' : '$yearStart–$yearEnd';
    return '$brand · $model · $genName ($years)';
  }

  void _goBack() {
    setState(() {
      if (_step == _Step.year) {
        _step = _Step.generation;
        _selectedGeneration = null;
      } else if (_step == _Step.generation) {
        _step = _Step.model;
        _selectedModel = null;
      } else if (_step == _Step.model) {
        _step = _Step.brand;
        _selectedBrand = null;
      }
    });
  }

  String _title(BuildContext context) {
    final isAr = context.watch<LanguageState>().isArabic;
    switch (_step) {
      case _Step.brand:
        return tr(context, 'choose_a_brand');
      case _Step.model:
        final brand = _selectedBrand;
        if (brand == null) return tr(context, 'choose_a_model');
        return (isAr ? brand['nameAr'] as String? : null) ?? brand['name'] as String;
      case _Step.generation:
        final model = _selectedModel;
        if (model == null) return tr(context, 'choose_a_generation');
        return (isAr ? model['nameAr'] as String? : null) ?? model['name'] as String;
      case _Step.year:
        return tr(context, 'choose_a_year');
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: SizedBox(
        height: MediaQuery.of(context).size.height * 0.7,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(4, 8, 16, 8),
              child: Row(
                children: [
                  if (_step != _Step.brand)
                    IconButton(icon: const Icon(Icons.arrow_back), tooltip: 'Back', onPressed: _goBack)
                  else
                    const SizedBox(width: 48),
                  Expanded(
                    child: Text(_title(context), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                  ),
                  IconButton(icon: const Icon(Icons.close), tooltip: 'Close', onPressed: () => Navigator.of(context).pop()),
                ],
              ),
            ),
            const Divider(height: 1),
            Expanded(child: _buildStepBody()),
          ],
        ),
      ),
    );
  }

  Widget _buildStepBody() {
    final isAr = context.watch<LanguageState>().isArabic;
    switch (_step) {
      case _Step.brand:
        return Column(
          children: [
            // Real VIN lookup entry point (new) -- see _lookupByVin's
            // own header comment for the full real resolution logic
            // and its honest limitations.
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
              child: SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: _isLookingUpVin ? null : _lookupByVin,
                  icon: _isLookingUpVin ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.qr_code_scanner_outlined, size: 18),
                  label: Text(_isLookingUpVin ? tr(context, 'looking_up_vin') : tr(context, 'have_vin_look_up')),
                ),
              ),
            ),
            const Divider(height: 1),
            Expanded(child: _buildList(future: _brandsFuture, onTap: _selectBrand, labelOf: (b) => (isAr ? b['nameAr'] as String? : null) ?? b['name'] as String)),
          ],
        );
      case _Step.model:
        return _buildList(future: _modelsFuture!, onTap: (m) => _selectModel(m), labelOf: (m) => (isAr ? m['nameAr'] as String? : null) ?? m['name'] as String);
      case _Step.generation:
        return _buildList(
          future: _generationsFuture!,
          onTap: _selectGeneration,
          labelOf: (g) {
            final years = g['yearEnd'] == null ? '${g['yearStart']}–present' : '${g['yearStart']}–${g['yearEnd']}';
            return '${g['name']} ($years)';
          },
        );
      case _Step.year:
        return _buildYearList();
    }
  }

  Widget _buildList({
    required Future<List<dynamic>> future,
    required void Function(Map<String, dynamic>) onTap,
    required String Function(Map<String, dynamic>) labelOf,
  }) {
    return FutureBuilder<List<dynamic>>(
      future: future,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const ListSkeleton(itemCount: 4);
        }
        if (snapshot.hasError) {
          return Center(child: Text('${tr(context, 'could_not_load_error')}: ${snapshot.error}', style: const TextStyle(color: LeapColors.muted)));
        }
        final items = (snapshot.data ?? []).cast<Map<String, dynamic>>();
        if (items.isEmpty) {
          return Center(child: Text(tr(context, 'nothing_here_yet'), style: const TextStyle(color: LeapColors.muted)));
        }
        return ListView.separated(
          padding: const EdgeInsets.symmetric(vertical: 8),
          itemCount: items.length,
          separatorBuilder: (_, __) => const Divider(height: 1),
          itemBuilder: (context, i) => ListTile(
            title: Text(labelOf(items[i])),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => onTap(items[i]),
          ),
        );
      },
    );
  }

  Widget _buildYearList() {
    final generation = _selectedGeneration!;
    final yearStart = generation['yearStart'] as int;
    final yearEnd = generation['yearEnd'] as int?;
    // A generation still in production (yearEnd null) has no real upper
    // bound to enumerate -- offer "Any year" plus a reasonable window
    // from yearStart through the current year rather than an unbounded list.
    final effectiveEnd = yearEnd ?? DateTime.now().year;
    final years = [for (var y = yearStart; y <= effectiveEnd; y++) y];
    return ListView.separated(
      padding: const EdgeInsets.symmetric(vertical: 8),
      itemCount: years.length + 1,
      separatorBuilder: (_, __) => const Divider(height: 1),
      itemBuilder: (context, i) {
        if (i == 0) {
          return ListTile(
            title: Text(tr(context, 'any_year_in_generation'), style: const TextStyle(fontWeight: FontWeight.w700)),
            onTap: () => Navigator.of(context).pop(VehicleFilterSelection(
              generationId: generation['id'] as String,
              label: _labelFor(generation),
              yearStart: yearStart,
            )),
          );
        }
        final year = years[i - 1];
        return ListTile(
          title: Text('$year'),
          onTap: () => Navigator.of(context).pop(VehicleFilterSelection(
            generationId: generation['id'] as String,
            label: _labelFor(generation),
            yearStart: yearStart,
            year: year,
          )),
        );
      },
    );
  }
}
