import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../core/app_strings.dart';
import '../../core/auth_state.dart';
import '../../core/config/app_config.dart';
import '../../services/api_client.dart';

/// Real message thread for one return case — GET/POST
/// /returns/my-cases/:id(/messages). Structurally the same
/// isolation as support tickets: this only ever shows the buyer<->admin
/// thread, never the separate supplier<->admin thread the same case
/// might also have (see the backend module's header comment for why
/// that split is enforced at the query level, not just in this UI).
class ReturnCaseDetailScreen extends StatefulWidget {
  final String caseId;
  const ReturnCaseDetailScreen({super.key, required this.caseId});

  @override
  State<ReturnCaseDetailScreen> createState() => _ReturnCaseDetailScreenState();
}

class _ReturnCaseDetailScreenState extends State<ReturnCaseDetailScreen> {
  Map<String, dynamic>? _returnCase;
  String? _errorMessage;
  bool _isLoading = true;
  bool _isSending = false;
  final _replyController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _replyController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final auth = context.read<AuthState>();
    if (!auth.isLoggedIn) return;
    setState(() => _isLoading = true);
    try {
      final returnCase = await ApiClient().fetchReturnCaseDetail(auth.token!, widget.caseId);
      setState(() {
        _returnCase = returnCase;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = trRead(context, 'could_not_load_return');
        _isLoading = false;
      });
    }
  }

  Future<void> _sendReply() async {
    if (_replyController.text.trim().isEmpty) return;
    final auth = context.read<AuthState>();
    setState(() => _isSending = true);
    try {
      await ApiClient().sendReturnCaseMessage(auth.token!, widget.caseId, _replyController.text.trim());
      _replyController.clear();
      await _load();
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _isSending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(appBar: AppBar(title: Text(tr(context, 'my_returns'))), body: const Center(child: CircularProgressIndicator()));
    }
    if (_errorMessage != null || _returnCase == null) {
      return Scaffold(appBar: AppBar(title: Text(tr(context, 'my_returns'))), body: Center(child: Text(_errorMessage ?? tr(context, 'not_found'), style: const TextStyle(color: LeapColors.muted))));
    }

    final messages = (_returnCase!['messages'] as List).cast<Map<String, dynamic>>();
    final photos = (_returnCase!['photos'] as List?)?.cast<String>() ?? [];
    return Scaffold(
      appBar: AppBar(title: Text(_returnCase!['reason'] as String, maxLines: 1, overflow: TextOverflow.ellipsis)),
      body: Column(
        children: [
          Container(
            width: double.infinity,
            color: const Color(0xFFE9EFFC),
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    '${tr(context, 'return_case_order_label')} ${_returnCase!['orderId']}',
                    style: const TextStyle(color: LeapColors.torque, fontSize: 12),
                  ),
                ),
                Text(
                  trStatus(context, _returnCase!['status'] as String).toUpperCase(),
                  style: const TextStyle(color: LeapColors.torque, fontSize: 12, fontWeight: FontWeight.w700),
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: messages.length + (photos.isNotEmpty ? 1 : 0),
              itemBuilder: (context, i) {
                // Real evidence photos (migration 043), shown once at the
                // top of the thread -- they attach to the case as a
                // whole (filed once, not per-message), not interleaved
                // between individual messages.
                if (photos.isNotEmpty && i == 0) {
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: SizedBox(
                      height: 72,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: photos.length,
                        separatorBuilder: (_, __) => const SizedBox(width: 8),
                        itemBuilder: (context, j) => ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: CachedNetworkImage(imageUrl: '${AppConfig.apiBaseUrl}${photos[j]}', width: 72, height: 72, fit: BoxFit.cover),
                        ),
                      ),
                    ),
                  );
                }
                final m = messages[i - (photos.isNotEmpty ? 1 : 0)];
                final isAdmin = m['senderRole'] == 'admin';
                return Align(
                  alignment: isAdmin ? Alignment.centerLeft : Alignment.centerRight,
                  child: Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
                    decoration: BoxDecoration(
                      color: isAdmin ? LeapColors.chalk : LeapColors.ink,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      m['message'] as String,
                      style: TextStyle(color: isAdmin ? LeapColors.ink : Colors.white, fontSize: 13),
                    ),
                  ),
                );
              },
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _replyController,
                    decoration: InputDecoration(hintText: tr(context, 'type_a_message')),
                    onSubmitted: (_) => _sendReply(),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton.filled(onPressed: _isSending ? null : _sendReply, icon: const Icon(Icons.send)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
