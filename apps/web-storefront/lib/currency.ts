// Display currency, with the rules of the mobile app (apps/mobile/lib/core/currency_state.dart): every price in the catalog is in US dollars, and the buyer may SEE it in
// another currency, converted with the server's display rates (GET /pricing/display-rates). Amounts are shown in whole units; the Arab currencies use their Arabic symbol and
// Arabic digits when the page is Arabic. This is for display only: the order is still placed and charged in US dollars.
import { COUNTRY_CURRENCY } from "./markets";
import type { Lang } from "./i18n";

export const ARAB_SYMBOLS: Record<string, string> = { SAR: "ر.س", AED: "د.إ", OMR: "ر.ع.", KWD: "د.ك", BHD: ".د.ب", QAR: "ر.ق", JOD: "د.ا" };
/** The currency as a word, for an Arabic page: the number keeps its digits 0-9 and only the currency is Arabic ("160 ريال"). Other currencies keep the English style. */
export const ARAB_WORDS: Record<string, string> = { SAR: "ريال", AED: "درهم", OMR: "ريال", QAR: "ريال", KWD: "دينار", BHD: "دينار", JOD: "دينار", USD: "دولار" };
export type Rates = Record<string, number>;

/** US dollars converted to [code], or null when there is no rate for it (the caller then shows dollars). USD itself needs no rate. */
export function convertUsd(usd: number, code: string, rates: Rates): number | null {
  if (code === "USD") return usd;
  const rate = rates[code];
  return typeof rate === "number" && rate > 0 ? usd * rate : null;
}

/** "SAR 160" / "$43" in English; "160 ريال" / "43 دولار" in Arabic (the digits stay 0-9; only the currency is Arabic). Whole units, like the app. */
export function formatAmount(amount: number, code: string, lang: Lang): string {
  const rounded = Math.round(amount);
  if (lang === "ar" && ARAB_WORDS[code]) return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(rounded)} ${ARAB_WORDS[code]}`;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: code, maximumFractionDigits: 0, currencyDisplay: "symbol" }).format(rounded);
}

/** A price in US dollars, as the visitor chose to see it (dollars when there is no rate for their currency). */
export function formatPrice(usd: number, code: string, rates: Rates, lang: Lang): string {
  const converted = convertUsd(usd, code, rates);
  return converted === null ? formatAmount(usd, "USD", lang) : formatAmount(converted, code, lang);
}

/** "ar-SA" gives "SA"; "en" gives undefined. */
export function regionOf(locale: string | undefined): string | undefined {
  const match = /^[a-z]{2,3}[-_]([A-Za-z]{2})\b/.exec(locale ?? "");
  return match ? match[1].toUpperCase() : undefined;
}

/** The default display currency for a browser language like "ar-SA": that market's currency, if the server has a rate for it; otherwise US dollars. */
export function detectCurrency(locale: string | undefined, rates: Rates): string {
  const region = regionOf(locale);
  const code = region ? COUNTRY_CURRENCY[region] : undefined;
  return code && (code === "USD" || rates[code]) ? code : "USD";
}

/** The currencies a visitor can choose: US dollars, and every currency the server has a rate for. */
export function availableCurrencies(rates: Rates): string[] {
  return ["USD", ...Object.keys(rates).filter((c) => c !== "USD").sort()];
}
