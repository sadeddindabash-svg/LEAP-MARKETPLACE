"use client";

import { useCurrency } from "./CurrencyProvider";

/** A price given in US dollars, shown in the currency the visitor chose. */
export function Price({ usd, className }: { usd: number; className?: string }) {
  const { format } = useCurrency();
  return <span className={className}>{format(usd)}</span>;
}
