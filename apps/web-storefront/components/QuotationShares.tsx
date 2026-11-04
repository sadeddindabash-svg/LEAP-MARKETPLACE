"use client";

import { useEffect, useState } from "react";
import { useLang, useT } from "./LangProvider";
import { fetchPaymentMethodsForCountry, type PaymentMethod } from "@/lib/api";
import { confirmQuotationShare, quoteErrorText, quoteMoney, type Quotation, type QuoteShare } from "@/lib/quotations";

const input = "min-h-11 w-full rounded-[10px] border-[1.5px] border-[#c5d0d8] bg-white px-3 text-[15px] text-ink";

// Who pays what, and for each share not yet confirmed a small form: the payer's name, email (and phone) and a payment method for the delivery country.
// No money is taken online, exactly as at checkout. The last confirmation places the order; the page then shows the new state the server sends back.
export default function QuotationShares({ quote, onChange }: { quote: Quotation; onChange: (q: Quotation) => void }) {
  const t = useT();
  const lang = useLang();
  const [methods, setMethods] = useState<PaymentMethod[] | null>(null);
  const country = quote.delivery.country ?? "";
  useEffect(() => {
    if (!country) return;
    let current = true;
    fetchPaymentMethodsForCountry(country).then((m) => { if (current) setMethods(m); }).catch(() => { if (current) setMethods([]); });
    return () => { current = false; };
  }, [country]);
  const open = quote.state === "open";
  return (
    <section className="rounded-[14px] border border-line bg-white p-5" aria-labelledby="quote-pay">
      <h2 id="quote-pay" className="text-lg font-bold text-navy">{t("quote_who_pays")}</h2>
      <ul className="mt-3 grid gap-3">
        {quote.shares.map((s) => (
          <li key={s.id} className="rounded-xl border border-line p-3.5">
            <p className="flex flex-wrap justify-between gap-2 font-semibold">
              <span><bdi>{s.payer === "party" ? quote.party.name : t("quote_payer_buyer")}</bdi> ({s.percent}%)</span>
              <span>{quoteMoney(s.amountUsd, quote.currency, lang)}</span>
            </p>
            {s.confirmed ? (
              <p className="mt-1 text-sm font-bold text-[#0f6b49]" data-testid="share-confirmed">{t("quote_confirmed")}{s.payerName ? ` · ${s.payerName}` : ""}</p>
            ) : open ? (
              <ShareForm quote={quote} share={s} methods={methods} onDone={onChange} />
            ) : null}
          </li>
        ))}
      </ul>
      {open && <p className="mt-3 text-[12.5px] text-muted">{t("quote_no_money_note")} {t("quote_when_all", { city: quote.delivery.city ?? "" })}</p>}
    </section>
  );
}

function ShareForm({ quote, share, methods, onDone }: { quote: Quotation; share: QuoteShare; methods: PaymentMethod[] | null; onDone: (q: Quotation) => void }) {
  const t = useT();
  const lang = useLang();
  const [show, setShow] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [method, setMethod] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const picked = method ?? methods?.[0]?.id ?? null;
  if (!show) return <button type="button" onClick={() => setShow(true)} className="mt-2.5 inline-flex min-h-11 items-center rounded-[10px] bg-signal px-5 font-bold text-on-signal hover:bg-signal-dark">{t("quote_confirm_share")}</button>;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError(t("err_quote_payer_name"));
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError(t("err_quote_payer_email"));
    if (!picked) return setError(t("err_quote_payment_method"));
    setBusy(true);
    try { onDone(await confirmQuotationShare(quote.code, share.id, { name: name.trim(), email: email.trim(), phone: phone.trim() || undefined, paymentMethod: picked }, lang)); }
    catch (err) { setError(quoteErrorText(err, t)); }
    finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} noValidate className="mt-3 grid gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1 text-sm font-semibold">{t("quote_your_name")}<input className={input} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
        <label className="grid gap-1 text-sm font-semibold">{t("quote_your_email")}<input className={input} type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
        <label className="grid gap-1 text-sm font-semibold">{t("quote_your_phone")}<input className={input} type="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" /></label>
      </div>
      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold">{t("quote_payment_method")}</legend>
        {methods === null ? <p className="text-sm text-muted" aria-busy="true">{t("search_loading")}</p> : methods.length === 0 ? (
          <p className="text-sm text-muted">{t("quote_no_methods")}</p>
        ) : (
          <div className="flex flex-wrap gap-2" role="radiogroup">
            {methods.map((m) => (
              <label key={m.id} className={`flex cursor-pointer items-center gap-2 rounded-xl border-[1.5px] px-3 py-2 text-sm font-semibold ${picked === m.id ? "border-navy bg-[#f4f8fb]" : "border-line"}`}>
                <input type="radio" name={`pm-${share.id}`} className="size-4 accent-[#0b3146]" checked={picked === m.id} onChange={() => setMethod(m.id)} />
                {lang === "ar" ? m.nameAr : m.nameEn}
              </label>
            ))}
          </div>
        )}
      </fieldset>
      {error && <p role="alert" className="text-sm font-semibold text-[#a12a21]">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy || methods?.length === 0} className="inline-flex min-h-11 items-center rounded-[10px] bg-signal px-5 font-bold text-on-signal hover:bg-signal-dark disabled:opacity-50">{busy ? t("quote_confirming") : t("quote_confirm_share")}</button>
        <button type="button" onClick={() => setShow(false)} className="inline-flex min-h-11 items-center rounded-[10px] border-[1.5px] border-navy px-4 text-sm font-bold text-navy">{t("cancel")}</button>
      </div>
    </form>
  );
}
