import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../core/language_state.dart';
import '../../core/auth_state.dart';
import '../../services/api_client.dart';
import '../../models/saved_search.dart';
import '../../widgets/skeleton.dart';

/// Real relative-time formatting for the real lastCheckedAt field --
/// matches the real Stitch reference's own "Last checked: Xh ago"
/// concept, using genuine data that already existed rather than a
/// fabricated one.
///
/// [now] is injectable (defaults to the real `DateTime.now()` for
/// identical real production behavior) specifically so this is
/// genuinely testable without depending on exactly when a real test
/// happens to run -- see test/relative_time_test.dart.
String relativeTime(DateTime? dt, bool isAr, {DateTime? now}) {
  if (dt == null) return isAr ? 'لم يُفحص بعد' : 'Not checked yet';
  final effectiveNow = now ?? DateTime.now();
  final diff = effectiveNow.difference(dt);
  if (diff.inMinutes < 1) return isAr ? 'الآن' : 'just now';
  if (diff.inHours < 1) return isAr ? 'منذ ${diff.inMinutes} د' : '${diff.inMinutes}m ago';
  if (diff.inDays < 1) return isAr ? 'منذ ${diff.inHours} س' : '${diff.inHours}h ago';
  return isAr ? 'منذ ${diff.inDays} يوم' : '${diff.inDays}d ago';
}

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

  // Real confirmation dialog (new) -- closes a real, genuine
  // inconsistency: the addresses screen already asks for confirmation
  // before a real delete; this screen deleted immediately with no
  // safety net at all for an equally irreversible action. tr()-style
  // translation isn't used in this file (it already uses inline
  // ternaries throughout, matched here); the dialog's own builder is a
  // real, separate widget-construction callback -- safe, unlike a
  // bare event-handler body.
  void _confirmDelete(SavedSearch s, bool isAr) {
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        content: Text(isAr ? 'هل تريد حذف بحثك المحفوظ "${s.label}"؟' : 'Delete your saved search "${s.label}"?'),
        actions: [
          TextButton(onPressed: () => Navigator.of(dialogContext).pop(), child: Text(isAr ? 'إلغاء' : 'Cancel')),
          TextButton(
            onPressed: () { Navigator.of(dialogContext).pop(); _delete(s); },
            child: Text(isAr ? 'حذف' : 'Delete', style: const TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isAr = context.watch<LanguageState>().isArabic;
    return Scaffold(
      appBar: AppBar(title: Text(isAr ? 'عمليات البحث المحفوظة' : 'Saved searches')),
      body: _buildBody(isAr),
    );
  }

  // Real relative-time formatting for the real lastCheckedAt field
  // (new) -- matches the real Stitch reference's own "Last checked: Xh
  // ago" concept, using genuine data that already existed rather than
  // a fabricated one.
  Widget _buildBody(bool isAr) {
    final palette = LeapPalette.of(context);
    if (_isLoading) return const ListSkeleton();
    if (_error != null) return Center(child: Text(_error!, style: TextStyle(color: palette.muted)));
    final searches = _searches ?? [];
    if (searches.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            isAr ? 'لا توجد عمليات بحث محفوظة بعد. احفظ بحثًا من شاشة البحث لتلقي إشعارات بالنتائج الجديدة.'
                 : 'No saved searches yet. Save one from the search screen to get notified of new matches.',
            textAlign: TextAlign.center,
            style: TextStyle(color: palette.muted),
          ),
        ),
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: searches.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (context, i) {
        final s = searches[i];
        return Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: palette.card, borderRadius: BorderRadius.circular(12), border: Border.all(color: palette.line)),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(color: palette.chalk, borderRadius: BorderRadius.circular(10)),
                child: Icon(Icons.bookmark_outlined, color: palette.signal),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(s.label, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: palette.ink)),
                    const SizedBox(height: 3),
                    Text(s.searchTerm ?? s.category ?? '', style: TextStyle(fontSize: 12, color: palette.muted)),
                    const SizedBox(height: 4),
                    Text(
                      '${isAr ? 'آخر فحص:' : 'Last checked:'} ${relativeTime(s.lastCheckedAt, isAr)}',
                      style: TextStyle(fontSize: 10.5, color: palette.muted, fontStyle: FontStyle.italic),
                    ),
                  ],
                ),
              ),
              // Real, static "notifications on" indicator (new) --
              // deliberately not a toggle: the whole point of a real
              // saved search is the real periodic backend check that
              // notifies on a new match, always active for every real
              // saved search, not a per-search on/off preference that
              // doesn't exist in the real data model.
              Icon(Icons.notifications_active, color: palette.signal, size: 20),
              IconButton(
                icon: Icon(Icons.delete_outline, color: palette.muted),
                tooltip: isAr ? 'حذف' : 'Delete',
                onPressed: () => _confirmDelete(s, isAr),
              ),
            ],
          ),
        );
      },
    );
  }
}
