"use client";

import Link from "@/components/LocLink";
import { useLang, useT } from "./LangProvider";
import { quoteDate, type Quotation } from "@/lib/quotations";

// The first thing the party sees: whether this is a genuine quotation from Leap and whether it can still be used.
export default function QuotationStateBanner({ quote, orderLink = false }: { quote: Quotation; orderLink?: boolean }) {
  const t = useT();
  const lang = useLang();
  const tone = {
    open: "border-[#b9e4cc] bg-[#e8f7ef] text-[#0f6b49]",
    ordered: "border-[#b9d3e4] bg-[#eaf3f9] text-navy",
    expired: "border-[#f1c6c2] bg-[#fdf0ef] text-[#a12a21]",
    cancelled: "border-line bg-[#f4f6f8] text-muted",
  }[quote.state];
  const text = quote.state === "open" ? t("quote_state_open", { date: quoteDate(quote.expiresAt, lang) })
    : quote.state === "expired" ? t("quote_state_expired", { date: quoteDate(quote.expiresAt, lang) })
    : quote.state === "ordered" ? t("quote_state_ordered", { order: quote.orderId ?? "" })
    : t("quote_state_cancelled");
  return (
    <p data-testid="quotation-state" data-state={quote.state} role="status" className={`flex flex-wrap items-center gap-2 rounded-xl border px-4 py-3 font-bold ${tone}`}>
      <span aria-hidden="true">{quote.state === "open" || quote.state === "ordered" ? "✓" : "!"}</span>
      <span>{text}</span>
      {orderLink && quote.state === "ordered" && quote.orderId && <Link href={`/orders/${quote.orderId}`} className="ms-auto underline underline-offset-4">{t("quote_view_order")}</Link>}
    </p>
  );
}
