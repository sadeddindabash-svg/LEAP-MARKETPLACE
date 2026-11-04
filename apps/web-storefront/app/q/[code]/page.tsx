"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "@/components/LocLink";
import { useLang, useT } from "@/components/LangProvider";
import QuotationDocument from "@/components/QuotationDocument";
import QuotationShares from "@/components/QuotationShares";
import QuotationStateBanner from "@/components/QuotationStateBanner";
import { fetchPublicQuotation, quoteErrorText, type Quotation } from "@/lib/quotations";

// The page the shared link and the QR code open, for anyone (no account): is it genuine and still valid, the quotation itself, and each share to confirm.
// When the last share is confirmed the server places the order and this page says so.
export default function QuotationCheckPage() {
  const params = useParams();
  const code = String(params.code ?? "");
  const lang = useLang();
  const t = useT();
  const [quote, setQuote] = useState<Quotation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [placed, setPlaced] = useState(false);

  useEffect(() => {
    let current = true;
    fetchPublicQuotation(code, lang).then((q) => { if (current) setQuote(q); }).catch((e) => { if (current) setError(quoteErrorText(e, t)); });
    return () => { current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, lang]);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-14 text-center sm:px-8">
        <h1 className="text-2xl font-bold text-navy">{t("quote_not_found_title")}</h1>
        <p role="alert" className="mt-2 text-muted">{error}</p>
      </div>
    );
  }
  if (!quote) return <div className="mx-auto max-w-5xl px-4 py-12 text-muted sm:px-8" aria-busy="true">{t("search_loading")}</div>;
  return (
    <div className="mx-auto grid max-w-5xl gap-4 px-4 py-8 sm:px-8">
      <QuotationStateBanner quote={quote} />
      {placed && <p role="status" data-testid="order-placed" className="rounded-xl border border-[#b9e4cc] bg-[#e8f7ef] px-4 py-3 font-bold text-[#0f6b49]">{t("quote_order_placed", { order: quote.orderId ?? "" })}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-navy">{t("quote_doc_title_case")} <span dir="ltr">{quote.id}</span></h1>
        <Link href={`/q/${encodeURIComponent(code)}/print`} target="_blank" className="inline-flex min-h-11 items-center rounded-[10px] border-[1.5px] border-navy px-4 text-sm font-bold text-navy hover:bg-chalk">{t("quote_download_pdf")}</Link>
      </div>
      <QuotationDocument quote={quote} />
      <QuotationShares quote={quote} onChange={(q) => { setQuote(q); if (q.orderPlaced) setPlaced(true); }} />
    </div>
  );
}
