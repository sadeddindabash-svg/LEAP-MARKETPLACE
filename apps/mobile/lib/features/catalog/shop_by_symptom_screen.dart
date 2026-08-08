import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme.dart';

/// Real "Shop by symptom" guided entry point (#15) -- a curated list
/// mapping real, common car symptoms to genuine parts that actually
/// exist in this app's own real catalog taxonomy (confirmed directly
/// against the real seed data's own categories/parts: Brake System,
/// Engine, Electrical, Filters, Suspension, Lighting). This is
/// deliberately NOT a diagnostic tool making any real claim about
/// what's actually wrong with a person's real car -- it's a
/// navigation shortcut into real search, using real automotive
/// knowledge about which real parts commonly relate to a given real
/// symptom, exactly the same real search a person could type
/// themselves, just pre-filled.
class _Symptom {
  final String labelEn;
  final String labelAr;
  final IconData icon;
  final String searchQuery;
  const _Symptom({required this.labelEn, required this.labelAr, required this.icon, required this.searchQuery});
}

const List<_Symptom> _kSymptoms = [
  _Symptom(labelEn: 'Car won\'t start', labelAr: 'السيارة لا تعمل', icon: Icons.power_settings_new, searchQuery: 'battery starter ignition'),
  _Symptom(labelEn: 'Squealing or grinding when braking', labelAr: 'صرير عند الفرملة', icon: Icons.warning_amber_outlined, searchQuery: 'brake pads disc'),
  _Symptom(labelEn: 'Bumpy or rough ride', labelAr: 'قيادة غير مستقرة', icon: Icons.terrain_outlined, searchQuery: 'shock absorber strut'),
  _Symptom(labelEn: 'Car pulls to one side', labelAr: 'السيارة تنحرف لجانب', icon: Icons.compare_arrows, searchQuery: 'ball joint control arm sway bar'),
  _Symptom(labelEn: 'Rough idle or poor fuel economy', labelAr: 'استهلاك وقود مرتفع', icon: Icons.local_gas_station_outlined, searchQuery: 'spark plug air filter fuel filter'),
  _Symptom(labelEn: 'Dashboard warning light on', labelAr: 'تشغيل ضوء تحذير', icon: Icons.error_outline, searchQuery: 'sensor fuse'),
  _Symptom(labelEn: 'Engine overheating', labelAr: 'ارتفاع حرارة المحرك', icon: Icons.thermostat_outlined, searchQuery: 'water pump head gasket'),
  _Symptom(labelEn: 'Lights not working', labelAr: 'الأضواء لا تعمل', icon: Icons.lightbulb_outline, searchQuery: 'headlight taillight bulb'),
];

class ShopBySymptomScreen extends StatelessWidget {
  const ShopBySymptomScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final isAr = Localizations.localeOf(context).languageCode == 'ar';
    final palette = LeapPalette.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(isAr ? 'تسوق حسب العارض' : 'Shop by symptom')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            isAr
                ? 'ما الذي تلاحظه في سيارتك؟ اخترنا لك القطع الأكثر ارتباطًا.'
                : 'What\'s your car doing? We\'ll suggest the parts most likely related.',
            style: TextStyle(color: palette.muted, fontSize: 13),
          ),
          const SizedBox(height: 16),
          ..._kSymptoms.map((s) => Card(
                margin: const EdgeInsets.only(bottom: 10),
                child: ListTile(
                  leading: CircleAvatar(backgroundColor: palette.chalk, child: Icon(s.icon, color: palette.signal)),
                  title: Text(isAr ? s.labelAr : s.labelEn, style: TextStyle(fontWeight: FontWeight.w600, color: palette.ink)),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/search', extra: {'initialQuery': s.searchQuery}),
                ),
              )),
        ],
      ),
    );
  }
}
