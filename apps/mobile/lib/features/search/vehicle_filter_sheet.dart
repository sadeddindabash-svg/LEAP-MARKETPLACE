import 'package:flutter/material.dart';
import '../../core/theme.dart';
import '../../services/api_client.dart';

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
/// Four-step drill (brand -> model -> generation -> year), mirroring
/// add_vehicle_screen.dart's simpler two-step pattern. The year step is
/// skipped automatically when a generation only spans one year, or
/// answered as "Any year" without a real prompt when the user doesn't
/// care to narrow further.
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

  void _selectModel(Map<String, dynamic> model) {
    setState(() {
      _selectedModel = model;
      _generationsFuture = ApiClient().fetchGenerationsForModel(model['id'] as String);
      _step = _Step.generation;
    });
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

  String get _title {
    switch (_step) {
      case _Step.brand:
        return 'Choose a brand';
      case _Step.model:
        return _selectedBrand?['name'] as String? ?? 'Choose a model';
      case _Step.generation:
        return _selectedModel?['name'] as String? ?? 'Choose a generation';
      case _Step.year:
        return 'Choose a year';
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
                    IconButton(icon: const Icon(Icons.arrow_back), onPressed: _goBack)
                  else
                    const SizedBox(width: 48),
                  Expanded(
                    child: Text(_title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                  ),
                  IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.of(context).pop()),
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
    switch (_step) {
      case _Step.brand:
        return _buildList(future: _brandsFuture, onTap: _selectBrand, labelOf: (b) => b['name'] as String);
      case _Step.model:
        return _buildList(future: _modelsFuture!, onTap: _selectModel, labelOf: (m) => m['name'] as String);
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
          return const Center(child: CircularProgressIndicator());
        }
        if (snapshot.hasError) {
          return Center(child: Text('Could not load: ${snapshot.error}', style: const TextStyle(color: LeapColors.muted)));
        }
        final items = (snapshot.data ?? []).cast<Map<String, dynamic>>();
        if (items.isEmpty) {
          return const Center(child: Text('Nothing here yet.', style: TextStyle(color: LeapColors.muted)));
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
            title: const Text('Any year in this generation', style: TextStyle(fontWeight: FontWeight.w700)),
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
