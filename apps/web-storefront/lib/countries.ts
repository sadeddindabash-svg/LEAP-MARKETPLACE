// The countries the marketplace serves (the 40 launch markets of services/api/src/config/markets.js, the same list the mobile app has), each with its Arabic name from the
// app's own list (apps/mobile/lib/core/arabic_country_names.dart). The ENGLISH name is what is stored on an address and sent to the server (the server resolves it to the
// market, for the payment methods and the delivery estimate), exactly as the app does.
import { pickName, type Lang } from "./i18n";

export interface Country { code: string; en: string; ar: string }

export const COUNTRIES: readonly Country[] = [
  { code: "SA", en: "Saudi Arabia", ar: "المملكة العربية السعودية" },
  { code: "AE", en: "United Arab Emirates", ar: "الإمارات العربية المتحدة" },
  { code: "OM", en: "Oman", ar: "عمان" },
  { code: "KW", en: "Kuwait", ar: "الكويت" },
  { code: "BH", en: "Bahrain", ar: "البحرين" },
  { code: "QA", en: "Qatar", ar: "قطر" },
  { code: "JO", en: "Jordan", ar: "الأردن" },
  { code: "BE", en: "Belgium", ar: "بلجيكا" },
  { code: "BG", en: "Bulgaria", ar: "بلغاريا" },
  { code: "HR", en: "Croatia", ar: "كرواتيا" },
  { code: "CZ", en: "Czech Republic", ar: "جمهورية التشيك" },
  { code: "DK", en: "Denmark", ar: "الدنمارك" },
  { code: "FI", en: "Finland", ar: "فنلندا" },
  { code: "DE", en: "Germany", ar: "ألمانيا" },
  { code: "HU", en: "Hungary", ar: "المجر" },
  { code: "IE", en: "Ireland", ar: "أيرلندا" },
  { code: "IT", en: "Italy", ar: "إيطاليا" },
  { code: "LV", en: "Latvia", ar: "لاتفيا" },
  { code: "LT", en: "Lithuania", ar: "ليتوانيا" },
  { code: "NL", en: "Netherlands", ar: "هولندا" },
  { code: "PL", en: "Poland", ar: "بولندا" },
  { code: "PT", en: "Portugal", ar: "البرتغال" },
  { code: "RO", en: "Romania", ar: "رومانيا" },
  { code: "SK", en: "Slovakia", ar: "سلوفاكيا" },
  { code: "SI", en: "Slovenia", ar: "سلوفينيا" },
  { code: "ES", en: "Spain", ar: "إسبانيا" },
  { code: "SE", en: "Sweden", ar: "السويد" },
  { code: "GB", en: "United Kingdom", ar: "المملكة المتحدة" },
  { code: "US", en: "United States", ar: "الولايات المتحدة" },
  { code: "MX", en: "Mexico", ar: "المكسيك" },
  { code: "PA", en: "Panama", ar: "بنما" },
  { code: "DO", en: "Dominican Republic", ar: "جمهورية الدومينيكان" },
  { code: "AR", en: "Argentina", ar: "الأرجنتين" },
  { code: "BR", en: "Brazil", ar: "البرازيل" },
  { code: "CL", en: "Chile", ar: "تشيلي" },
  { code: "EC", en: "Ecuador", ar: "الإكوادور" },
  { code: "PY", en: "Paraguay", ar: "باراغواي" },
  { code: "PE", en: "Peru", ar: "بيرو" },
  { code: "UY", en: "Uruguay", ar: "أوروغواي" },
  { code: "VE", en: "Venezuela", ar: "فنزويلا" },
];

export const countryName = (lang: Lang, english: string): string => pickName(lang, english, COUNTRIES.find((c) => c.en === english)?.ar);

/** A country as the buyer typed or the location lookup returned it, found in our list ("saudi arabia" gives Saudi Arabia); undefined when we do not serve it. */
export function findCountry(name: string | null | undefined): Country | undefined {
  const wanted = (name ?? "").trim().toLowerCase();
  if (!wanted) return undefined;
  return COUNTRIES.find((c) => c.en.toLowerCase() === wanted || c.ar === (name ?? "").trim() || c.code.toLowerCase() === wanted);
}
