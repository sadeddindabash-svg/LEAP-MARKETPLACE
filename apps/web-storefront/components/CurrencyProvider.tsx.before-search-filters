"use client";

import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { availableCurrencies, detectCurrency, formatPrice, type Rates } from "@/lib/currency";
import { fetchDisplayRates } from "@/lib/api";
import { useLang } from "./LangProvider";

const KEY = "leap_currency";
const EVENT = "leap-currency";

interface CurrencyValue { code: string; available: string[]; setCurrency: (code: string) => void; format: (usd: number) => string }

// Without a provider (a test, an isolated component) prices simply show in US dollars.
const CurrencyContext = createContext<CurrencyValue>({ code: "USD", available: ["USD"], setCurrency: () => {}, format: (usd) => formatPrice(usd, "USD", {}, "en") });

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => { window.removeEventListener("storage", onChange); window.removeEventListener(EVENT, onChange); };
}
const readChoice = () => { try { return localStorage.getItem(KEY) ?? ""; } catch { return ""; } };
const readLocale = () => (typeof navigator === "undefined" ? "" : navigator.language ?? "");

/**
 * The currency prices are SHOWN in (the order is still placed in US dollars). The choice is remembered in this browser; without one, the default comes from the browser's
 * region (ar-SA gives Saudi riyals) when the server has a rate for it, else dollars. The first render is always dollars (what the server drew), then it switches.
 */
export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const lang = useLang();
  const [rates, setRates] = useState<Rates>({});
  useEffect(() => {
    let current = true;
    fetchDisplayRates().then((r) => { if (current) setRates(r); });
    return () => { current = false; };
  }, []);
  const choice = useSyncExternalStore(subscribe, readChoice, () => "");
  const locale = useSyncExternalStore(() => () => {}, readLocale, () => "");

  const value = useMemo<CurrencyValue>(() => {
    const available = availableCurrencies(rates);
    const code = choice && available.includes(choice) ? choice : detectCurrency(locale, rates);
    return {
      code,
      available,
      setCurrency: (next) => { try { localStorage.setItem(KEY, next); } catch { /* private mode: the choice just is not remembered */ } window.dispatchEvent(new Event(EVENT)); },
      format: (usd) => formatPrice(usd, code, rates, lang),
    };
  }, [rates, choice, locale, lang]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export const useCurrency = (): CurrencyValue => useContext(CurrencyContext);
