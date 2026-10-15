// "Shop by symptom": what is wrong, in the buyer's words, and the search words that find the parts that usually fix it. The same 8 symptoms, with the same search words, as
// the mobile app (apps/mobile/lib/features/catalog/shop_by_symptom_screen.dart), so both show the same results for the same complaint.
export interface Symptom { id: string; en: string; ar: string; query: string }

export const SYMPTOMS: readonly Symptom[] = [
  { id: "wont-start", en: "Car won't start", ar: "السيارة لا تعمل", query: "battery starter ignition" },
  { id: "braking-noise", en: "Squealing or grinding when braking", ar: "صرير عند الفرملة", query: "brake pads disc" },
  { id: "rough-ride", en: "Bumpy or rough ride", ar: "قيادة غير مستقرة", query: "shock absorber strut" },
  { id: "pulls-aside", en: "Car pulls to one side", ar: "السيارة تنحرف لجانب", query: "ball joint control arm sway bar" },
  { id: "rough-idle", en: "Rough idle or poor fuel economy", ar: "استهلاك وقود مرتفع", query: "spark plug air filter fuel filter" },
  { id: "warning-light", en: "Dashboard warning light on", ar: "تشغيل ضوء تحذير", query: "sensor fuse" },
  { id: "overheating", en: "Engine overheating", ar: "ارتفاع حرارة المحرك", query: "water pump head gasket" },
  { id: "lights-out", en: "Lights not working", ar: "الأضواء لا تعمل", query: "headlight taillight bulb" },
];
