import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import '../../core/theme.dart';
import '../../core/app_strings.dart';
import '../../core/auth_state.dart';
import '../../services/api_client.dart';
import '../../models/quote_request.dart';
import '../search/vehicle_filter_sheet.dart';

const int kMaxQuoteRequestItems = 20;

/// Real "request a part we don't carry" buyer form (RFQ), confirmed
/// with the person's own workflow description through several rounds
/// of design discussion before building: brand -> model -> generation
/// -> year (the same real cascade already used elsewhere), then up to
/// 20 real parts (name, description, optional photo). Reuses
/// VehicleFilterSheet directly (the same real picker My Garage's own
/// add-vehicle flow already uses) rather than a new one.
class RequestQuoteScreen extends StatefulWidget {
  const RequestQuoteScreen({super.key});

  @override
  State<RequestQuoteScreen> createState() => _RequestQuoteScreenState();
}

class _RequestQuoteScreenState extends State<RequestQuoteScreen> {
  QuoteRequest? _request;
  bool _isPickingVehicle = true;
  String? _errorMessage;
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _pickVehicleAndCreate());
  }

  Future<void> _pickVehicleAndCreate() async {
    final selection = await showModalBottomSheet<VehicleFilterSelection>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const VehicleFilterSheet(),
    );
    if (!mounted) return;
    if (selection == null) {
      // Real, deliberate -- no point showing an empty request form
      // with no real vehicle chosen; return wherever the buyer came
      // from instead.
      context.pop();
      return;
    }
    final token = context.read<AuthState>().token;
    if (token == null) return;
    try {
      // Real fallback, matching My Garage's own established
      // convention exactly: this real request always needs one
      // definite year, unlike search where "any year" is a genuine,
      // valid choice.
      final request = await ApiClient().createQuoteRequest(token, generationId: selection.generationId, year: selection.year ?? selection.yearStart);
      if (mounted) setState(() { _request = request; _isPickingVehicle = false; });
    } on ApiException catch (e) {
      if (mounted) setState(() { _errorMessage = e.message; _isPickingVehicle = false; });
    }
  }

  Future<void> _addItem() async {
    final result = await showModalBottomSheet<_NewItemResult>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const _AddItemSheet(),
    );
    if (result == null || !mounted) return;
    final token = context.read<AuthState>().token;
    if (token == null) return;
    setState(() => _errorMessage = null);
    try {
      final updated = await ApiClient().addQuoteRequestItem(
        token,
        _request!.id,
        name: result.name,
        description: result.description,
        referencePhotoUrl: result.photoUrl,
      );
      if (mounted) setState(() => _request = updated);
    } on ApiException catch (e) {
      if (mounted) setState(() => _errorMessage = e.message);
    }
  }

  Future<void> _removeItem(String itemId) async {
    final token = context.read<AuthState>().token;
    if (token == null) return;
    try {
      final updated = await ApiClient().deleteQuoteRequestItem(token, _request!.id, itemId);
      if (mounted) setState(() => _request = updated);
    } on ApiException catch (e) {
      if (mounted) setState(() => _errorMessage = e.message);
    }
  }

  Future<void> _submit() async {
    final token = context.read<AuthState>().token;
    if (token == null) return;
    setState(() { _isSubmitting = true; _errorMessage = null; });
    try {
      await ApiClient().submitQuoteRequest(token, _request!.id);
      if (mounted) {
        context.pushReplacement('/part-requests');
      }
    } on ApiException catch (e) {
      if (mounted) setState(() { _errorMessage = e.message; _isSubmitting = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = LeapPalette.of(context);
    final isAr = Localizations.localeOf(context).languageCode == 'ar';

    if (_isPickingVehicle) {
      return Scaffold(appBar: AppBar(), body: const SizedBox.shrink());
    }
    if (_request == null) {
      return Scaffold(
        appBar: AppBar(title: Text(isAr ? 'طلب عرض سعر' : 'Request a quote')),
        body: Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(_errorMessage ?? (isAr ? 'حدث خطأ ما.' : 'Something went wrong.')))),
      );
    }

    final request = _request!;
    return Scaffold(
      appBar: AppBar(title: Text(isAr ? 'طلب عرض سعر' : 'Request a quote')),
      body: SafeArea(
        child: Column(
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              margin: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: palette.chalk, borderRadius: BorderRadius.circular(10)),
              child: Row(
                children: [
                  Icon(Icons.directions_car_outlined, size: 18, color: palette.muted),
                  const SizedBox(width: 8),
                  Expanded(child: Text(request.vehicleLabel, style: TextStyle(fontSize: 13, color: palette.ink))),
                ],
              ),
            ),
            if (_errorMessage != null)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14),
                child: Text(_errorMessage!, style: const TextStyle(color: Colors.red, fontSize: 12.5)),
              ),
            Expanded(
              child: request.items.isEmpty
                  ? Center(child: Text(isAr ? 'أضف قطعة واحدة على الأقل' : 'Add at least one item', style: TextStyle(color: palette.muted, fontSize: 13)))
                  : ListView.separated(
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                      itemCount: request.items.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 10),
                      itemBuilder: (context, i) {
                        final item = request.items[i];
                        return Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(border: Border.all(color: palette.line), borderRadius: BorderRadius.circular(10)),
                          child: Row(
                            children: [
                              if (item.referencePhotoUrl != null)
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(6),
                                  child: Image.network(ApiClient.resolveMediaUrl(item.referencePhotoUrl!), width: 44, height: 44, fit: BoxFit.cover),
                                ),
                              if (item.referencePhotoUrl != null) const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(item.name, style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700)),
                                    if (item.description != null)
                                      Text(item.description!, style: TextStyle(fontSize: 12, color: palette.muted)),
                                  ],
                                ),
                              ),
                              IconButton(icon: const Icon(Icons.close, size: 18), onPressed: () => _removeItem(item.id)),
                            ],
                          ),
                        );
                      },
                    ),
            ),
            Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                children: [
                  OutlinedButton.icon(
                    onPressed: request.items.length >= kMaxQuoteRequestItems ? null : _addItem,
                    icon: const Icon(Icons.add, size: 18),
                    label: Text(isAr ? 'إضافة قطعة (${request.items.length}/$kMaxQuoteRequestItems)' : 'Add item (${request.items.length}/$kMaxQuoteRequestItems)'),
                    style: OutlinedButton.styleFrom(minimumSize: const Size(double.infinity, 46)),
                  ),
                  const SizedBox(height: 10),
                  ElevatedButton(
                    onPressed: (request.items.isEmpty || _isSubmitting) ? null : _submit,
                    style: ElevatedButton.styleFrom(minimumSize: const Size(double.infinity, 48), backgroundColor: palette.signal, foregroundColor: palette.onSignal),
                    child: Text(_isSubmitting ? (isAr ? 'جارٍ الإرسال…' : 'Submitting…') : (isAr ? 'إرسال الطلب' : 'Submit request')),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _NewItemResult {
  final String name;
  final String? description;
  final String? photoUrl;
  const _NewItemResult({required this.name, this.description, this.photoUrl});
}

class _AddItemSheet extends StatefulWidget {
  const _AddItemSheet();

  @override
  State<_AddItemSheet> createState() => _AddItemSheetState();
}

class _AddItemSheetState extends State<_AddItemSheet> {
  final _nameController = TextEditingController();
  final _descriptionController = TextEditingController();
  String? _photoUrl;
  bool _isUploadingPhoto = false;
  String? _errorMessage;

  @override
  void dispose() {
    _nameController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _pickPhoto() async {
    final picked = await ImagePicker().pickImage(source: ImageSource.gallery, imageQuality: 85);
    if (picked == null || !mounted) return;
    final token = context.read<AuthState>().token;
    if (token == null) return;
    setState(() { _isUploadingPhoto = true; _errorMessage = null; });
    try {
      final url = await ApiClient().uploadReviewPhoto(token, picked);
      if (mounted) setState(() { _photoUrl = url; _isUploadingPhoto = false; });
    } on ApiException catch (e) {
      if (mounted) setState(() { _errorMessage = e.message; _isUploadingPhoto = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = LeapPalette.of(context);
    final isAr = Localizations.localeOf(context).languageCode == 'ar';
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom, left: 16, right: 16, top: 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(isAr ? 'إضافة قطعة' : 'Add item', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
          const SizedBox(height: 14),
          TextField(controller: _nameController, onChanged: (_) => setState(() {}), decoration: InputDecoration(labelText: isAr ? 'اسم القطعة' : 'Part name', border: const OutlineInputBorder())),
          const SizedBox(height: 10),
          TextField(controller: _descriptionController, maxLines: 2, decoration: InputDecoration(labelText: isAr ? 'الوصف (اختياري)' : 'Description (optional)', border: const OutlineInputBorder())),
          const SizedBox(height: 10),
          GestureDetector(
            onTap: _isUploadingPhoto ? null : _pickPhoto,
            child: Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(border: Border.all(color: palette.line, style: BorderStyle.solid), borderRadius: BorderRadius.circular(8)),
              child: _isUploadingPhoto
                  ? const Center(child: SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)))
                  : _photoUrl != null
                      ? ClipRRect(borderRadius: BorderRadius.circular(8), child: Image.network(ApiClient.resolveMediaUrl(_photoUrl!), fit: BoxFit.cover))
                      : Icon(Icons.add_a_photo_outlined, color: palette.muted),
            ),
          ),
          if (_errorMessage != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(_errorMessage!, style: const TextStyle(color: Colors.red, fontSize: 12))),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: _nameController.text.trim().isEmpty
                ? null
                : () => Navigator.pop(
                      context,
                      _NewItemResult(name: _nameController.text.trim(), description: _descriptionController.text.trim().isEmpty ? null : _descriptionController.text.trim(), photoUrl: _photoUrl),
                    ),
            style: ElevatedButton.styleFrom(minimumSize: const Size(double.infinity, 46), backgroundColor: palette.signal, foregroundColor: palette.onSignal),
            child: Text(isAr ? 'إضافة' : 'Add'),
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }
}
