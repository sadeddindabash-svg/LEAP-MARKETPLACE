"use client";

import { useLang, useT } from "./LangProvider";
import { countryName } from "@/lib/countries";
import { PARTY_KEY, quoteDate, quoteMoney, vehicleLabel, type Quotation } from "@/lib/quotations";

// The quotation itself, as the party reads it (on the page and printed to PDF): Leap as the issuer, its number and dates, who it is for, the car, each
// part with its seller (anonymous, like an order) and its own "valid until", the totals in the currency of the day it was issued, who pays what, and the
// QR code that opens the check page. Every amount is fixed: it comes from the server and is never worked out here.
export default function QuotationDocument({ quote, print = false }: { quote: Quotation; print?: boolean }) {
  const lang = useLang();
  const t = useT();
  const money = (usd: number) => quoteMoney(usd, quote.currency, lang);
  const date = (iso: string) => quoteDate(iso, lang);
  const v = quote.vehicle;
  const place = [quote.delivery.city, quote.delivery.country ? countryName(lang, quote.delivery.country) : null].filter(Boolean).join(lang === "ar" ? "، " : ", ");
  const cell = "px-2.5 py-2 align-top";
  return (
    <article data-testid="quotation-document" className={`rounded-[10px] border border-line bg-white ${print ? "p-0 border-0" : "p-5 sm:p-7"} text-[13.5px] text-ink`}>
      <header className="flex flex-wrap items-start justify-between gap-4 border-b-[3px] border-signal pb-3">
        <div>
          <p className="text-[22px] font-extrabold tracking-tight text-navy">{t("quote_brand")}</p>
          <p className="text-xs text-muted">leapautoparts.com</p>
        </div>
        <div className="text-end">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted rtl:tracking-normal">{t("quote_doc_title")}</p>
          <p data-testid="quotation-number" className="text-lg font-extrabold text-navy" dir="ltr">{quote.id}</p>
          <p className="text-xs text-muted">{t("quote_issued")} {date(quote.createdAt)}</p>
        </div>
      </header>

      <dl className="mt-3 grid gap-2.5 sm:grid-cols-3">
        <div className="rounded-lg bg-[#f6f8fa] px-3 py-2"><dt className="text-[11px] font-bold text-muted">{t("quote_for_label")} · {t(PARTY_KEY[quote.party.type])}</dt><dd className="font-semibold"><bdi>{quote.party.name}</bdi>{quote.party.policyNumber && <> · {t("quote_policy_short")} <bdi dir="ltr">{quote.party.policyNumber}</bdi></>}</dd></div>
        <div className="rounded-lg bg-[#f6f8fa] px-3 py-2"><dt className="text-[11px] font-bold text-muted">{t("quote_report_short")}</dt><dd className="font-semibold" dir="ltr">{quote.party.reportNumber || "—"}</dd></div>
        <div className="rounded-lg bg-[#f6f8fa] px-3 py-2"><dt className="text-[11px] font-bold text-muted">{t("quote_car")}</dt><dd className="font-semibold"><bdi>{vehicleLabel(v)}</bdi>{v.vin && <> · <bdi dir="ltr">VIN {v.vin}</bdi></>}{v.plate && <> · {t("quote_plate_short")} <bdi dir="ltr">{v.plate}</bdi></>}</dd></div>
        {quote.buyerName && <div className="rounded-lg bg-[#f6f8fa] px-3 py-2"><dt className="text-[11px] font-bold text-muted">{t("quote_buyer")}</dt><dd className="font-semibold"><bdi>{quote.buyerName}</bdi></dd></div>}
        {place && <div className="rounded-lg bg-[#f6f8fa] px-3 py-2"><dt className="text-[11px] font-bold text-muted">{t("quote_deliver_to")}</dt><dd className="font-semibold"><bdi>{place}</bdi></dd></div>}
      </dl>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse">
          <thead>
            <tr className="bg-navy text-start text-[11.5px] text-white">
              <th className={`${cell} text-start font-semibold`}>{t("quote_col_part")}</th>
              <th className={`${cell} text-start font-semibold`}>{t("quote_col_seller")}</th>
              <th className={`${cell} text-start font-semibold`}>{t("quote_col_valid")}</th>
              <th className={`${cell} text-end font-semibold`}>{t("quote_col_qty")}</th>
              <th className={`${cell} text-end font-semibold`}>{t("quote_col_unit")}</th>
              <th className={`${cell} text-end font-semibold`}>{t("quote_col_total")}</th>
            </tr>
          </thead>
          <tbody>
            {quote.items.map((i) => (
              <tr key={i.productId} className="border-b border-[#eef0f3]">
                <td className={cell}>
                  <span className="block font-bold"><bdi>{i.name}</bdi></span>
                  {i.oemNumber && <span className="block text-[11px] text-muted" dir="ltr">OEM {i.oemNumber}</span>}
                  {!i.inStock && <span className="block text-[11px] font-semibold text-[#a12a21]">{t("quote_out_of_stock_day")}</span>}
                </td>
                <td className={`${cell} text-[12px]`} dir="ltr">{i.seller ?? "—"}</td>
                <td className={`${cell} whitespace-nowrap`}>{date(i.validUntil)}</td>
                <td className={`${cell} text-end`}>{i.quantity}</td>
                <td className={`${cell} whitespace-nowrap text-end`}>{money(i.unitPriceUsd)}</td>
                <td className={`${cell} whitespace-nowrap text-end font-semibold`}>{money(i.totalUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-5">
        <div className="flex max-w-[330px] items-center gap-3">
          {quote.qr && <img src={quote.qr} alt="" width={84} height={84} className="size-[84px] flex-none" />}
          <p className="text-[12px] text-muted">{t("quote_verify_note", { url: quote.link ? quote.link.replace(/^https?:\/\//, "") : `/q/${quote.code}` })} <b className="text-ink" dir="ltr">{quote.code}</b></p>
        </div>
        <dl className="min-w-[250px] flex-1 sm:max-w-[320px]">
          <div className="flex justify-between py-1"><dt>{t("quote_subtotal")}</dt><dd>{money(quote.subtotalUsd)}</dd></div>
          {quote.shippingUsd > 0 && <div className="flex justify-between py-1"><dt>{t("quote_shipping")}</dt><dd>{money(quote.shippingUsd)}</dd></div>}
          <div className="mt-1 flex justify-between border-t-2 border-navy pt-2 text-[15px] font-extrabold"><dt>{t("quote_total", { code: quote.currency.code })}</dt><dd data-testid="quotation-total">{money(quote.totalUsd)}</dd></div>
        </dl>
      </div>

      <section className="mt-4 rounded-lg border border-[#f0d9a0] bg-[#fff8e5] px-3.5 py-2.5" aria-label={t("quote_who_pays")}>
        <p className="text-[11.5px] font-extrabold text-muted">{t("quote_who_pays")}</p>
        {quote.shares.map((s) => (
          <p key={s.id} className="flex justify-between gap-3 font-semibold">
            <span><bdi>{s.payer === "party" ? quote.party.name : t("quote_payer_buyer")}</bdi> · {s.percent}%</span>
            <span>{money(s.amountUsd)}{s.confirmed && <span className="ms-2 text-[#0f6b49]">✓</span>}</span>
          </p>
        ))}
      </section>

      <footer className="mt-3 border-t border-[#eef0f3] pt-2.5 text-[11.5px] text-muted">
        <p className="font-bold text-ink">{t("quote_expires_note", { date: date(quote.expiresAt) })}</p>
        <p>{t("quote_not_invoice")}</p>
      </footer>
    </article>
  );
}
