/// The signed-in buyer's saved parts as ONE shared list that every heart in the app reads (a screen of 20 cards makes one request, not 20). A heart changes at once and goes back if the save fails.
/// Plain Dart (no Flutter), so it is tested without a device. [onChanged] is called after every change (the app wires it to notifyListeners).
class WishlistModel {
  final void Function() onChanged;
  final DateTime Function() clock;
  final Duration maxAge;

  WishlistModel({required this.onChanged, DateTime Function()? clock, this.maxAge = const Duration(seconds: 60)}) : clock = clock ?? DateTime.now;

  Set<String> _ids = {};
  final Set<String> _pending = {};
  bool _ready = false;
  bool _loading = false;
  String? _forToken;
  DateTime? _loadedAt;

  /// The list has been loaded (or there is nothing to load: signed out).
  bool get ready => _ready;
  bool isSaved(String productId) => _ids.contains(productId);
  int get count => _ids.length;

  /// Makes sure the list is the one of [token]'s buyer. null (signed out) empties it. A new token (another buyer) empties it and loads theirs. The same token with a list younger than [maxAge] does nothing; an older one is reloaded
  /// quietly (the hearts keep their state meanwhile), and [force] reloads at once. A failed load keeps what is known and never marks a part as saved that was not.
  Future<void> ensureLoaded(String? token, Future<Set<String>> Function(String token) fetch, {bool force = false}) async {
    if (token == null) {
      final changed = _ids.isNotEmpty || !_ready || _forToken != null;
      _ids = {};
      _ready = true;
      _forToken = null;
      _loadedAt = null;
      if (changed) onChanged();
      return;
    }
    if (token != _forToken) {
      _ids = {};
      _ready = false;
      _forToken = token;
      _loadedAt = null;
      onChanged();
    } else if (!force && _ready && _loadedAt != null && clock().difference(_loadedAt!) < maxAge) {
      return;
    }
    if (_loading) return;
    _loading = true;
    try {
      final loaded = await fetch(token);
      if (_forToken == token) {
        // a heart pressed while the list was coming keeps its new state
        _ids = {...loaded.where((id) => !_pending.contains(id)), ..._ids.where(_pending.contains)};
        _loadedAt = clock();
      }
    } catch (_) {
      // the list stays as it was
    } finally {
      _loading = false;
      if (_forToken == token) {
        _ready = true;
        onChanged();
      }
    }
  }

  /// Saves or unsaves [productId]: it changes at once, the server is told, and a failure puts it back. A second press on the same part while the first is on its way is ignored. Returns whether the change stuck.
  Future<bool> toggle(String productId, {required Future<void> Function(String productId) add, required Future<void> Function(String productId) remove}) async {
    if (_pending.contains(productId)) return false;
    final wasSaved = _ids.contains(productId);
    _pending.add(productId);
    _set(productId, !wasSaved);
    onChanged();
    try {
      if (wasSaved) {
        await remove(productId);
      } else {
        await add(productId);
      }
      return true;
    } catch (_) {
      _set(productId, wasSaved);
      return false;
    } finally {
      _pending.remove(productId);
      onChanged();
    }
  }

  void _set(String id, bool saved) {
    final next = {..._ids};
    saved ? next.add(id) : next.remove(id);
    _ids = next;
  }
}
