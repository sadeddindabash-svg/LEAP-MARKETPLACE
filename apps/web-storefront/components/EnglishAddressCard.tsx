"use client";

import { useState } from "react";
import { confirmEnglishAddress, type EnglishAddress, type OrderWho } from "@/lib/api";
import { hasArabicLetters } from "@/lib/orders";
import { useT } from "./LangProvider";

const input = "min-h-11 w-full rounded-[10px] border-[1.5px] border-[#c5d0d8] bg-white px-3 text-[15px] text-ink";

/**
 * The inspection hub reads the address in English. The server translated it automatically ("auto"), so the buyer is asked to check it: "It is correct" confirms it as it is,
 * "Edit" lets them correct it, in English letters only (the server refuses anything else too). Shown only until somebody has confirmed it.
 */
export default function EnglishAddressCard({ orderId, english, who, onConfirmed }: { orderId: string; english: EnglishAddress; who: OrderWho; onConfirmed: () => void }) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState({ recipientName: english.recipientName, country: english.country, city: english.city, streetAddress: english.streetAddress });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const confirm = async (edits?: typeof fields) => {
    setBusy(true); setError(null);
    try { await confirmEnglishAddress(orderId, who, edits); setDone(true); onConfirmed(); }
    catch (e) { setError(e instanceof Error && e.message ? e.message : t("something_went_wrong")); }
    finally { setBusy(false); }
  };
  const save = () => {
    if (Object.values(fields).some((v) => !v.trim())) return setError(t("english_fill_fields"));
    if (Object.values(fields).some(hasArabicLetters)) return setError(t("english_letters_only"));
    confirm({ ...fields, recipientName: fields.recipientName.trim(), country: fields.country.trim(), city: fields.city.trim(), streetAddress: fields.streetAddress.trim() });
  };

  if (done) return <p role="status" className="rounded-xl bg-[#e8f4ee] p-4 text-sm font-semibold text-[#0f6b49]">{t("address_confirmed_thanks")}</p>;
  const label = (key: keyof typeof fields, text: string) => (
    <div>
      <label htmlFor={`en-${key}`} className="mb-1 block text-[13px] font-bold text-navy">{text}</label>
      <input id={`en-${key}`} className={input} value={fields[key]} dir="ltr" disabled={busy} onChange={(e) => setFields({ ...fields, [key]: e.target.value })} />
    </div>
  );
  return (
    <section className="rounded-[14px] border border-[#f0d9a0] bg-[#fff8e5] p-5" aria-labelledby="en-addr">
      <h2 id="en-addr" className="text-lg font-bold">{t("check_address_english")}</h2>
      <p className="mb-3 mt-1 text-sm text-muted">{t("english_address_intro")}</p>
      {editing ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {label("recipientName", t("recipient_name_field"))}{label("country", t("country_field"))}{label("city", t("city_field"))}{label("streetAddress", t("street_address_field"))}
        </div>
      ) : (
        <p dir="ltr" className="rounded-lg bg-white p-3 text-start font-semibold">{english.recipientName}<br />{english.streetAddress}, {english.city}, {english.country}</p>
      )}
      {error && <p role="alert" className="mt-3 text-sm font-semibold text-[#a12a21]">{error}</p>}
      <div className="mt-4 flex flex-wrap gap-3">
        {editing ? (
          <>
            <button type="button" disabled={busy} onClick={save} className="inline-flex min-h-11 items-center rounded-[10px] bg-signal px-5 font-bold text-on-signal hover:bg-signal-dark disabled:opacity-50">{t("save")}</button>
            <button type="button" disabled={busy} onClick={() => { setEditing(false); setError(null); }} className="inline-flex min-h-11 items-center rounded-[10px] border-[1.5px] border-navy px-5 font-bold text-navy">{t("cancel")}</button>
          </>
        ) : (
          <>
            <button type="button" disabled={busy} onClick={() => confirm()} className="inline-flex min-h-11 items-center rounded-[10px] bg-signal px-5 font-bold text-on-signal hover:bg-signal-dark disabled:opacity-50">{t("address_is_correct")}</button>
            <button type="button" disabled={busy} onClick={() => setEditing(true)} className="inline-flex min-h-11 items-center rounded-[10px] border-[1.5px] border-navy px-5 font-bold text-navy">{t("edit")}</button>
          </>
        )}
      </div>
    </section>
  );
}
