"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useLang, useT } from "@/components/LangProvider";
import QuotationDocument from "@/components/QuotationDocument";
import { fetchPublicQuotation, quoteErrorText, type Quotation } from "@/lib/quotations";

// The quotation on its own, sized for an A4 page, for "Download PDF": the browser's print window opens by itself and "Save as PDF" keeps it as a file.
// The site's header and footer are hidden while printing; the quotation alone goes on the paper.
const PRINT_CSS = `@media print { @page { size: A4; margin: 14mm; } body * { visibility: hidden !important; } #quotation-print, #quotation-print * { visibility: visible !important; }
#quotation-print { position: absolute; inset: 0 auto auto 0; width: 100%; } .no-print { display: none !important; } * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } html, body { background: #fff !important; } }`;

export default function QuotationPrintPage() {
  const params = useParams();
  const code = String(params.code ?? "");
  const lang = useLang();
  const t = useT();
  const [quote, setQuote] = useState<Quotation | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let current = true;
    fetchPublicQuotation(code, lang, false).then((q) => { if (current) setQuote(q); }).catch((e) => { if (current) setError(quoteErrorText(e, t)); });
    return () => { current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, lang]);
  useEffect(() => {
    if (!quote) return;
    const id = window.setTimeout(() => window.print(), 400);      // after the QR code image has loaded
    return () => window.clearTimeout(id);
  }, [quote]);
  if (error) return <p role="alert" className="mx-auto max-w-2xl px-4 py-12 text-center text-[#a12a21]">{error}</p>;
  if (!quote) return <div className="mx-auto max-w-3xl px-4 py-12 text-muted" aria-busy="true">{t("search_loading")}</div>;
  return (
    <div className="mx-auto max-w-[820px] px-4 py-6">
      <style>{PRINT_CSS}</style>
      <p className="no-print mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#f4f6f8] px-4 py-2.5 text-sm text-muted">
        <span>{t("quote_print_hint")}</span>
        <button type="button" onClick={() => window.print()} className="inline-flex min-h-10 items-center rounded-[10px] bg-signal px-4 font-bold text-on-signal">{t("quote_download_pdf")}</button>
      </p>
      <div id="quotation-print"><QuotationDocument quote={quote} print /></div>
    </div>
  );
}
