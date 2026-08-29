import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:provider/provider.dart';
import '../core/language_state.dart';
import '../core/hub_strings.dart';
import '../core/theme.dart';
import '../services/api_client.dart';

/// Faithful port of apps/hub-portal/src/App.jsx's own
/// EvidencePhotoPicker (lines 298-322) -- same real thumbnail grid
/// with a remove button, same real "..." placeholder while uploading.
/// Camera-first by default (ImageSource.camera) -- confirmed this is
/// the single most important real UX moment for this whole rebuild:
/// the web app's own file input used capture="environment" for the
/// exact same real reason.
class EvidencePhotoPicker extends StatelessWidget {
  final List<String> photoUrls;
  final void Function(String url) onAdd;
  final void Function(String url) onRemove;
  final bool isUploading;
  final void Function(bool uploading) onUploadingChanged;
  final void Function(String message) onError;
  final String token;

  const EvidencePhotoPicker({
    super.key,
    required this.photoUrls,
    required this.onAdd,
    required this.onRemove,
    required this.isUploading,
    required this.onUploadingChanged,
    required this.onError,
    required this.token,
  });

  Future<void> _pickAndUpload(BuildContext context, ImageSource source) async {
    final picker = ImagePicker();
    final file = await picker.pickImage(source: source, imageQuality: 90);
    if (file == null) return;
    onUploadingChanged(true);
    try {
      final url = await ApiClient().uploadEvidencePhoto(token, file);
      onAdd(url);
    } on ApiException catch (e) {
      onError(e.message);
    } finally {
      onUploadingChanged(false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = kHubStrings[context.watch<LanguageState>().language]!;
    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: [
        ...photoUrls.map((url) => _PhotoThumbnail(url: url, onRemove: () => onRemove(url))),
        GestureDetector(
          onTap: isUploading ? null : () => _pickAndUpload(context, ImageSource.camera),
          onLongPress: isUploading ? null : () => _pickAndUpload(context, ImageSource.gallery),
          child: Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: HubColors.line, width: 1.5, style: BorderStyle.solid),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                isUploading
                    ? const Text('…', style: TextStyle(fontSize: 11, color: HubColors.muted))
                    : const Icon(Icons.camera_alt_outlined, size: 20, color: HubColors.muted),
                const SizedBox(height: 4),
                Text(t.addPhoto, style: const TextStyle(fontSize: 10, color: HubColors.muted)),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _PhotoThumbnail extends StatelessWidget {
  final String url;
  final VoidCallback onRemove;
  const _PhotoThumbnail({required this.url, required this.onRemove});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 80,
      height: 80,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: CachedNetworkImage(
              imageUrl: ApiClient.resolveMediaUrl(url),
              width: 80,
              height: 80,
              fit: BoxFit.cover,
            ),
          ),
          Positioned(
            top: -6,
            right: -6,
            child: GestureDetector(
              onTap: onRemove,
              child: Container(
                width: 20,
                height: 20,
                decoration: const BoxDecoration(color: HubColors.red, shape: BoxShape.circle),
                child: const Icon(Icons.close, size: 12, color: Colors.white),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
