import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../core/language_state.dart';
import '../../core/auth_state.dart';
import '../../services/api_client.dart';
import '../../models/saved_search.dart';

/// Real saved searches management (migration 039) -- list and remove.
/// Saving itself happens from the search screen's own action; this
/// screen is purely for reviewing and managing what's already saved.
class SavedSearchesScreen extends StatefulWidget {
  const SavedSearchesScreen({super.key});

  @override
  State<SavedSearchesScreen> createState() => _SavedSearchesScreenState();
}

class _SavedSearchesScreenState extends State<SavedSearchesScreen> {
  List<SavedSearch>? _searches;
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final token = context.read<AuthState>().token;
    if (token == null) return;
    setState(() { _isLoading = true; _error = null; });
    try {
      final searches = await ApiClient().fetchSavedSearches(token);
      if (mounted) setState(() { _searches = searches; _isLoading = false; });
    } on ApiException catch (e) {
      if (mounted) setState(() { _error = e.message; _isLoading = false; });
    }
  }

  Future<void> _delete(SavedSearch s) async {
    final token = context.read<AuthState>().token;
    if (token == null) return;
    try {
      await ApiClient().deleteSavedSearch(token, s.id);
      if (mounted) setState(() => _searches?.removeWhere((x) => x.id == s.id));
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final isAr = context.watch<LanguageState>().isArabic;
    return Scaffold(
      appBar: AppBar(title: Text(isAr ? 'عمليات البحث المحفوظة' : 'Saved searches')),
      body: _buildBody(isAr),
    );
  }

  Widget _buildBody(bool isAr) {
    if (_isLoading) return const Center(child: CircularProgressIndicator());
    if (_error != null) return Center(child: Text(_error!, style: const TextStyle(color: LeapColors.muted)));
    final searches = _searches ?? [];
    if (searches.isEmpty) {
      return Center(
        child: Text(
          isAr ? 'لا توجد عمليات بحث محفوظة بعد. احفظ بحثًا من شاشة البحث لتلقي إشعارات بالنتائج الجديدة.'
               : 'No saved searches yet. Save one from the search screen to get notified of new matches.',
          textAlign: TextAlign.center,
          style: const TextStyle(color: LeapColors.muted),
        ),
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: searches.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (context, i) {
        final s = searches[i];
        return Card(
          child: ListTile(
            leading: const Icon(Icons.bookmark_outlined, color: LeapColors.ink),
            title: Text(s.label, style: const TextStyle(fontWeight: FontWeight.w600)),
            subtitle: Text(s.searchTerm ?? s.category ?? ''),
            trailing: IconButton(
              icon: const Icon(Icons.delete_outline, color: LeapColors.muted),
              onPressed: () => _delete(s),
            ),
          ),
        );
      },
    );
  }
}
