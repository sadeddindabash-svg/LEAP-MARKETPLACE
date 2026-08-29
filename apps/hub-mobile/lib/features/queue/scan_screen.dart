import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:provider/provider.dart';
import '../../core/language_state.dart';
import '../../core/hub_strings.dart';
import '../../core/theme.dart';
import '../shipment/shipment_detail_screen.dart';

/// The new capability this whole rebuild exists for. The web hub
/// portal's own README explicitly notes real-time barcode scanning
/// was considered and deferred there specifically because it needed a
/// real scanning dependency and a physical device with a real printed
/// code to verify against -- neither available in that development
/// environment. Native mobile removes both blockers.
///
/// Encodes/expects just a bare hub_shipment id in the scanned code
/// (not a URL) -- matches the person's own confirmed design decision:
/// keeps this decoupled from any particular screen/URL structure. A
/// scan for an id that doesn't exist, or belongs to a different hub,
/// is already handled cleanly by ShipmentDetailScreen's own existing
/// 404 error state -- no separate "not found" UI needed here.
class ScanScreen extends StatefulWidget {
  const ScanScreen({super.key});

  @override
  State<ScanScreen> createState() => _ScanScreenState();
}

class _ScanScreenState extends State<ScanScreen> {
  final MobileScannerController _controller = MobileScannerController(
    formats: const [BarcodeFormat.qrCode],
  );
  bool _hasHandledScan = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _handleDetection(BarcodeCapture capture) {
    if (_hasHandledScan) return; // real, deliberate debounce -- a single
    // camera frame can report the same real code multiple times in a
    // row; without this, the same scan could push the detail screen
    // onto the stack more than once.
    final barcodes = capture.barcodes;
    if (barcodes.isEmpty) return;
    final rawValue = barcodes[0].rawValue;
    if (rawValue == null || rawValue.trim().isEmpty) return;

    _hasHandledScan = true;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => ShipmentDetailScreen(shipmentId: rawValue.trim())),
    );
  }

  @override
  Widget build(BuildContext context) {
    final t = kHubStrings[context.watch<LanguageState>().language]!;
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: Text(t.queue.title),
        actions: [
          IconButton(
            icon: ValueListenableBuilder<MobileScannerState>(
              valueListenable: _controller,
              builder: (context, state, child) {
                return Icon(state.torchState == TorchState.on ? Icons.flash_on : Icons.flash_off);
              },
            ),
            onPressed: () => _controller.toggleTorch(),
          ),
        ],
      ),
      body: Stack(
        fit: StackFit.expand,
        children: [
          MobileScanner(
            controller: _controller,
            onDetect: _handleDetection,
            placeholderBuilder: (context, child) {
              return const ColoredBox(
                color: Colors.black,
                child: Center(child: CircularProgressIndicator(color: Colors.white)),
              );
            },
            errorBuilder: (context, error, child) {
              return Container(
                color: Colors.black,
                padding: const EdgeInsets.all(24),
                alignment: Alignment.center,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.no_photography_outlined, color: Colors.white, size: 40),
                    const SizedBox(height: 12),
                    Text(
                      'Camera error: ${error.errorCode.name}${error.errorDetails?.message != null ? '\n${error.errorDetails!.message}' : ''}',
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Colors.white, fontSize: 13),
                    ),
                  ],
                ),
              );
            },
          ),
          // Real, simple viewfinder frame -- purely visual guidance,
          // has no effect on the actual real detection logic above.
          Center(
            child: Container(
              width: 240,
              height: 240,
              decoration: BoxDecoration(
                border: Border.all(color: HubColors.signal, width: 3),
                borderRadius: BorderRadius.circular(16),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
