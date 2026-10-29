import 'package:flutter/material.dart';
import '../core/app_strings.dart';
import '../core/theme.dart';
import '../models/fit_verdict.dart';
import '../models/vehicle.dart';

/// Under the part's name: what the buyer's VERSION means for this part. Nothing for a part that fits every version, or that does not list the car (the screen has its own message for that).
///   fits a narrowed part      "This part is for: Performance AWD, Excellence AWD"
///   wrong version             amber: "Doesn't fit your version. This part is for ... Your car: ... You can still order it."
///   no version saved          grey: "This part fits only some versions of ...", with a button to choose the version in the garage
class FitVersionNote extends StatelessWidget {
  final FitVerdict? verdict;
  final Vehicle? vehicle;
  final Map<String, Map<String, String?>> versionNames;
  final VoidCallback onChooseVersion;
  const FitVersionNote({super.key, required this.verdict, required this.vehicle, required this.versionNames, required this.onChooseVersion});

  @override
  Widget build(BuildContext context) {
    final v = verdict;
    final car = vehicle;
    if (v == null || car == null || v.kind == FitKind.fits || v.kind == FitKind.notListed) return const SizedBox.shrink();
    final isAr = Directionality.of(context) == TextDirection.rtl;
    final palette = LeapPalette.of(context);
    final versions = v.versionIds.map((id) => versionNameOf(versionNames, id, isAr)).join(isAr ? '، ' : ', ');
    final brand = (isAr ? car.brandAr : null) ?? car.brand;
    final model = (isAr ? car.modelAr : null) ?? car.model;
    final versionLabel = isAr ? (car.versionNameAr ?? car.versionName) : car.versionName;
    final carLabel = '$brand $model · ${car.year}${versionLabel != null ? ' · $versionLabel' : ''}';
    String fill(String key) => tr(context, key).replaceAll('{versions}', versions).replaceAll('{car}', carLabel);
    if (v.kind == FitKind.fitsVersions) {
      return Padding(
        key: const Key('fit-versions'),
        padding: const EdgeInsets.only(top: 6),
        child: Text(fill('fit_part_is_for'), style: TextStyle(fontSize: 12.5, color: palette.muted)),
      );
    }
    final wrong = v.kind == FitKind.wrongVersion;
    return Container(
      key: Key(wrong ? 'fit-wrong-version' : 'fit-need-version'),
      margin: const EdgeInsets.only(top: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: (wrong ? palette.signal : palette.muted).withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: (wrong ? palette.signal : palette.muted).withValues(alpha: 0.4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (wrong) ...[
            Text(tr(context, 'fit_wrong_version'), style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5, color: palette.ink)),
            const SizedBox(height: 2),
            Text(fill('fit_wrong_version_detail'), style: TextStyle(fontSize: 12.5, color: palette.ink)),
          ] else ...[
            Text(fill('fit_need_version'), style: TextStyle(fontSize: 12.5, color: palette.ink)),
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: TextButton(onPressed: onChooseVersion, child: Text(tr(context, 'fit_choose_version'), style: const TextStyle(fontWeight: FontWeight.w800))),
            ),
          ],
        ],
      ),
    );
  }
}
