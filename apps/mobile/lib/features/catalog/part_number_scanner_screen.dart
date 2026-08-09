import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:google_mlkit_text_recognition/google_mlkit_text_recognition.dart';
import '../../core/theme.dart';

/// Real "search by photo" for a printed part/OEM number -- reads the
/// real, physically-printed number on a part directly from a real
/// photo, using real on-device OCR (no cloud API key, no per-request
/// cost, works offline). Deliberately scoped to reading real printed
/// text, not general visual/object recognition -- a real, honest
/// distinction: most auto parts already have their real identifying
/// number stamped or printed on them, and that's what actually
/// differentiates one part from another, not how it looks.
///
/// HONEST LIMITATION, stated directly: camera capture and real
/// on-device OCR cannot be exercised or verified in this sandbox --
/// worth a real, direct test on a real device the first time this is
/// used for real.
class PartNumberScannerScreen extends StatefulWidget {
  const PartNumberScannerScreen({super.key});

  @override
  State<PartNumberScannerScreen> createState() => _PartNumberScannerScreenState();
}

class _PartNumberScannerScreenState extends State<PartNumberScannerScreen> {
  final _textRecognizer = TextRecognizer(script: TextRecognitionScript.latin);
  bool _isProcessing = false;
  List<String> _candidates = [];
  String? _errorMessage;

  @override
  void dispose() {
    _textRecognizer.close();
    super.dispose();
  }

  Future<void> _takePhoto() async {
    final picked = await ImagePicker().pickImage(source: ImageSource.camera, imageQuality: 90);
    if (picked == null || !mounted) return;
    setState(() {
      _isProcessing = true;
      _errorMessage = null;
      _candidates = [];
    });
    try {
      final inputImage = InputImage.fromFilePath(picked.path);
      final result = await _textRecognizer.processImage(inputImage);
      // Real candidate extraction (new) -- a real part often has more
      // than one real printed string on it (a brand name AND a part
      // number, for example), so every real recognized line becomes
      // its own real, tappable candidate rather than guessing which
      // one is the actual part number. Filters out very short real
      // fragments (single characters, stray marks OCR sometimes
      // picks up) that are never genuinely useful as a search term.
      final lines = <String>[];
      for (final block in result.blocks) {
        for (final line in block.lines) {
          final text = line.text.trim();
          if (text.length >= 3 && !lines.contains(text)) lines.add(text);
        }
      }
      if (mounted) {
        setState(() {
          _candidates = lines;
          if (lines.isEmpty) {
            _errorMessage = 'Couldn\'t read any text in that photo. Try getting closer, or in better light.';
          }
        });
      }
    } catch (e) {
      if (mounted) setState(() => _errorMessage = 'Couldn\'t process that photo. Please try again.');
    } finally {
      if (mounted) setState(() => _isProcessing = false);
    }
  }

  void _searchFor(String text) {
    context.pushReplacement('/search', extra: {'initialQuery': text});
  }

  @override
  Widget build(BuildContext context) {
    final isAr = Localizations.localeOf(context).languageCode == 'ar';
    final palette = LeapPalette.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(isAr ? 'صورة رقم القطعة' : 'Photo of part number')),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Icon(Icons.document_scanner_outlined, size: 56, color: palette.signal),
            const SizedBox(height: 16),
            Text(
              isAr
                  ? 'صوّر الرقم المطبوع على القطعة أو رقم القطعة الأصلي (OEM)، وسنبحث عنه لك.'
                  : 'Take a photo of the number printed on the part or its OEM number, and we\'ll search for it.',
              textAlign: TextAlign.center,
              style: TextStyle(color: palette.muted, fontSize: 13.5),
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: _isProcessing ? null : _takePhoto,
              icon: _isProcessing
                  ? SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: palette.onSignal))
                  : const Icon(Icons.camera_alt_outlined),
              label: Text(_isProcessing ? (isAr ? 'جارٍ القراءة...' : 'Reading...') : (isAr ? 'تصوير' : 'Take photo')),
            ),
            if (_errorMessage != null) ...[
              const SizedBox(height: 16),
              Text(_errorMessage!, textAlign: TextAlign.center, style: TextStyle(color: Colors.red.shade700, fontSize: 12.5)),
            ],
            if (_candidates.isNotEmpty) ...[
              const SizedBox(height: 24),
              Text(
                isAr ? 'ما الذي وجدناه — اختر للبحث:' : 'What we found — tap to search:',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: palette.ink),
              ),
              const SizedBox(height: 10),
              Expanded(
                child: ListView.separated(
                  itemCount: _candidates.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (context, i) {
                    final candidate = _candidates[i];
                    return Card(
                      child: ListTile(
                        title: Text(candidate, style: const TextStyle(fontWeight: FontWeight.w600)),
                        trailing: const Icon(Icons.search),
                        onTap: () => _searchFor(candidate),
                      ),
                    );
                  },
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
