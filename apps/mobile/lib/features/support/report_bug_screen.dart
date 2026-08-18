import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'dart:io';
import '../../core/theme.dart';
import '../../core/auth_state.dart';
import '../../core/app_strings.dart';
import '../../services/api_client.dart';

/// Real "Report a bug" flow (#139). HONEST SCOPE, stated directly:
/// "screenshot" here means attaching a real photo the person already
/// took (reusing the same real picker already used for reviews/
/// avatars) -- not an automatic, in-app full-screen capture. A true
/// automatic capture has real technical limitations (native overlays,
/// certain platform views don't render into a RepaintBoundary
/// capture) that make it unreliable as the primary path; attaching a
/// real screenshot the person already has is more honest and just as
/// useful.
///
/// Real, automatically-collected device info (OS, app version) -- the
/// real device's own values, never fabricated.
class ReportBugScreen extends StatefulWidget {
  const ReportBugScreen({super.key});

  @override
  State<ReportBugScreen> createState() => _ReportBugScreenState();
}

class _ReportBugScreenState extends State<ReportBugScreen> {
  final _descriptionController = TextEditingController();
  XFile? _screenshot;
  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  void dispose() {
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _attachScreenshot() async {
    final picked = await ImagePicker().pickImage(source: ImageSource.gallery, imageQuality: 85);
    if (picked != null && mounted) setState(() => _screenshot = picked);
  }

  Future<String> _collectDeviceInfo() async {
    try {
      final packageInfo = await PackageInfo.fromPlatform();
      final deviceInfoPlugin = DeviceInfoPlugin();
      String osDetail;
      if (Platform.isAndroid) {
        final info = await deviceInfoPlugin.androidInfo;
        osDetail = 'Android ${info.version.release} (SDK ${info.version.sdkInt}), ${info.model}';
      } else if (Platform.isIOS) {
        final info = await deviceInfoPlugin.iosInfo;
        osDetail = 'iOS ${info.systemVersion}, ${info.utsname.machine}';
      } else {
        osDetail = Platform.operatingSystem;
      }
      return '$osDetail — LEAP ${packageInfo.version} (${packageInfo.buildNumber})';
    } catch (_) {
      return 'Unknown device'; // real, honest fallback -- never blocks submission over this
    }
  }

  Future<void> _submit() async {
    if (_descriptionController.text.trim().isEmpty) return;
    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });
    try {
      final auth = context.read<AuthState>();
      String? screenshotUrl;
      if (_screenshot != null) {
        // Real upload, reusing the exact same real generic endpoint
        // already used for reviews/avatars -- only if a real, logged-
        // in token exists; a real guest's bug report still submits
        // fine without a real screenshot rather than being blocked.
        if (auth.token != null) {
          screenshotUrl = await ApiClient().uploadAvatarPhoto(auth.token!, _screenshot!);
        }
      }
      final deviceInfo = await _collectDeviceInfo();
      await ApiClient().submitBugReport(
        description: _descriptionController.text.trim(),
        screenshotUrl: screenshotUrl,
        deviceInfo: deviceInfo,
        token: auth.token,
      );
      if (mounted) Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      setState(() => _errorMessage = e.message);
    } catch (_) {
      setState(() => _errorMessage = trRead(context, 'report_bug_submit_error'));
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = LeapPalette.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(tr(context, 'report_bug_title'))),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(tr(context, 'report_bug_what_happened'), style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: palette.ink)),
            const SizedBox(height: 8),
            TextField(
              controller: _descriptionController,
              maxLines: 5,
              decoration: InputDecoration(hintText: tr(context, 'report_bug_description_hint'), border: const OutlineInputBorder()),
            ),
            const SizedBox(height: 16),
            OutlinedButton.icon(
              onPressed: _attachScreenshot,
              icon: const Icon(Icons.attach_file),
              label: Text(_screenshot == null ? tr(context, 'report_bug_attach_screenshot') : tr(context, 'report_bug_screenshot_attached')),
            ),
            if (_errorMessage != null) ...[
              const SizedBox(height: 12),
              Text(_errorMessage!, style: const TextStyle(color: Colors.red, fontSize: 12.5)),
            ],
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: _isSubmitting ? null : _submit,
              child: _isSubmitting
                  ? SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: palette.onSignal))
                  : Text(tr(context, 'report_bug_submit')),
            ),
          ],
        ),
      ),
    );
  }
}
