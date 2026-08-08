import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../../core/theme.dart';

/// Real barcode/OEM part-number scanner (#1) -- feeds a genuinely
/// scanned code straight into the existing real search, exactly the
/// same real search a person could type themselves, just captured via
/// the camera instead. No new backend endpoint needed: search already
/// matches on the real `oemNumber` field directly.
///
/// HONEST LIMITATION, stated directly: this is real, standard
/// `mobile_scanner` usage (the package's own documented API), but
/// camera access cannot be exercised or verified in this sandbox --
/// worth a real, direct test on a real device the first time this is
/// used for real.
class BarcodeScannerScreen extends StatefulWidget {
  const BarcodeScannerScreen({super.key});

  @override
  State<BarcodeScannerScreen> createState() => _BarcodeScannerScreenState();
}

class _BarcodeScannerScreenState extends State<BarcodeScannerScreen> {
  final MobileScannerController _controller = MobileScannerController();
  bool _handled = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    if (_handled) return; // real, deliberate guard -- a real scan can fire multiple detections per frame burst
    if (capture.barcodes.isEmpty) return;
    final code = capture.barcodes.first.rawValue;
    if (code == null || code.trim().isEmpty) return;
    _handled = true;
    context.pushReplacement('/search', extra: {'initialQuery': code.trim()});
  }

  @override
  Widget build(BuildContext context) {
    final isAr = Localizations.localeOf(context).languageCode == 'ar';
    return Scaffold(
      appBar: AppBar(
        title: Text(isAr ? 'مسح الرمز' : 'Scan barcode'),
        actions: [
          IconButton(
            icon: ValueListenableBuilder(
              valueListenable: _controller,
              builder: (context, state, child) => Icon(state.torchState == TorchState.on ? Icons.flash_on : Icons.flash_off),
            ),
            tooltip: isAr ? 'الفلاش' : 'Flash',
            onPressed: () => _controller.toggleTorch(),
          ),
        ],
      ),
      body: Stack(
        children: [
          MobileScanner(controller: _controller, onDetect: _onDetect),
          Center(
            child: Container(
              width: 260,
              height: 140,
              decoration: BoxDecoration(border: Border.all(color: LeapColors.signal, width: 3), borderRadius: BorderRadius.circular(12)),
            ),
          ),
          Positioned(
            bottom: 32,
            left: 24,
            right: 24,
            child: Text(
              isAr ? 'وجّه الكاميرا نحو الرمز الشريطي أو رقم القطعة الأصلي' : 'Point the camera at a barcode or OEM part number',
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}
