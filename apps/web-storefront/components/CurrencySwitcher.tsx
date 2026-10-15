"use client";

import { useCurrency } from "./CurrencyProvider";
import { useT } from "./LangProvider";

/** Choose the currency prices are shown in. Hidden until the server has rates to offer (with none, dollars are all there is). */
export default function CurrencySwitcher() {
  const { code, available, setCurrency } = useCurrency();
  const t = useT();
  if (available.length < 2) return null;
  return (
    <span className="flex items-center gap-1.5">
      <label htmlFor="currency-choice">{t("currency_label")}</label>
      <select id="currency-choice" value={code} onChange={(e) => setCurrency(e.target.value)} className="rounded border border-[#2a4a5e] bg-navy-deep px-1.5 py-0.5 text-[13px] text-[#c9d6de]">
        {available.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
    </span>
  );
}
