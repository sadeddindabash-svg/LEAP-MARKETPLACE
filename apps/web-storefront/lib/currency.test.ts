import { describe, it, expect } from "vitest";
import { availableCurrencies, convertUsd, detectCurrency, formatAmount, formatPrice, regionOf, ARAB_WORDS } from "./currency";

const rates = { SAR: 3.75, AED: 3.67, EUR: 0.92 };
const plain = (s: string) => s.replace(/\u00a0/g, " ");

describe("display currency (the mobile app's rules)", () => {
  it("CRITICAL: converts US dollars with the server's rate, and dollars need no rate", () => {
    expect(convertUsd(40, "USD", {})).toBe(40);
    expect(convertUsd(40, "SAR", rates)).toBe(150);
    expect(convertUsd(40, "XYZ", rates)).toBeNull();                 // no rate: the caller shows dollars
    expect(convertUsd(40, "SAR", { SAR: 0 })).toBeNull();            // a zero or broken rate is never used
  });

  it("amounts are whole numbers; English uses the currency symbol or code", () => {
    expect(plain(formatAmount(43, "USD", "en"))).toBe("$43");
    expect(plain(formatAmount(42.6, "USD", "en"))).toBe("$43");
    expect(plain(formatAmount(160, "SAR", "en"))).toBe("SAR 160");
    expect(plain(formatAmount(39.5, "EUR", "en"))).toBe("€40");
  });

  it("CRITICAL: in Arabic the digits stay 0-9 and only the currency is Arabic (\"160 ريال\", \"43 دولار\"); a currency without an Arabic word stays as in English", () => {
    expect(formatAmount(160, "SAR", "ar")).toBe("160 ريال");
    expect(formatAmount(1600, "AED", "ar")).toBe("1,600 درهم");
    expect(formatAmount(43, "USD", "ar")).toBe("43 دولار");
    expect(plain(formatAmount(40, "EUR", "ar"))).toBe("€40");
    expect(formatAmount(1234567, "SAR", "ar")).not.toMatch(/[٠-٩]/);
  });
  it("every Arab currency has its word, and no Arabic-Indic digit is ever produced", () => {
    const words = { SAR: "ريال", AED: "درهم", OMR: "ريال", QAR: "ريال", KWD: "دينار", BHD: "دينار", JOD: "دينار", USD: "دولار" };
    for (const [code, word] of Object.entries(words)) { const text = formatAmount(2050.4, code, "ar"); expect(text, code).toBe(`2,050 ${word}`); expect(text).not.toMatch(/[٠-٩]/); expect(ARAB_WORDS[code]).toBe(word); }
  });
  it("English is unchanged: \"SAR 160\", \"$43\"", () => { expect(plain(formatAmount(160, "SAR", "en"))).toBe("SAR 160"); expect(plain(formatAmount(43, "USD", "en"))).toBe("$43"); });

  it("CRITICAL: a price in dollars is shown in the chosen currency, and falls back to dollars when there is no rate", () => {
    expect(plain(formatPrice(40, "SAR", rates, "en"))).toBe("SAR 150");
    expect(plain(formatPrice(40, "USD", rates, "en"))).toBe("$40");
    expect(plain(formatPrice(40, "XYZ", rates, "en"))).toBe("$40");
    expect(formatPrice(40, "SAR", rates, "ar")).toBe("150 ريال");
  });

  it("the default comes from the browser's region, only when the server has a rate for that market's currency", () => {
    expect(regionOf("ar-SA")).toBe("SA");
    expect(regionOf("en_AE")).toBe("AE");
    expect(regionOf("en")).toBeUndefined();
    expect(regionOf(undefined)).toBeUndefined();
    expect(detectCurrency("ar-SA", rates)).toBe("SAR");
    expect(detectCurrency("ar-SA", { AED: 3.67 })).toBe("USD");        // no SAR rate yet
    expect(detectCurrency("en", rates)).toBe("USD");
    expect(detectCurrency("en-US", rates)).toBe("USD");
    expect(detectCurrency("xx-ZZ", rates)).toBe("USD");                // a region that is not a launch market
  });

  it("the choice list is dollars first, then every currency the server has a rate for", () => {
    expect(availableCurrencies(rates)).toEqual(["USD", "AED", "EUR", "SAR"]);
    expect(availableCurrencies({})).toEqual(["USD"]);
    expect(availableCurrencies({ USD: 1, SAR: 3.75 })).toEqual(["USD", "SAR"]);
  });
});
