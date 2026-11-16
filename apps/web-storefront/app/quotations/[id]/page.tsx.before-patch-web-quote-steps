"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "@/components/LocLink";
import SignInPrompt from "@/components/SignInPrompt";
import { getAuthToken, useAuth } from "@/components/AuthProvider";
import { useLang, useT } from "@/components/LangProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import { useLocRouter } from "@/components/useLocRouter";
import QuotationDocument from "@/components/QuotationDocument";
import QuotationShares from "@/components/QuotationShares";
import QuotationStateBanner from "@/components/QuotationStateBanner";
import { fetchMyQuotation, quoteErrorText, renewQuotation, type Quotation } from "@/lib/quotations";

const outline = "inline-flex min-h-11 items-center rounded-[10px] border-[1.5px] border-navy px-4 text-sm font-bold text-navy hover:bg-chalk disabled:opacity-50";

// One of the buyer's quotations: the link to send (copy or share), the PDF, how often the link was opened, each share (the buyer can confirm their own
// here too), and, when it has expired, a new one with the same parts at today's prices.
export default function MyQuotationPage() {
  const params = useParams();
  const id = String(params.id ?? "");
  const { user, isLoading } = useAuth();
  const lang = useLang();
  const t = useT();
  const { code: currencyCode } = useCurrency();
  const router = useLocRouter();
  const [quote, setQuote] = useState<Quotation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const [version, setVersion] = useState(0);      // a share confirmed here: read the quotation again (its order, the payer's details)
  useEffect(() => {
    if (!user) return;
    const token = getAuthToken();
    if (!token) return;
    let current = true;
    fetchMyQuotation(token, id, lang).then((q) => { if (current) setQuote(q); }).catch((e) => { if (current) setError(quoteErrorText(e, t)); });
    return () => { current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, id, lang, version]);

  if (isLoading) return <div className="mx-auto max-w-5xl px-4 py-10 sm:px-8" aria-busy="true">{t("search_loading")}</div>;
  if (!user) return <SignInPrompt messageKey="login_for_quotations" next={`/quotations/${id}`} />;
  if (error) return <p role="alert" className="mx-auto max-w-5xl px-4 py-10 font-semibold text-[#a12a21] sm:px-8">{error}</p>;
  if (!quote) return <div className="mx-auto max-w-5xl px-4 py-10 text-muted sm:px-8" aria-busy="true">{t("search_loading")}</div>;

  const link = quote.link ?? "";
  const copy = async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* the link stays shown, to copy by hand */ } };
  const share = async () => { try { await navigator.share({ title: `${t("quote_doc_title_case")} ${quote.id}`, url: link }); } catch { /* closed or not supported */ } };
  const renew = async () => {
    const token = getAuthToken();
    if (!token) return;
    setBusy(true);
    try { const next = await renewQuotation(token, quote.id, lang, currencyCode); router.push(`/quotations/${encodeURIComponent(next.id)}`); }
    catch (e) { setError(quoteErrorText(e, t)); setBusy(false); }
  };
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  return (
    <div className="mx-auto grid max-w-5xl gap-4 px-4 py-8 sm:px-8">
      <Link href="/quotations" className="text-sm font-semibold text-navy underline underline-offset-4">{t("my_quotations")}</Link>
      <QuotationStateBanner quote={quote} orderLink />
      {quote.state === "open" && (
        <section className="rounded-[14px] border border-line bg-white p-5" aria-labelledby="quote-send">
          <h2 id="quote-send" className="text-lg font-bold text-navy">{t("quote_send_title")}</h2>
          <p className="mt-1 text-sm text-muted">{t("quote_send_lead")}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code data-testid="quotation-link" className="min-w-0 flex-1 truncate rounded-lg bg-[#f4f6f8] px-3 py-2.5 text-sm" dir="ltr">{link}</code>
            <button type="button" onClick={copy} className={outline}>{copied ? t("quote_link_copied") : t("quote_copy_link")}</button>
            {canShare && <button type="button" onClick={share} className={outline}>{t("quote_share_link")}</button>}
            <Link href={`/q/${encodeURIComponent(quote.code)}/print`} target="_blank" className={outline}>{t("quote_download_pdf")}</Link>
          </div>
          {typeof quote.openCount === "number" && <p className="mt-2 text-xs text-muted">{t("quote_opened", { n: quote.openCount })}</p>}
        </section>
      )}
      {quote.state === "expired" && (
        <button type="button" onClick={renew} disabled={busy} className="inline-flex min-h-12 items-center justify-self-start rounded-[10px] bg-signal px-6 font-bold text-on-signal hover:bg-signal-dark disabled:opacity-50">{t("quote_renew")}</button>
      )}
      <QuotationDocument quote={quote} />
      <QuotationShares quote={quote} onChange={() => setVersion((n) => n + 1)} />
    </div>
  );
}
